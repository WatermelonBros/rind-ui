"use client"

import Link from "next/link"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { zoom } from "../zoom"
import { useSceneGl } from "./hero-state"
import styles from "./home.module.css"
import { Reveal } from "./reveal"

const SECRET = "rind"
const SEEDS = 28

/**
 * The page's last word: the dimmed title fills at full contrast as it scrolls in, then peels in
 * the accent in a circle around the pointer (filled outright on touch and under reduced motion). Typing "rind" anywhere
 * outside a field rains watermelon seeds and says so politely.
 */
export function Outro() {
  const footer = useRef<HTMLElement>(null)
  const title = useRef<HTMLParagraphElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const [egg, setEgg] = useState(0)
  const [said, setSaid] = useState("")
  // the object's last berth is there only while the object is drawn (WebGL on)
  const gl = useSceneGl()

  useEffect(() => {
    const el = footer.current
    const t = title.current
    const f = fill.current
    if (!el || !t || !f) return
    // one write per frame, straight on the filled copy: no transition chasing the pointer and
    // no inherited custom property restyling the whole title on every move
    let frame = 0
    let x = 0
    let y = 0
    const paint = () => {
      frame = 0
      const r = t.getBoundingClientRect()
      const z = zoom()
      f.style.clipPath = `circle(150px at ${(x - r.left) / z}px ${(y - r.top) / z}px)`
      // the same peel on the links and buttons under the title, each in its own coordinates
      for (const l of lenses) {
        const b = l.getBoundingClientRect()
        l.style.setProperty("--lx", `${(x - b.left) / z}px`)
        l.style.setProperty("--ly", `${(y - b.top) / z}px`)
      }
    }
    const lenses = [...el.querySelectorAll<HTMLElement>("[data-text]")]
    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!frame) frame = requestAnimationFrame(paint)
    }
    // the title fills as it rises from the foot of the screen to its upper third
    let scrolled = 0
    const fillIn = () => {
      scrolled = 0
      const r = t.getBoundingClientRect()
      const k = (window.innerHeight - r.top) / (window.innerHeight * 0.7)
      t.style.setProperty("--fill", String(Math.min(1, Math.max(0, k))))
    }
    const onScroll = () => {
      if (!scrolled) scrolled = requestAnimationFrame(fillIn)
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fillIn()
      window.addEventListener("scroll", onScroll, { passive: true })
    }
    el.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      el.removeEventListener("pointermove", onMove)
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(scrolled)
    }
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
    <footer
      ref={footer}
      className={`${styles.outro} ${styles.band}`}
      data-band="outro"
      data-from="paper"
    >
      <Reveal>
        <p ref={title} className={styles.outroTitle}>
          <span className={styles.outroOutline}>
            Build the look.
            <br />
            We did the rest.
          </span>
          {/* the filled copy only paints the peel: assistive technology reads the outline */}
          <span ref={fill} className={styles.outroFill} aria-hidden="true">
            Build the look.
            <br />
            We did the rest.
          </span>
        </p>
        <div className={styles.outroCtas}>
          {/* where the travelling object ends its trip (skin-scene.tsx: the finale), by the way in */}
          {/* a press on the landed object is a press on Get started (the scene lets a control under
              the object take the press); the link itself is named once, below */}
          {gl ? (
            <Link
              prefetch={false}
              href="/docs/get-started/"
              className={styles.objectSlot}
              data-object-finale=""
              aria-hidden="true"
              tabIndex={-1}
            />
          ) : null}
          <Link
            prefetch={false}
            href="/docs/get-started/"
            className={styles.outroPrimary}
            data-text="Get started →"
          >
            Get started →
          </Link>
          <Link
            prefetch={false}
            href="/compare/"
            className={styles.outroGhost}
            data-text="How it compares"
          >
            How it compares
          </Link>
          <a
            href="https://github.com/WatermelonBros/rind-ui"
            className={styles.outroGhost}
            data-text="GitHub"
          >
            GitHub
          </a>
          <a href="https://discord.gg/HHqT9ucXn4" className={styles.outroGhost} data-text="Discord">
            Discord
          </a>
        </div>
      </Reveal>
      <div className={styles.outroBottom}>
        <span>rind · headless components by Watermelon</span>
        <a
          className={styles.builtWith}
          href="https://reado.watermelon-studio.it"
          data-text="Built using Reado ↗"
        >
          Built using <b>Reado</b> ↗
        </a>
        <span>
          <Link prefetch={false} href="/compare/">
            Compare
          </Link>{" "}
          · MIT ·{" "}
          <Link prefetch={false} href="/privacy/">
            Privacy
          </Link>
        </span>
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
