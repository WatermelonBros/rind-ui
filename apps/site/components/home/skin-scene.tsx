"use client"

import { Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  emitTestArrived,
  getLookColors,
  getLookTarget,
  getPeelOn,
  getPeelTarget,
  getTestState,
  getTestTarget,
  onPeelOn,
  onTestState,
  setHeroOn,
  setLanded,
  setSceneGl,
  setTestLanded,
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
    let atTests = false
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
    // Final leg: once it has become the builder's component, the object leaves it again (when the
    // builder rises to a quarter of the screen), flies to the tests' control, takes the site's
    // skin back on the way, and the test runs as it lands (tested.tsx)
    const testLeg = () => {
      const look = getLookTarget()
      const test = getTestTarget()
      if (!look || !test) return null
      const y = window.scrollY
      const lr = look.getBoundingClientRect()
      const s4 = lr.top + y + lr.height / 2 - window.innerHeight * 0.25
      const tr = test.getBoundingClientRect()
      // a phone runs the test while the control is still low on the screen, so the visitor
      // sees the PASS before scrolling on
      const anchor = window.innerWidth <= 900 ? 0.68 : 0.6
      const s5 = tr.top + y + tr.height / 2 - window.innerHeight * anchor
      const t = Math.min(1, Math.max(0, (y - s4) / Math.max(1, s5 - s4)))
      const emerge = Math.min(1, Math.max(0, (y - s4) / (window.innerHeight * 0.12)))
      return { look, test, y, s4, t, emerge }
    }
    // The room right of the content frame (the builder's; the tests share its width): the
    // object flies down it at a size that fits, never under 64px across, so it neither covers
    // the panels nor shrinks to a speck
    const gutterFit = (w: number, h: number) => {
      const frame = getLookTarget()?.closest("[data-look]")?.parentElement?.getBoundingClientRect()
      const right = frame?.right ?? window.innerWidth
      const room = window.innerWidth - right - 32
      // big enough to read as the object, not debris, and 24px clear of the viewport's edge
      const k = Math.min(1, Math.max(80, room) / w)
      return { w: w * k, h: h * k, x: Math.max(right + 8, window.innerWidth - w * k - 24) }
    }
    // Desktop: between scenes the object lives in the right-hand gutter. It berths there level
    // with the builder's component and hands over to it in a cross-dissolve, then sets off from
    // the same berth for the tests: it never crosses the builder's text
    const berth = (look: DOMRect, w: number, h: number) => {
      const g = gutterFit(w, h)
      // never down by the screen reader toggle pinned in the corner
      const y = Math.min(look.y + look.height / 2 - g.h / 2, window.innerHeight - g.h - 110)
      return new DOMRect(g.x, y, g.w, g.h)
    }
    const target = () => {
      const fin = testLeg()
      if (fin && fin.y > fin.s4) {
        const live = fin.test.getBoundingClientRect()
        // a phone has no gutter: the object waits hidden on its control and appears there (alpha)
        if (atTests || window.innerWidth <= 900) return live
        // it lifts off the builder's component itself and flies on, in sight all the way
        const from = shift(fin.look.getBoundingClientRect(), fin.y - fin.s4)
        const top = window.innerHeight * 0.15
        const bottom = window.innerHeight * 0.75 - live.height
        const toY = Math.min(Math.max(live.y, top), bottom)
        const smooth = (a: number, b: number) => {
          const k = Math.min(1, Math.max(0, (fin.t - a) / (b - a)))
          return k * k * (3 - 2 * k)
        }
        // around the content, like the leg before: out to the right-hand gutter, down to the
        // control's height, then in
        const g = gutterFit(live.width, live.height)
        const out = smooth(0, 0.3)
        const across = smooth(0.65, 0.9)
        // across in the empty strip under the control's row, then up into it: the row's label
        // sits between the gutter and the control, and the object never crosses it
        const under = toY + live.height + 28
        return new DOMRect(
          lerp(lerp(from.x, g.x, out), live.x, across),
          lerp(lerp(from.y, under, smooth(0.25, 0.65)), toY, smooth(0.88, 1)),
          lerp(lerp(from.width, g.w, out), live.width, across),
          lerp(lerp(from.height, g.h, out), live.height, across),
        )
      }
      const last = lastLeg()
      if (last && last.y > last.s2) {
        const raw = last.peelEl.getBoundingClientRect()
        // desktop holds it where the machine left it (the leg starts from there); a phone lets
        // it scroll away with the machine
        const from = window.innerWidth <= 900 ? raw : shift(raw, last.y - last.s2)
        const live = last.look.getBoundingClientRect()
        if (window.innerWidth <= 900) {
          // a phone has no gutter: it scrolls away with the machine, then waits hidden on its
          // control and appears there (alpha)
          return from.bottom > 0 && last.t < 0.92 ? from : live
        }
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
        // at the size it left the machine with (the preview's control can be 16px: a speck)
        // level with the real component once it is on screen, so the hop is a short sideways move
        const end = berth(last.t >= 0.6 ? live : to, from.width, from.height)
        // from its berth it flies onto the component on a short arc, in time rather than with
        // the scroll, and the real component takes its place on touchdown
        const p = flip(last.t)
        if (p >= 0) {
          const e = p * p * (3 - 2 * p)
          // over the card, never through its text
          const arc = Math.sin(Math.PI * p) * 180
          return new DOMRect(
            lerp(end.x, live.x, e),
            lerp(end.y, live.y, e) - arc,
            lerp(end.width, live.width, e),
            lerp(end.height, live.height, e),
          )
        }
        // always in sight: up and out to the side, clear of the machine's diagram, then down the
        // gutter (passing over a container for a moment is fine; the text stays readable)
        const out = smooth(0, 0.3)
        const rise = Math.sin(Math.PI * Math.min(1, last.t / 0.4)) * from.height * 0.5
        const down = smooth(0.3, 0.72)
        return new DOMRect(
          lerp(from.x, end.x, out),
          lerp(from.y, end.y, down) - rise,
          lerp(from.width, end.width, out),
          lerp(from.height, end.height, out),
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
      // a phone keeps it in the hero until the hero has scrolled away, then it waits hidden on
      // the next control (alpha): no empty hero, no flight across the next heading
      if (window.innerWidth <= 900) return a.bottom > 0 ? a : to
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
    // the hop from the berth onto the builder's component: -1 before it, then 0→1 with the
    // scroll over the leg's last fifth, so a steady scroll always shows the arc
    const flip = (t: number) => (t < 0.8 ? -1 : Math.min(1, (t - 0.8) / 0.18))
    const alpha = () => {
      // the machine's own control shows only while the object is fading off it (below)
      getPeelTarget()?.style.removeProperty("opacity")
      // re-emerging from the builder's component for the final leg
      const fin = testLeg()
      const phone = window.innerWidth <= 900
      if (fin && fin.y > fin.s4) return phone ? (atTests ? 1 : 0) : fin.emerge
      const last = lastLeg()
      if (last && last.y > last.s2) {
        // a phone has no gutter to fly in: it hides on the way and appears on the preview
        if (phone) {
          const from = last.peelEl.getBoundingClientRect()
          // a clean swap once it has landed: a half-faded object over the control read as a ghost
          return from.bottom > 0 || (last.t >= 0.92 && last.fade === 0) ? 1 : 0
        }
        // desktop: visible all the way to its berth, then it dissolves into the component
        // the component is the object until the hop lands, then the real one takes over
        const p = flip(last.t)
        // the slot waits as a ghost of the component (never a hole) until the hop lands
        last.look.style.opacity = last.t >= 0.6 && p < 1 ? "0.25" : ""
        if (p >= 1) return 0
        return 1
      }
      if (window.innerWidth > 900) return 1
      const { next, y, s0, t } = travel()
      if (!next || y <= s0) return 1
      const a = shift(at.getBoundingClientRect(), y - s0)
      // in the hero while it is on screen, then hidden until it is on the next control
      return a.bottom > 0 || t >= 0.92 ? 1 : 0
    }
    // on touchdown the object takes the next scene's state; before, the hero's
    let leg = 0
    let presses = 0
    let pulse = 0
    const follow = () => {
      const handle = scene.current
      if (!handle) return
      if (leg === 3) {
        // the tests drive it now: the control's state, and a press for every press
        const state = getTestState()
        if (kind === "button") {
          if (state.presses > presses) {
            handle.setPress(true)
            clearTimeout(pulse)
            pulse = window.setTimeout(() => scene.current?.setPress(false), 180)
          }
        } else handle.setChecked(state.on)
        presses = state.presses
        return
      }
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
      const fin = testLeg()
      const nextLeg = fin && fin.t > 0.5 ? 3 : last && last.t > 0.5 ? 2 : past ? 1 : 0
      if (nextLeg !== leg) {
        leg = nextLeg
        follow()
      }
      if (last && scene.current) {
        const colors = getLookColors()
        // in the gutter it wears the site's own skin; it takes the builder's during the hop, as
        // one event, on its way into the component
        const k =
          window.innerWidth <= 900
            ? Math.min(1, Math.max(0, (last.t - 0.75) / 0.25))
            : Math.max(0, flip(last.t))
        scene.current.setLook(colors.brand, colors.surface, k * k * (3 - 2 * k))
        if (window.innerWidth > 900 && last.y > last.s2 && last.t > 0.2) scene.current.setPeel(0)
        // the machine scene's label does not stay behind alone
        // the machine's label stays while the machine is on screen, with whichever is drawn
        if (last.y > last.s2) setLanded(last.t < 0.3)
        else if (past) setLanded(true)
        // the component stays in place on a phone until the object appears on it; on a desktop it
        // comes in as the object dissolves at its berth
        const phone = window.innerWidth <= 900
        last.look.style.opacity =
          last.y <= last.s2
            ? ""
            : phone
              ? last.t >= 0.92 && last.fade === 0
                ? "0"
                : ""
              : last.look.style.opacity
      }
      // one control at a time: the test's own stays hidden while the object flies to it (on a
      // phone the object is hidden in flight instead, so the control shows until touchdown)
      if (fin) {
        const hide = fin.y > fin.s4 && (window.innerWidth > 900 || atTests)
        if (hide) fin.test.style.setProperty("opacity", "0", "important")
        else fin.test.style.removeProperty("opacity")
      }
      if (fin && scene.current && fin.y > fin.s4) {
        // it takes the builder's component with it, and gets the site's skin back on the way
        // the builder keeps its component: the object comes back at the berth
        fin.look.style.opacity = ""
        const k = Math.min(1, Math.max(0, (fin.t - 0.55) / 0.45))
        const back = k * k * (3 - 2 * k)
        const colors = getLookColors()
        scene.current.setLook(colors.brand, colors.surface, 1 - back)
        // whole skin from the start of the leg: a peel closing in flight draws a half-folded shape
        scene.current.setPeel(0)
      }
      // hysteresis: the control grows to the object's size on arrival, which moves the page a
      // little; without it, arrival would flicker on and off at the threshold
      const arrived = Boolean(fin && (atTests ? fin.t > 0.9 : fin.t >= 0.97))
      if (arrived !== atTests) {
        atTests = arrived
        setTestLanded(arrived)
        if (arrived) emitTestArrived()
      }
    }
    const offPeelOn = onPeelOn(follow)
    // a state change or a remounted control (a new run): follow it, wake the render loop, and
    // re-apply the hand-over to the new control
    const offTestState = onTestState(() => {
      follow()
      onScroll()
    })
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
      offTestState()
      clearTimeout(pulse)
      setTestLanded(false)
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
