"use client"

import Lenis from "lenis"
import "lenis/dist/lenis.css"
import { useEffect } from "react"

/** Inertial scrolling for the landing only; the docs keep native scrolling. */
export function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // nested scrollers (the agents' thread, the skin builder's CSS) keep their own wheel
    const lenis = new Lenis({ autoRaf: true, lerp: 0.12, allowNestedScroll: true })
    // the page's height changed under the reader (a stretch removed above the screen, the
    // browser's anchoring moved the scroll to keep what is on screen still): Lenis takes the
    // scroll where it now is, instead of easing back to its old target
    const sync = () => {
      lenis.resize()
      lenis.scrollTo(window.scrollY, { immediate: true, force: true })
    }
    window.addEventListener("rind:scroll-sync", sync)
    return () => {
      window.removeEventListener("rind:scroll-sync", sync)
      lenis.destroy()
    }
  }, [])
  return null
}
