"use client"

import { Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  getLookColors,
  getLookTarget,
  getPeelOn,
  getPeelTarget,
  onPeelOn,
  setHeroOn,
  setLanded,
  setSceneGl,
} from "./hero-state"
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
      // land three quarters of the way, then ride along with the control into its scene
      const land = s0 + (s1 - s0) * 0.75
      return { next, y, s0, land, t: Math.min(1, Math.max(0, (y - s0) / Math.max(1, land - s0))) }
    }
    // a small overshoot when it touches down, so the landing reads as an event
    let landedAt = 0
    const settle = () => {
      if (!landedAt) return 1
      const k = (performance.now() - landedAt) / 260
      return k >= 1 ? 1 : 1 + 0.05 * Math.sin(k * Math.PI) * (1 - k)
    }
    // Last leg: once the next scene lets go (its end), the object flies to the builder's preview
    // component of its kind, taking the visitor's colours on the way; on arrival it fades into
    // that real component, which fades in under it.
    const lastLeg = () => {
      const peelEl = getPeelTarget()
      const look = getLookTarget()
      const scene = peelEl?.closest("section")
      if (!peelEl || !look || !scene) return null
      const y = window.scrollY
      const s2 = scene.getBoundingClientRect().bottom + y - window.innerHeight
      const r = look.getBoundingClientRect()
      const s3 = r.top + y + r.height / 2 - window.innerHeight * 0.5
      const t = Math.min(1, Math.max(0, (y - s2) / Math.max(1, s3 - s2)))
      // after arrival: a quarter of a screen to fade into the real component
      const fade = Math.min(1, Math.max(0, (y - s3) / (window.innerHeight * 0.25)))
      return { peelEl, look, y, s2, t, fade }
    }
    const target = () => {
      const last = lastLeg()
      if (last && last.y > last.s2) {
        const from = shift(last.peelEl.getBoundingClientRect(), last.y - last.s2)
        const live = last.look.getBoundingClientRect()
        if (last.t >= 1) return live
        // the object never leaves the screen: it waits in a visible band while the builder
        // rises to meet it, and reaches its preview component exactly on arrival
        const top = window.innerHeight * 0.18
        const bottom = window.innerHeight * 0.72 - live.height
        const to = new DOMRect(
          live.x,
          Math.min(Math.max(live.y, top), bottom),
          live.width,
          live.height,
        )
        const t = last.t
        const smooth = (a: number, b: number) => {
          const k = Math.min(1, Math.max(0, (t - a) / (b - a)))
          return k * k * (3 - 2 * k)
        }
        // three moves, around the content: out to the right-hand gutter, down to the preview
        // row's height, then in along that row (collisions on the way fade it: alpha)
        const gutter = window.innerWidth - Math.max(from.width, to.width) - 24
        const out = smooth(0, 0.3)
        const down = smooth(0.25, 0.65)
        const across = smooth(0.65, 1)
        const x = lerp(lerp(from.x, gutter, out), to.x, across)
        return new DOMRect(
          x,
          lerp(from.y, to.y, down),
          lerp(from.width, to.width, smooth(0.5, 1)),
          lerp(from.height, to.height, smooth(0.5, 1)),
        )
      }
      const { next, y, s0, t } = travel()
      const from = at.getBoundingClientRect()
      if (!next || y <= s0) return from
      const to = next.getBoundingClientRect()
      if (t >= 1) {
        const g = settle()
        const w = to.width * g
        const h = to.height * g
        return new DOMRect(to.x - (w - to.width) / 2, to.y - (h - to.height) / 2, w, h)
      }
      const a = shift(from, y - s0)
      const e = t * t * (3 - 2 * t)
      return new DOMRect(
        lerp(a.x, to.x, e),
        lerp(a.y, to.y, e),
        lerp(a.width, to.width, e),
        lerp(a.height, to.height, e),
      )
    }
    // on a phone the straight path would cross the next scene's heading: the object dissolves
    // out and back in on the way instead
    const alpha = () => {
      const last = lastLeg()
      if (last && last.y > last.s2) {
        // always visible on the way (fading over every obstacle read as a flicker); it fades
        // only at the end, into the real component
        return 1 - last.fade
      }
      if (window.innerWidth > 900) return 1
      const t = travel().t
      // a short dip in the middle of the path only
      return t <= 0 || t >= 1 ? 1 : Math.min(1, Math.abs(1 - 2 * t) * 2.5)
    }
    // on touchdown the object takes the next scene's state; before, the hero's
    let leg = 0
    const follow = () => {
      const handle = scene.current
      if (!handle) return
      // the builder's preview starts on (its switch and checkbox are checked, its button idle)
      const value = leg === 2 ? true : past ? getPeelOn() : heroOnRef.current
      if (kind === "button") handle.setPress(leg === 1 && getPeelOn())
      else handle.setChecked(value)
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
      const { t, y, s0 } = travel()
      // the hero's labels clear out before the object leaves, so it never slides over them
      stage.current?.toggleAttribute("data-travel", y > s0 - 80)
      const down = t >= 1
      if (down !== past) {
        past = down
        landedAt = down ? performance.now() : 0
        setLanded(down)
        follow()
      }
      // the last leg: the builder's colours come on, the real component fades in under the object
      const last = lastLeg()
      const nextLeg = last && last.t > 0.5 ? 2 : past ? 1 : 0
      if (nextLeg !== leg) {
        leg = nextLeg
        follow()
      }
      if (last && scene.current) {
        const colors = getLookColors()
        // the re-skin happens in view, near the panel, as one event
        const k = Math.min(1, Math.max(0, (last.t - 0.75) / 0.25))
        scene.current.setLook(colors.brand, colors.surface, k * k * (3 - 2 * k))
        // the machine scene's label does not stay behind alone
        if (last.y > last.s2) setLanded(false)
        else if (past) setLanded(true)
        last.look.style.opacity = last.y > last.s2 ? String(last.fade) : ""
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
            alpha,
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
      const look = getLookTarget()
      if (look) look.style.opacity = ""
      setSceneGl(false)
      setLanded(false)
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
