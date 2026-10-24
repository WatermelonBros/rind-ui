"use client"

import { useEffect } from "react"
import { cue } from "../sound"
import { zoom } from "../zoom"

/**
 * Every section that changes the page's ground comes in by peeling the last one off it: until
 * then the band wears the previous ground as a sheet over it (its colour, data-from), and as it
 * rises the sheet comes away from the bottom of the screen upwards, its edge curled, until the
 * band's top. The sheet is drawn by home.module.css (.band[data-from]); this only says how much
 * of it is left (--peel, from the band's top) and whether its edge shows (--lip), in a style
 * sheet of its own: the bands are React's, and may still be hydrating (each section is its own
 * Suspense boundary), so their attributes are never touched. A strip of tape is heard as each
 * one starts. Never under reduced motion: the bands are simply there.
 */
export function BandPeel() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const bands = [...document.querySelectorAll<HTMLElement>("[data-band][data-from]")]
    const started = new WeakSet<HTMLElement>()
    const sheet = document.createElement("style")
    document.head.append(sheet)
    const html = document.documentElement
    html.toggleAttribute("data-bands-peel", true)
    let frame = 0
    const paint = () => {
      frame = 0
      const vh = window.innerHeight
      const z = zoom()
      const rules: string[] = []
      for (const band of bands) {
        const r = band.getBoundingClientRect()
        // from the band's top at the screen's foot to its top halfway up the screen
        const p = Math.min(1, Math.max(0, (vh * 0.98 - r.top) / (vh * 0.48)))
        const e = p * p * (3 - 2 * p)
        // the sheet's edge rises from the screen's foot to the band's top
        const peel = Math.min(r.height, Math.max(0, (vh - r.top) * (1 - e)))
        // each band is one of a kind by what it is and what it covers
        rules.push(
          `[data-band="${band.dataset["band"]}"][data-from="${band.dataset["from"]}"]{--peel:${(peel / z).toFixed(1)}px;--lip:${p > 0 && p < 1 ? 1 : 0}}`,
        )
        if (p > 0.02 && !started.has(band)) {
          started.add(band)
          cue("peel", { value: 1 })
        } else if (p === 0) started.delete(band)
      }
      const css = rules.join("\n")
      if (sheet.textContent !== css) sheet.textContent = css
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    paint()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      sheet.remove()
      html.removeAttribute("data-bands-peel")
    }
  }, [])
  return null
}
