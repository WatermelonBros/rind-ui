"use client"

import { useEffect, useRef } from "react"
import { useSound } from "./sound"
import styles from "./sound.module.css"

/** Four bars that move with what is playing, a flat line when off (`idle`: rippling, waiting). */
export function SoundBars({ idle = false }: { idle?: boolean }) {
  const { enabled, levels } = useSound()
  const bars = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = bars.current
    if (!el) return
    let frame = 0
    const draw = () => {
      const now = levels(4)
      el.querySelectorAll("i").forEach((bar, k) => {
        bar.style.setProperty("--level", String(now[k] ?? 0))
      })
      frame = requestAnimationFrame(draw)
    }
    if (enabled) draw()
    else for (const bar of el.querySelectorAll("i")) bar.style.removeProperty("--level")
    return () => cancelAnimationFrame(frame)
  }, [enabled, levels])
  return (
    <span ref={bars} className={styles.bars} data-idle={idle ? "" : undefined} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
