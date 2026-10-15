"use client"

import { useEffect, useState } from "react"
import styles from "./intro.module.css"

const DROP_MS = 900

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> }
}

/**
 * First visit of the landing: the page boots as the browser's raw HTML (the inline script in
 * <head> set html.unstyled before paint), a drop falls, and the styles spread out from where it
 * lands. Click anywhere to skip. Never runs under reduced motion.
 */
export function Intro() {
  const [dropping, setDropping] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    if (!root.classList.contains("unstyled")) return
    setDropping(true)
    let done = false
    const reveal = () => {
      if (done) return
      done = true
      try {
        sessionStorage.setItem("rind-intro", "1")
      } catch {
        // without storage the intro may play again next visit; harmless
      }
      const x = "50%"
      const y = "42%"
      const finish = () => {
        root.classList.remove("unstyled")
        setDropping(false)
      }
      const doc = document as ViewTransitionDocument
      if (!doc.startViewTransition) return finish()
      doc.startViewTransition(finish).ready.then(() => {
        root.animate(
          { clipPath: [`circle(0% at ${x} ${y})`, `circle(150% at ${x} ${y})`] },
          {
            duration: 1100,
            easing: "cubic-bezier(0.7, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        )
      })
    }
    const timer = setTimeout(reveal, DROP_MS)
    window.addEventListener("pointerdown", reveal, { once: true })
    window.addEventListener("keydown", reveal, { once: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("pointerdown", reveal)
      window.removeEventListener("keydown", reveal)
    }
  }, [])

  return dropping ? <span className={styles.drop} data-intro-drop="" aria-hidden="true" /> : null
}
