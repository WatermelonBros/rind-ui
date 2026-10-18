"use client"

import Link from "next/link"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

const SECRET = "rind"
const SEEDS = 28

/**
 * The page's last word, peeled under the pointer: the title is an outline, filled in a circle
 * around the pointer (filled outright on touch and under reduced motion). Typing "rind" anywhere
 * outside a field rains watermelon seeds and says so politely.
 */
export function Outro() {
  const footer = useRef<HTMLElement>(null)
  const title = useRef<HTMLParagraphElement>(null)
  const [egg, setEgg] = useState(0)
  const [said, setSaid] = useState("")

  useEffect(() => {
    const el = footer.current
    const t = title.current
    if (!el || !t) return
    const onMove = (e: PointerEvent) => {
      const r = t.getBoundingClientRect()
      t.style.setProperty("--mx", `${e.clientX - r.left}px`)
      t.style.setProperty("--my", `${e.clientY - r.top}px`)
    }
    el.addEventListener("pointermove", onMove, { passive: true })
    return () => el.removeEventListener("pointermove", onMove)
  }, [])

  useEffect(() => {
    let typed = ""
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return
      typed = (typed + e.key.toLowerCase()).slice(-SECRET.length)
      if (typed !== SECRET) return
      typed = ""
      setEgg((n) => n + 1)
      setSaid("You found the rind.")
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // the seeds and the message clear themselves (a one-off celebration, not page state)
  useEffect(() => {
    if (!egg) return
    const done = setTimeout(() => setSaid(""), 4000)
    return () => clearTimeout(done)
  }, [egg])

  return (
    <footer ref={footer} className={styles.outro}>
      <Reveal>
        <p ref={title} className={styles.outroTitle}>
          <span className={styles.outroOutline}>
            Build the look.
            <br />
            We did the rest.
          </span>
          {/* the filled copy only paints the peel: assistive technology reads the outline */}
          <span className={styles.outroFill} aria-hidden="true">
            Build the look.
            <br />
            We did the rest.
          </span>
        </p>
        <div className={styles.outroCtas}>
          <Link href="/docs/get-started/" className={styles.outroPrimary}>
            Get started →
          </Link>
          <a href="https://github.com/WatermelonBros/rind-ui" className={styles.outroGhost}>
            GitHub
          </a>
        </div>
      </Reveal>
      <div className={styles.outroBottom}>
        <span>rind · headless components by Watermelon</span>
        <a className={styles.builtWith} href="https://reado.watermelon-studio.it">
          Built using <b>Reado</b> ↗
        </a>
        <span>MIT</span>
      </div>
      <p className={styles.visuallyHidden} role="status">
        {said}
      </p>
      {said ? (
        <div key={egg} className={styles.seeds} aria-hidden="true">
          {Array.from({ length: SEEDS }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: seeds are positions, never reordered
              key={i}
              className={styles.seed}
              style={
                {
                  "--x": `${(i * 37) % 100}vw`,
                  "--d": `${(i % 7) * 0.12}s`,
                  "--r": `${(i * 53) % 360}deg`,
                } as CSSProperties
              }
            />
          ))}
          <b className={styles.seedsNote}>You found the rind.</b>
        </div>
      ) : null}
    </footer>
  )
}
