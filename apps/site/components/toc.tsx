"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./toc.module.css"

type Entry = { readonly id: string; readonly text: string }

/**
 * "On this page" with the section being read highlighted, following the scroll. The current
 * section is the last heading above a line a third of the way down the viewport.
 */
export function Toc({ entries }: { entries: readonly Entry[] }) {
  const [current, setCurrent] = useState<string | null>(entries[0]?.id ?? null)
  const list = useRef<HTMLOListElement>(null)
  const [marker, setMarker] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const line = window.innerHeight / 3
      let active: string | null = entries[0]?.id ?? null
      for (const { id } of entries) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) active = id
      }
      // at the very bottom, the last section is the one being read
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        active = entries[entries.length - 1]?.id ?? active
      }
      setCurrent(active)
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
    }
  }, [entries])

  // biome-ignore lint/correctness/useExhaustiveDependencies: the marker re-measures when the current section changes
  useEffect(() => {
    const link = list.current?.querySelector<HTMLElement>('[aria-current="location"]')
    setMarker(link ? { top: link.offsetTop, height: link.offsetHeight } : null)
  }, [current])

  return (
    <nav className={styles.toc} aria-label="On this page">
      <p>On this page</p>
      <div className={styles.rail}>
        {marker && (
          <span
            className={styles.marker}
            style={{ translate: `0 ${marker.top}px`, height: marker.height }}
            aria-hidden="true"
          />
        )}
        <ol ref={list}>
          {entries.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} aria-current={current === t.id ? "location" : undefined}>
                {t.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}
