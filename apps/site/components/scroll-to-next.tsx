"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import styles from "./scroll-to-next.module.css"

export interface DocsStop {
  readonly href: string
  readonly label: string
}

/**
 * A "keep scrolling for the next page" strip at the end of every docs page. It adds no page
 * height: at the bottom, more downward wheel or touch intent fills the bar, and a full bar
 * opens the next page (prefetched). Scrolling back up, or stopping, empties it. The link
 * does the same for keyboard and assistive-technology users.
 */
export function ScrollToNext({ stops }: { stops: readonly DocsStop[] }) {
  // usePathname may drop the trailing slash the hrefs carry
  const path = usePathname().replace(/\/?$/, "/")
  const at = stops.findIndex((s) => s.href === path)
  const next = at >= 0 ? stops[at + 1] : undefined
  const router = useRouter()
  const barRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!next) return
    const href = next.href
    router.prefetch(href)

    // `target` grows with over-scroll intent and drains when it stops; `value` eases toward it
    // every frame, so the bar fills and empties smoothly instead of jumping per event.
    let target = 0
    let value = 0
    let lastInput = 0
    let lastFrame = 0
    let raf = 0
    let navigated = false
    let touchY = 0

    // A deliberate pull, not a stray flick: a long scroll past the bottom fills the bar.
    const NEEDED = 2200 // px of extra downward intent to fill the bar
    const DRAIN_PER_SEC = 0.25
    const IDLE_MS = 70

    const atBottom = () =>
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4

    const render = () => {
      if (barRef.current) barRef.current.style.transform = `scaleX(${value})`
      if (hintRef.current) hintRef.current.style.opacity = value > 0.02 ? "1" : "0"
    }

    const tick = (t: number) => {
      const dt = lastFrame ? Math.min(0.05, (t - lastFrame) / 1000) : 0
      lastFrame = t
      if (performance.now() - lastInput > IDLE_MS) target = Math.max(0, target - dt * DRAIN_PER_SEC)
      value += (target - value) * Math.min(1, dt * 9)
      render()
      if (value >= 0.99 && !navigated) {
        navigated = true
        router.push(href)
      }
      if (value > 0.001 || target > 0.001) {
        raf = requestAnimationFrame(tick)
      } else {
        raf = 0
        lastFrame = 0
        value = 0
        render()
      }
    }
    const ensure = () => {
      if (raf) return
      lastFrame = 0
      raf = requestAnimationFrame(tick)
    }
    const intent = (px: number) => {
      target = atBottom() ? Math.max(0, Math.min(1, target + px / NEEDED)) : 0
      lastInput = performance.now()
      ensure()
    }

    const onWheel = (e: WheelEvent) => intent(e.deltaY)
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? touchY
      // dragging up is scroll-down intent
      intent((touchY - y) * 1.6)
      touchY = y
    }
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [router, next])

  if (!next) return null
  return (
    <div className={styles.strip}>
      <div className={styles.row}>
        <span className={styles.lead}>Keep scrolling for the next page</span>
        <Link prefetch={false} href={next.href} className={styles.link}>
          {next.label} <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div aria-hidden="true" className={styles.track}>
        <div ref={barRef} className={styles.bar} />
      </div>
      <span ref={hintRef} aria-hidden="true" className={styles.hint}>
        keep scrolling to open {next.label}
      </span>
    </div>
  )
}
