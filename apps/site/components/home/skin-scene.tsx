"use client"

import { Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { getPeelOn, getPeelTarget, onPeelOn, setHeroOn, setSceneGl } from "./hero-state"
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
  const stage = useRef<HTMLDivElement>(null)
  // the canvas lives at the body's level: the sticky hero is a stacking context, and the object
  // has to travel over the sections after it
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => setHost(document.body), [])
  const [gl, setGl] = useState(false)
  const [on, setOn] = useState(true)
  const [presses, setPresses] = useState(0)
  // the skin is off: the real attributes of the real control appear around it
  const [bare, setBare] = useState(false)
  const [attrs, setAttrs] = useState<readonly string[]>([])
  useEffect(() => {
    const picked = document.documentElement.dataset["hero"]
    const at = anchors.current[KINDS.find((k) => k === picked) ?? "switch"]
    if (!at) return
    const read = () =>
      setAttrs(
        [...at.attributes]
          .filter((a) =>
            /^(role|aria-(checked|pressed)|data-(scope|part|state|pressed))$/.test(a.name),
          )
          .map((a) => (a.value === "" ? a.name : `${a.name}="${a.value}"`)),
      )
    read()
    const mo = new MutationObserver(read)
    mo.observe(at, { attributes: true })
    return () => mo.disconnect()
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once the portal's canvas exists
  useEffect(() => {
    const el = canvas.current
    const picked = document.documentElement.dataset["hero"]
    const kind = KINDS.find((k) => k === picked) ?? "switch"
    const at = anchors.current[kind]
    const hero = stage.current?.parentElement
    const run = hero?.parentElement
    if (!el || !at || !hero || !run) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // sound: Network Information is optional and absent from lib.dom, so every field may be missing
    const net = navigator as Navigator & { connection?: { saveData?: boolean } }
    if (net.connection?.saveData) return
    let cancelled = false
    let idle = 0
    let hint = 0
    let shown = false
    let past = false
    // The skin comes off with the scroll. Desktop: while the sticky hero holds still (its run is
    // taller than the screen). Phone: as the component itself rises from 60% to 25% of the screen.
    const peelAt = () => {
      if (run.offsetHeight > hero.offsetHeight + 8) {
        const r = run.getBoundingClientRect()
        return -r.top / (run.offsetHeight - hero.offsetHeight)
      }
      const a = at.getBoundingClientRect()
      const middle = (a.top + a.height / 2) / window.innerHeight
      return (0.6 - middle) / 0.35
    }
    // Then the bare object travels to the next scene's control: from where it rested in the hero
    // (the run's end) to where that control rests (its scene's start), eased; the marquee passes
    // under it. Before, it is on the hero's control; after, on the next scene's.
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const shift = (r: DOMRect, dy: number) => new DOMRect(r.x, r.y + dy, r.width, r.height)
    const travel = () => {
      const next = getPeelTarget()
      const scene = next?.closest("section")
      const y = window.scrollY
      const s0 = run.getBoundingClientRect().bottom + y - window.innerHeight
      const s1 = scene ? scene.getBoundingClientRect().top + y : Number.POSITIVE_INFINITY
      return { next, y, s0, s1, t: Math.min(1, Math.max(0, (y - s0) / Math.max(1, s1 - s0))) }
    }
    const target = () => {
      const { next, y, s0, s1, t } = travel()
      const from = at.getBoundingClientRect()
      if (!next || y <= s0) return from
      const to = next.getBoundingClientRect()
      if (y >= s1) return to
      const a = shift(from, y - s0)
      const b = shift(to, -(s1 - y))
      const e = t * t * (3 - 2 * t)
      return new DOMRect(
        lerp(a.x, b.x, e),
        lerp(a.y, b.y, e),
        lerp(a.width, b.width, e),
        lerp(a.height, b.height, e),
      )
    }
    // from halfway, the object takes the next scene's state
    const follow = () => {
      const handle = scene.current
      if (!handle) return
      if (past) {
        if (kind === "button") handle.setPress(getPeelOn())
        else handle.setChecked(getPeelOn())
      } else {
        if (kind === "button") handle.setPress(false)
        else handle.setChecked(heroOnRef.current)
      }
    }
    const onScroll = () => {
      const peel = Math.min(1, Math.max(0, peelAt()))
      scene.current?.setPeel(peel)
      scene.current?.wake()
      if (peel > 0.55 !== shown) {
        shown = !shown
        setBare(shown)
        // the rest of the hero (wordmark, lede) follows: hero.module.css, wordmark.module.css
        hero.toggleAttribute("data-bare", shown)
      }
      const half = travel().t > 0.5
      if (half !== past) {
        past = half
        follow()
      }
    }
    const offPeelOn = onPeelOn(follow)
    const start = () => {
      import("./skin-gl")
        .then(({ mountSkin }) => {
          if (cancelled) return
          scene.current = mountSkin(
            el,
            target,
            kind,
            () => {
              setGl(true)
              setSceneGl(true)
            },
            { checked: true, peel: 0 },
          )
          onScroll()
          // a first hint that the skin comes off: it lifts a corner, then settles back
          if (peelAt() <= 0) {
            scene.current?.setPeel(0.4)
            hint = window.setTimeout(onScroll, 1600)
          }
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
      offPeelOn()
      window.removeEventListener("load", schedule)
      window.removeEventListener("scroll", onScroll)
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle)
      clearTimeout(idle)
      clearTimeout(hint)
      hero.removeAttribute("data-bare")
      setSceneGl(false)
      scene.current?.dispose()
      scene.current = null
    }
  }, [host])

  const heroOnRef = useRef(true)
  const toggle = (value: boolean) => {
    setOn(value)
    setHeroOn(value)
    heroOnRef.current = value
    scene.current?.setChecked(value)
  }
  const anchor = (kind: Kind) => (node: HTMLElement | null) => {
    anchors.current[kind] = node
  }

  return (
    <>
      {host
        ? createPortal(
            <canvas
              ref={canvas}
              className={styles.canvas}
              data-on={gl ? "" : undefined}
              aria-hidden="true"
              tabIndex={-1}
            />,
            host,
          )
        : null}
      <div ref={stage} className={styles.stage} data-gl={gl ? "" : undefined}>
        <div className={styles.variant} data-kind="switch">
          <Switch.Root checked={on} onCheckedChange={toggle} className={styles.root}>
            <Switch.Control ref={anchor("switch")} className={styles.switch}>
              <Switch.Thumb className={styles.thumb} />
            </Switch.Control>
            <Switch.Label className={styles.label}>Wi-Fi</Switch.Label>
          </Switch.Root>
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
        {/* the skeleton, labelled: what the bare component really carries (decorative copy of the DOM) */}
        <ul className={styles.attrs} data-shown={bare ? "" : undefined} aria-hidden="true">
          {attrs.map((a, i) => (
            <li key={a} style={{ "--i": i } as CSSProperties}>
              {a}
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          {bare ? "Bare. Everything else stayed." : "The look is the only thing that comes off."}
        </p>
      </div>
    </>
  )
}
