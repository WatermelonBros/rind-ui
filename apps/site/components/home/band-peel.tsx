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
 * one starts. Never under reduced motion nor on a phone: the bands are simply there.
 */
export function BandPeel() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // not on a phone: a full-width sheet repainted every frame lagged and its curl smeared
    // between sections (the bands simply meet there)
    if (window.matchMedia("(max-width: 760px), (pointer: coarse)").matches) return
    const bands = [...document.querySelectorAll<HTMLElement>("[data-band][data-from]")]
    const started = new WeakSet<HTMLElement>()
    // how far each sheet is shown peeled: it never goes back once started, and once the page
    // rests it finishes on its own (a sheet held half off read as an artefact over the copy)
    const shownP = new WeakMap<HTMLElement, number>()
    let lastScroll = performance.now()
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
        const raw = Math.min(1, Math.max(0, (vh * 0.98 - r.top) / (vh * 0.48)))
        const before = shownP.get(band) ?? 0
        const idle = performance.now() - lastScroll > 220
        // back below the screen: covered again for its next entry
        const p =
          raw === 0 ? 0 : Math.max(raw, idle && before > 0 ? before + (1 - before) * 0.12 : before)
        shownP.set(band, p > 0.995 ? 1 : p)
        if (idle && p > 0 && p < 0.995) settling = true
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
      // a sheet still finishing keeps the frames coming until it is off
      if (settling) {
        settling = false
        frame = requestAnimationFrame(paint)
      }
    }
    let settling = false
    let idleTimer = 0
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const onScroll = () => {
      lastScroll = performance.now()
      clearTimeout(idleTimer)
      // once the page has rested, the sheets left half off finish
      idleTimer = window.setTimeout(schedule, 240)
      schedule()
    }
    paint()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      clearTimeout(idleTimer)
      window.removeEventListener("resize", schedule)
      sheet.remove()
      html.removeAttribute("data-bands-peel")
    }
  }, [])
  return null
}
