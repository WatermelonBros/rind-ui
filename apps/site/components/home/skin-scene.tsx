"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./skin-scene.module.css"

/**
 * The membrane's canvas. The WebGL module loads only after the page has loaded and the browser
 * is idle, so it never competes with first paint; reduced motion, Save-Data or no WebGL 2 keep
 * the page as it is without it. Decorative: hidden from assistive technology, never focusable.
 */
export function SkinScene() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // sound: Network Information is optional in browsers and absent from lib.dom, so every
    // field is read as possibly missing
    const net = navigator as Navigator & { connection?: { saveData?: boolean } }
    if (net.connection?.saveData) return
    let cancelled = false
    let dispose: (() => void) | null = null
    let idle = 0
    const start = () => {
      import("./skin-gl")
        .then(({ mountSkin }) => {
          if (!cancelled) dispose = mountSkin(el, () => setOn(true))
        })
        // the scene is decoration: a failed chunk leaves the page as it is
        .catch(() => {})
    }
    const schedule = () => {
      // Safari has no requestIdleCallback
      idle =
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(start, { timeout: 1500 })
          : window.setTimeout(start, 300)
    }
    if (document.readyState === "complete") schedule()
    else window.addEventListener("load", schedule, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener("load", schedule)
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle)
      clearTimeout(idle)
      dispose?.()
    }
  }, [])
  return (
    <canvas
      ref={canvas}
      className={styles.scene}
      data-on={on ? "" : undefined}
      aria-hidden="true"
      tabIndex={-1}
    />
  )
}
