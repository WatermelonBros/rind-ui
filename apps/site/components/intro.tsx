"use client"

import { useEffect, useState } from "react"
import styles from "./intro.module.css"

const DROP_MS = 900

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> }
}

/*
 * Runs while the HTML is parsed, right after the page (this component sits after it in the
 * layout): copies the header and main into a layer that shows them with no CSS at all. The layer
 * hangs off <html>, outside the tree React hydrates, so hydration never touches it.
 * The real page is styled from its first paint and never changes layout, so the effect costs no
 * layout shift; the copy only covers it, then goes.
 */
const FILL = `(function(){var r=document.documentElement;try{if(!r.classList.contains("intro"))return;var l=document.createElement("div");l.id="rind-intro-layer";l.setAttribute("aria-hidden","true");l.inert=true;["header","main"].forEach(function(s){var e=document.querySelector(s);if(e)l.appendChild(e.cloneNode(true))});r.appendChild(l)}finally{r.setAttribute("data-intro-ready","")}})()`

/**
 * First visit of the landing: the page appears as the browser's raw HTML, a drop falls, and the
 * styles spread out from where it lands. Click, scroll or press a key to skip. Never runs under
 * reduced motion (the inline script in <head> only sets html.intro without it).
 */
export function Intro() {
  const [phase, setPhase] = useState<"on" | "dropping" | "gone">("on")

  useEffect(() => {
    const root = document.documentElement
    const layer = document.getElementById("rind-intro-layer")
    if (!root.classList.contains("intro") || !layer) {
      setPhase("gone")
      return
    }
    setPhase("dropping")
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
        // synchronous, so the view transition's new snapshot is the styled page
        layer.remove()
        root.classList.remove("intro")
        setPhase("gone")
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
    const skip = ["pointerdown", "keydown", "wheel", "touchstart"] as const
    for (const type of skip) window.addEventListener(type, reveal, { once: true, passive: true })
    return () => {
      clearTimeout(timer)
      for (const type of skip) window.removeEventListener(type, reveal)
    }
  }, [])

  if (phase === "gone") return null
  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user input
        dangerouslySetInnerHTML={{ __html: FILL }}
      />
      {phase === "dropping" ? (
        <span className={styles.drop} data-intro-drop="" aria-hidden="true" />
      ) : null}
    </>
  )
}
