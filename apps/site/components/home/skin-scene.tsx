"use client"

import { Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import type { Kind, SkinHandle } from "./skin-gl"
import styles from "./skin-scene.module.css"

// the same list as skin-gl.ts's KINDS: repeated so this module never pulls the WebGL chunk in
const KINDS: readonly Kind[] = ["switch", "checkbox", "button"]

/**
 * The hero's one object: a real rind component, a different one per visit (app/layout.tsx picks
 * it before paint, so nothing swaps). Where WebGL 2 runs, a 3D version is drawn over it
 * (skin-gl.ts, loaded after the page; never under reduced motion or Save-Data); elsewhere the
 * same component is drawn in CSS in the same box. Scrolling peels the skin off: underneath is
 * the bare component, which is the whole point of a headless library.
 */
export function SkinScene() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const anchors = useRef<Partial<Record<Kind, HTMLElement | null>>>({})
  const scene = useRef<SkinHandle | null>(null)
  const [gl, setGl] = useState(false)
  const [on, setOn] = useState(true)
  const [presses, setPresses] = useState(0)

  useEffect(() => {
    const el = canvas.current
    const picked = document.documentElement.dataset["hero"]
    const kind = KINDS.find((k) => k === picked) ?? "switch"
    const at = anchors.current[kind]
    if (!el || !at) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // sound: Network Information is optional and absent from lib.dom, so every field may be missing
    const net = navigator as Navigator & { connection?: { saveData?: boolean } }
    if (net.connection?.saveData) return
    let cancelled = false
    let idle = 0
    // the skin comes off as the hero scrolls away
    const hero = el.parentElement
    const onScroll = () => {
      if (!hero) return
      const r = hero.getBoundingClientRect()
      scene.current?.setPeel(Math.min(1, Math.max(0, -r.top / (r.height * 0.45))))
    }
    const start = () => {
      import("./skin-gl")
        .then(({ mountSkin }) => {
          if (cancelled) return
          scene.current = mountSkin(el, at, kind, () => setGl(true), { checked: true, peel: 0 })
          onScroll()
        })
        // decoration: a failed chunk leaves the CSS component in place
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
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelled = true
      window.removeEventListener("load", schedule)
      window.removeEventListener("scroll", onScroll)
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle)
      clearTimeout(idle)
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  const toggle = (value: boolean) => {
    setOn(value)
    scene.current?.setChecked(value)
  }
  const anchor = (kind: Kind) => (node: HTMLElement | null) => {
    anchors.current[kind] = node
  }

  return (
    <>
      <canvas
        ref={canvas}
        className={styles.canvas}
        data-on={gl ? "" : undefined}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className={styles.stage} data-gl={gl ? "" : undefined}>
        <div className={styles.variant} data-kind="switch">
          <Switch.Root checked={on} onCheckedChange={toggle} className={styles.root}>
            <Switch.Control ref={anchor("switch")} className={styles.switch}>
              <Switch.Thumb className={styles.thumb} />
            </Switch.Control>
            <Switch.Label className={styles.label}>Wi-Fi</Switch.Label>
          </Switch.Root>
          <p className={styles.caption} aria-hidden="true">
            <code>data-state="{on ? "checked" : "unchecked"}"</code>
          </p>
        </div>
        <div className={styles.variant} data-kind="checkbox">
          <CheckboxGroup.Item
            checked={on}
            onCheckedChange={(value) => toggle(value === true)}
            className={styles.root}
          >
            <CheckboxGroup.ItemControl ref={anchor("checkbox")} className={styles.checkbox}>
              <CheckboxGroup.ItemIndicator className={styles.check}>✓</CheckboxGroup.ItemIndicator>
            </CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemLabel className={styles.label}>
              Keyboard ready
            </CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
          <p className={styles.caption} aria-hidden="true">
            <code>data-state="{on ? "checked" : "unchecked"}"</code>
          </p>
        </div>
        <div className={styles.variant} data-kind="button">
          <Button
            ref={anchor("button")}
            className={styles.button}
            onPress={() => setPresses((n) => n + 1)}
            onPressStart={() => scene.current?.setPress(true)}
            onPressEnd={() => scene.current?.setPress(false)}
          >
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
            <span className={styles.hidden}>Press me</span>
          </Button>
          <p className={styles.caption} aria-hidden="true">
            <code>onPress × {presses}</code>
          </p>
        </div>
        <p className={styles.note}>Scroll: the skin comes off. The behaviour stays.</p>
      </div>
    </>
  )
}
