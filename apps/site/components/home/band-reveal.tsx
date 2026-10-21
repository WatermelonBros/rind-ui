"use client"

import { useEffect } from "react"

/**
 * Drives each landing band's --reveal (home.module.css): 0 while its top is at the bottom of
 * the screen, 1 once it has risen a third of the way, so its colour has opened before its
 * heading can be read. Without script or under reduced motion the bands are simply filled.
 */
export function BandReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const bands = [...document.querySelectorAll<HTMLElement>("main [data-band]")]
    let raf = 0
    const update = () => {
      raf = 0
      const h = window.innerHeight
      for (const band of bands) {
        const top = band.getBoundingClientRect().top
        const reveal = Math.min(1, Math.max(0, (h - top) / (h * 0.35)))
        band.style.setProperty("--reveal", reveal.toFixed(3))
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      for (const band of bands) band.style.removeProperty("--reveal")
    }
  }, [])
  return null
}
