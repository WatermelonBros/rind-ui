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
    return () => lenis.destroy()
  }, [])
  return null
}
