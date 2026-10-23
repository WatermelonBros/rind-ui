"use client"

import { type PointerEvent, useRef, useState } from "react"
import styles from "./wordmark.module.css"
import { zoom } from "./zoom"

type Letter = "r" | "i" | "n" | "d"

const STATES: Record<Letter, string> = {
  r: "data-hover",
  i: "data-dragging",
  n: "data-focus-visible",
  d: "data-pressed",
}

/**
 * The live logo: each letter idles in its own UI state. The pointer takes over the letter it
 * touches (a soft lift, a gentle squash on press) and the i-dot can be dragged away; it springs back.
 */
export function Wordmark({ chips = true }: { chips?: boolean }) {
  const [live, setLive] = useState<Letter | null>(null)
  const [down, setDown] = useState(false)
  const dot = useRef<HTMLSpanElement>(null)
  const drag = useRef<{
    x: number
    y: number
    tx: number
    ty: number
    cx: number
    cy: number
    raf: number
  } | null>(null)

  // The dot trails the pointer with a little lag instead of snapping to it.
  const follow = () => {
    const d = drag.current
    const el = dot.current
    if (!d || !el) return
    d.cx += (d.tx - d.cx) * 0.25
    d.cy += (d.ty - d.cy) * 0.25
    // pointer pixels, written into the zoomed page (zoom.ts)
    const z = zoom()
    el.style.translate = `${d.cx / z}px ${d.cy / z}px`
    d.raf = requestAnimationFrame(follow)
  }
  const grab = (e: PointerEvent<HTMLSpanElement>) => {
    const el = dot.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    el.dataset["held"] = ""
    drag.current = { x: e.clientX, y: e.clientY, tx: 0, ty: 0, cx: 0, cy: 0, raf: 0 }
    drag.current.raf = requestAnimationFrame(follow)
    e.stopPropagation()
  }
  const move = (e: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current
    if (!d) return
    d.tx = e.clientX - d.x
    d.ty = e.clientY - d.y
  }
  const release = () => {
    const d = drag.current
    const el = dot.current
    if (!d || !el) return
    cancelAnimationFrame(d.raf)
    drag.current = null
    el.dataset["spring"] = ""
    el.style.translate = "0 0"
    setTimeout(() => {
      delete el.dataset["held"]
      delete el.dataset["spring"]
    }, 900)
  }

  const letter = (l: Letter, extra?: React.ReactNode) => (
    <span
      className={styles.l}
      data-letter={l}
      data-live={live === l ? "" : undefined}
      data-down={live === l && down ? "" : undefined}
      onPointerEnter={() => setLive(l)}
      onPointerLeave={() => {
        setLive(null)
        setDown(false)
      }}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
    >
      {l === "i" ? "ı" : l}
      {extra}
      {chips && (
        <span className={styles.chip} aria-hidden="true">
          {STATES[l]}
        </span>
      )}
      <span className={styles.drop} aria-hidden="true" />
    </span>
  )

  return (
    // decorative: the hero's <h1> already says "rind" (a named image here made screen readers
    // say it twice: "heading level 1, rind", then "graphic, rind")
    <div className={styles.word} aria-hidden="true">
      {letter("r")}
      {letter(
        "i",
        <span
          ref={dot}
          className={styles.dot}
          onPointerDown={grab}
          onPointerMove={move}
          onPointerUp={release}
          onPointerCancel={release}
        />,
      )}
      {letter("n")}
      {letter("d")}
    </div>
  )
}
