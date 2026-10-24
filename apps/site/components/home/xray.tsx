"use client"

import { useEffect, useRef, useState } from "react"
import { zoom } from "../zoom"
import styles from "./xray.module.css"

/** The attributes worth showing: rind's state and the ARIA it keeps in sync. */
const SHOWN = /^(data-(?!scope$|part$|instance$|rind-|skin|skinned|testid|anatomy).+|aria-.+|role)$/

interface Reading {
  readonly name: string
  readonly attrs: readonly (readonly [string, string])[]
}

function read(el: HTMLElement): Reading {
  const attrs: [string, string][] = []
  for (const a of el.attributes) {
    if (
      SHOWN.test(a.name) &&
      !a.name.startsWith("aria-labelledby") &&
      !a.name.endsWith("controls")
    ) {
      attrs.push([a.name, a.value])
    }
  }
  return { name: `${el.dataset["scope"]} · ${el.dataset["part"]}`, attrs: attrs.slice(0, 5) }
}

/**
 * The landing's x-ray cursor: over a live component, a label beside the pointer shows the part
 * under it and its state attributes, updated as they change. It is the page's own argument (the
 * state is in the attributes you style) made visible. Fine pointers only, never under reduced
 * motion; it takes no pointer events and is hidden from assistive technology.
 */
export function XRay() {
  const box = useRef<HTMLDivElement>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  useEffect(() => {
    const fine = matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)")
    if (!fine.matches) return
    let target: HTMLElement | null = null
    let x = 0
    let y = 0
    let shownX = 0
    let shownY = 0
    let frame = 0
    const watch = new MutationObserver(() => target && setReading(read(target)))
    const follow = () => {
      // a little lag: the label trails the pointer instead of sticking to it
      shownX += (x - shownX) * 0.25
      shownY += (y - shownY) * 0.25
      const el = box.current
      if (el) {
        // beside the pointer, flipped to the other side near the viewport's right or bottom edge
        // measured and placed in viewport pixels, written back in the zoomed page's (zoom.ts)
        const z = zoom()
        const w = el.offsetWidth * z
        const h = el.offsetHeight * z
        const left = shownX + 18 + w > innerWidth - 8 ? shownX - 18 - w : shownX + 18
        const top = shownY + 20 + h > innerHeight - 8 ? shownY - 12 - h : shownY + 20
        el.style.translate = `${left / z}px ${top / z}px`
      }
      frame = Math.abs(x - shownX) + Math.abs(y - shownY) > 0.5 ? requestAnimationFrame(follow) : 0
    }
    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!frame) frame = requestAnimationFrame(follow)
      // the event target of a pointer event is an Element (or null over nothing)
      // (a tool's own chrome, the builder's chips and rack, is not what the page shows off)
      const over = e.target as Element | null
      const hit = over?.closest("[data-xray-off]")
        ? null
        : (over?.closest<HTMLElement>("[data-skinned] [data-scope][data-part]") ?? null)
      if (hit === target) return
      watch.disconnect()
      target = hit
      if (!hit) return setReading(null)
      watch.observe(hit, { attributes: true })
      setReading(read(hit))
    }
    const onLeave = () => {
      watch.disconnect()
      target = null
      setReading(null)
    }
    // a wheel scroll moves the page under a still pointer: the reading would hang over whatever
    // slid beneath it, so it goes until the pointer moves again
    const onScroll = () => {
      if (target) onLeave()
    }
    document.addEventListener("pointermove", onMove, { passive: true })
    document.documentElement.addEventListener("pointerleave", onLeave)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("pointermove", onMove)
      document.documentElement.removeEventListener("pointerleave", onLeave)
      watch.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  return (
    <div ref={box} className={styles.xray} data-shown={reading ? "" : undefined} aria-hidden="true">
      {reading ? (
        <>
          <span className={styles.name}>{reading.name}</span>
          {reading.attrs.map(([k, v]) => (
            <span key={k} className={styles.attr}>
              {k}
              {v ? (
                <>
                  =<b>"{v}"</b>
                </>
              ) : null}
            </span>
          ))}
        </>
      ) : null}
    </div>
  )
}
