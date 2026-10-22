"use client"

import { useEffect, useRef, useState } from "react"
import type { SkinHandle } from "./home/skin-gl"
import styles from "./lost-zero.module.css"

/**
 * The 404's 0 is an avatar in the site's 3D make (home/skin-gl.ts): a disc with a face that
 * looks lost, blinks, follows the pointer with its eyes, and is surprised while touched. It
 * stands where the digit would and bobs as if waiting. Without WebGL 2 (or before its first
 * frame, and under reduced motion) the plain 0 shows.
 */
export function LostZero() {
  const slot = useRef<HTMLSpanElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)
  // surprised: while the pointer is on it, or for a moment after a tap
  const [checked, setChecked] = useState(false)
  const scene = useRef<SkinHandle | null>(null)

  useEffect(() => {
    const el = canvas.current
    const at = slot.current
    if (!el || !at) return
    // like the hero's object: none under reduced motion (the plain 0 stays)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let cancelled = false
    let frame = 0
    const born = performance.now()
    const rect = () => {
      const r = at.getBoundingClientRect()
      // a slow bob, the same breath the dropped i-dot had
      const bob = Math.sin((performance.now() - born) / 900) * r.height * 0.04
      return new DOMRect(r.x, r.y + bob, r.width, r.height)
    }
    import("./home/skin-gl").then(({ mountSkin }) => {
      if (cancelled) return
      scene.current = mountSkin(
        el,
        rect,
        "avatar",
        () => setDrawn(true),
        () => 1,
        {
          checked: false,
          peel: 0,
        },
      )
      if (!scene.current) return
      const breathe = () => {
        scene.current?.wake()
        frame = requestAnimationFrame(breathe)
      }
      breathe()
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  useEffect(() => scene.current?.setChecked(checked), [checked])

  return (
    <>
      <span
        ref={slot}
        className={styles.slot}
        data-drawn={drawn ? "" : undefined}
        onPointerEnter={() => setChecked(true)}
        onPointerLeave={() => setChecked(false)}
        onPointerDown={(e) => {
          setChecked(true)
          if (e.pointerType !== "mouse") window.setTimeout(() => setChecked(false), 1400)
        }}
      >
        0
      </span>
      <canvas ref={canvas} className={styles.canvas} />
    </>
  )
}
