"use client"

import { Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cue } from "../sound"
import { zoom } from "../zoom"
import { arc, type DockPosition, fit, hop, locate } from "./docks"
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
    // landed in its slot by the outro's Get started
    let atFinale = false
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
    // (the run's end) to where that control rests (its scene's start), eased; the page passes
    // under it. Before, it is on the hero's control; after, on the next scene's.
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const shift = (r: DOMRect, dy: number) => new DOMRect(r.x, r.y + dy, r.width, r.height)
    const travel = () => {
      const next = getPeelTarget()
      const scene = next?.closest("section")
      const y = window.scrollY
      // a phone has no hold: the object stays on its control until the hero has nearly gone
      // (its bottom at 40% of the screen), so its empty place is never seen
      const s0 =
        run.getBoundingClientRect().bottom +
        y -
        window.innerHeight * (window.innerWidth <= 900 ? 0.4 : 1)
      const s1 = scene ? scene.getBoundingClientRect().top + y : Number.POSITIVE_INFINITY
      // land three quarters of the way (half on a phone, whose scene starts sooner: peel.tsx),
      // then ride along with the control into its scene
      const land = s0 + (s1 - s0) * (window.innerWidth <= 900 ? 0.5 : 0.75)
      return { next, y, s0, land, t: Math.min(1, Math.max(0, (y - s0) / Math.max(1, land - s0))) }
    }
    // a small overshoot when it touches down, so the landing reads as an event
    let landedAt = 0
    const settle = () => {
      if (!landedAt) return 1
      const k = (performance.now() - landedAt) / 260
      return k >= 1 ? 1 : 1 + 0.05 * Math.sin(k * Math.PI) * (1 - k)
    }
    // After the machine the object stops only at docks, places in the content (docks.ts): the
    // builder's preview, the test's control, the install's core, the agents' rendered reply,
    // the wall's component and the outro's slot. It is never parked beside the content.
    const vh = () => window.innerHeight
    const phone = () => window.innerWidth <= 900
    const centre = (r: DOMRect) => r.top + r.height / 2
    // the object's own proportions (its hero control): a dock that is not a control of its kind
    // (the install's core) takes a box of that shape
    const aspect = () => {
      const r = at.getBoundingClientRect()
      return r.width / Math.max(1, r.height)
    }
    interface Dock {
      readonly id: "machine" | "look" | "test" | "core" | "agents" | "wall" | "finale"
      readonly el: () => HTMLElement | null
      /** where the object is drawn on it (the element's own box by default) */
      readonly box?: (r: DOMRect) => DOMRect
      /** the screen line (0 top, 1 bottom) its centre comes up to as the object arrives */
      readonly arrive: number
      /** where its centre stops instead (viewport pixels), when a sticky scene holds it short of
       *  that line */
      readonly stops?: (el: HTMLElement, box: DOMRect) => number
      /** pixels scrolled past the moment it sets off again */
      readonly gone: (el: HTMLElement, box: DOMRect) => number
      /** stand: drawn on it for as long as it is there; melt: it dissolves into the real
       *  component there, which is the visitor's to use, and comes out of it to leave */
      readonly mode: "stand" | "melt"
    }
    const DOCKS: readonly Dock[] = [
      {
        // reached by the hero's own trip (travel); it sets off once the machine's scene ends
        id: "machine",
        el: getPeelTarget,
        arrive: 0,
        gone: (el) => vh() * 0.7 - (el.closest("section")?.getBoundingClientRect().bottom ?? vh()),
        mode: "stand",
      },
      {
        id: "look",
        el: getLookTarget,
        arrive: 0.72,
        // it stays in the preview (sticky on a desktop) while the visitor plays with the rack,
        // and leaves as the builder ends
        gone: (el) => vh() * 0.75 - (el.closest("section")?.getBoundingClientRect().bottom ?? vh()),
        mode: "melt",
      },
      {
        // it leaves the test only once the tests' band has let go (its PASS read first)
        id: "test",
        el: getTestTarget,
        arrive: phone() ? 0.68 : 0.6,
        // a desktop's test scene holds still with the control lower than that line: the object
        // lands where the hold keeps it (it hung mid-flight over the code lines)
        stops: (el, b) => {
          const hold = el.closest<HTMLElement>("[data-hold]")
          const style = hold && getComputedStyle(hold)
          if (!hold || style?.position !== "sticky") return vh() * 0.6
          const stuck = (Number.parseFloat(style.top) || 0) * zoom()
          return Math.max(vh() * 0.6, centre(b) - (hold.getBoundingClientRect().top - stuck))
        },
        gone: (el) =>
          vh() * 0.55 - (el.closest("[data-band]")?.getBoundingClientRect().bottom ?? vh()),
        mode: "stand",
      },
      {
        // it becomes the install's core, the one every framework is wired to
        id: "core",
        el: () => document.querySelector<HTMLElement>("[data-core]"),
        box: (r) => fit(r, aspect(), 0.78),
        arrive: 0.6,
        // in the core for as long as the frameworks are landing and wiring up to it
        gone: (el) => vh() * 0.45 - (el.parentElement?.getBoundingClientRect().bottom ?? vh()),
        mode: "stand",
      },
      {
        // the component the agent was asked for, rendered under its reply
        id: "agents",
        el: () => document.querySelector<HTMLElement>('[data-object-dock="agents"]'),
        arrive: 0.8,
        gone: (_, b) => vh() * 0.25 - centre(b),
        mode: "melt",
      },
      {
        // one of the catalogue: it turns the wall's component of its own kind on
        id: "wall",
        el: () => document.querySelector<HTMLElement>(`[data-object-land="${kind}"]`),
        arrive: 0.7,
        gone: (el) => vh() * 0.38 - (el.closest("li")?.getBoundingClientRect().top ?? vh()),
        mode: "melt",
      },
      {
        // the trip ends where the visitor's starts: by Get started
        id: "finale",
        el: () => document.querySelector<HTMLElement>("[data-object-finale]"),
        arrive: 0.62,
        gone: () => 0,
        mode: "stand",
      },
    ]
    // every dock measured once a frame (the scene, its opacity and the scroll handler all ask)
    let measured: {
      at: number
      y: number
      els: (HTMLElement | null)[]
      p: DockPosition | null
      boxes: (DOMRect | null)[]
    } | null = null
    const where = () => {
      const now = performance.now()
      const y = window.scrollY
      if (measured && now - measured.at < 8 && measured.y === y) return measured
      const els = DOCKS.map((d) => d.el())
      const boxes = els.map((el, i) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return DOCKS[i]?.box?.(r) ?? r
      })
      const readings = DOCKS.map((d, i) => {
        const el = els[i]
        const box = boxes[i] ?? null
        if (!el || !box) return { box: null, rest: 0, gone: 0 }
        const line = d.stops ? d.stops(el, box) : vh() * d.arrive
        return { box, rest: centre(box) - line, gone: d.gone(el, box) }
      })
      const room = document.documentElement.scrollHeight - vh() - y
      measured = { at: now, y, els, boxes, p: locate(readings, room) }
      return measured
    }
    const dockOf = (i: number | undefined) => (i === undefined ? undefined : DOCKS[i])
    // a small overshoot on every touchdown, so a landing reads as an event
    let dockedAt = 0
    let dockedKey = ""
    // Docked, it holds on: the dock it reached keeps it while the flight reads 80% and more, so a
    // control that moves under it (the test opening its accordion, pushing the switch down) takes
    // it along instead of throwing it back into the air
    let held = ""
    const leg = (p: DockPosition) => `${p.from}>${p.to}`
    const isDocked = (p: DockPosition | null): boolean =>
      p !== null && (p.t >= 1 || (held === leg(p) && p.t > 0.8))
    const settled = (b: DOMRect) => {
      const k = dockedAt ? (performance.now() - dockedAt) / 260 : 1
      const g = k >= 1 ? 1 : 1 + 0.05 * Math.sin(k * Math.PI) * (1 - k)
      return new DOMRect(
        b.x - (b.width * (g - 1)) / 2,
        b.y - (b.height * (g - 1)) / 2,
        b.width * g,
        b.height * g,
      )
    }
    const path = () => route()
    // Where it is drawn: on its path, plus where a hand has pulled it (grab, below)
    let drawn: DOMRect | null = null
    const target = () => {
      const r = path()
      drawn = r
      if (!grab.x && !grab.y) return r
      // pulled, it stretches along the pull like the rubber it is (up to a third longer)
      const sx = 1 + Math.min(0.33, Math.abs(grab.x) / 600)
      const sy = 1 + Math.min(0.33, Math.abs(grab.y) / 600)
      const w = r.width * sx
      const h = r.height * sy
      return new DOMRect(r.x + grab.x - (w - r.width) / 2, r.y + grab.y - (h - r.height) / 2, w, h)
    }
    // The object can be caught anywhere on its trip (a fine pointer, motion allowed): a press
    // on it, where nothing usable lies under it, flips it for a moment (the switch and the
    // checkbox toggle, the button presses), with its sound; a drag pulls it off its path and a
    // spring brings it back on release. Where it stands on its own control, that control takes
    // the press as usual.
    const grab = { x: 0, y: 0, down: false, sx: 0, sy: 0, moved: false, spring: 0 }
    let checkedNow = true
    const fine = matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)")
    // "free" over empty ground, "control" where a usable element lies under it (its own control,
    // in the hero and the scenes it stands on), false off the object
    const over = (e: PointerEvent): "free" | "control" | false => {
      if (!fine.matches || !drawn || alpha() < 0.5) return false
      const r = new DOMRect(drawn.x + grab.x, drawn.y + grab.y, drawn.width, drawn.height)
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        return false
      const under = document.elementFromPoint(e.clientX, e.clientY)
      return under?.closest("a, button, input, textarea, select, label, [role], [tabindex]")
        ? "control"
        : "free"
    }
    // over a control a press stays the control's (a click toggles it) unless the pointer moves
    // off by a few pixels: then it is a drag of the object, and the click it would end in is
    // swallowed
    let armed: { x: number; y: number } | null = null
    let swallow = false
    const onClickCapture = (e: MouseEvent) => {
      if (!swallow) return
      swallow = false
      e.preventDefault()
      e.stopPropagation()
    }
    const poke = () => {
      const handle = scene.current
      if (!handle) return
      if (kind === "button") {
        handle.setPress(true)
        cue("on")
        window.setTimeout(() => scene.current?.setPress(false), 180)
        return
      }
      checkedNow = !checkedNow
      handle.setChecked(checkedNow)
      cue(checkedNow ? "on" : "off")
      // back to what its trip says it is, a moment later
      window.setTimeout(follow, 1100)
    }
    const onGrabDown = (e: PointerEvent) => {
      const where = over(e)
      if (!where) return
      if (where === "control") {
        armed = { x: e.clientX, y: e.clientY }
        return
      }
      e.preventDefault()
      cancelAnimationFrame(grab.spring)
      grab.down = true
      grab.moved = false
      grab.sx = e.clientX - grab.x
      grab.sy = e.clientY - grab.y
      document.body.style.cursor = "grabbing"
    }
    // The page's skin comes off with the object: pulled away from its place, the whole page is
    // left bare, the browser's own look (globals.css: html[data-stripped]), opening from the
    // pointer; let go, and the skin comes back the same way
    let stripped = false
    let lastPull: [number, number] = [0, 0]
    const strip = (on: boolean, x: number, y: number) => {
      stripped = on
      const root = document.documentElement
      const flip = () => root.toggleAttribute("data-stripped", on)
      cue("peel", { value: on ? 1 : 0 })
      const vt = (
        document as Document & { startViewTransition?: (f: () => void) => { ready: Promise<void> } }
      ).startViewTransition
      if (!vt) return flip()
      const t = vt.call(document, flip)
      // dressed again on release: the browser's short crossfade (a disc opening from the pointer
      // cut the springing object in half, half the page bare and half dressed)
      if (!on) return
      t.ready.then(
        () =>
          root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${Math.hypot(window.innerWidth, window.innerHeight)}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 650,
              easing: "cubic-bezier(0.7, 0, 0.2, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          ),
        () => {},
      )
    }
    const onGrabMove = (e: PointerEvent) => {
      if (armed && !grab.down && Math.hypot(e.clientX - armed.x, e.clientY - armed.y) > 6) {
        cancelAnimationFrame(grab.spring)
        grab.down = true
        grab.moved = true
        grab.sx = armed.x - grab.x
        grab.sy = armed.y - grab.y
        armed = null
        swallow = true
        // the control under it had started a press: it is a drag now, so the press is
        // cancelled (rind's press ends on pointerup, before the click swallowed below)
        document.dispatchEvent(
          new PointerEvent("pointercancel", { bubbles: true, pointerId: e.pointerId }),
        )
        window.getSelection()?.removeAllRanges()
        document.body.style.cursor = "grabbing"
      }
      if (grab.down) {
        // kept whole on screen: a pull never loses it past an edge (32px, since the drawn
        // object, its depth and shadow, runs past the box it is fitted to)
        const r = drawn
        grab.x = r
          ? Math.min(window.innerWidth - r.right - 32, Math.max(32 - r.left, e.clientX - grab.sx))
          : e.clientX - grab.sx
        grab.y = r
          ? Math.min(window.innerHeight - r.bottom - 32, Math.max(80 - r.top, e.clientY - grab.sy))
          : e.clientY - grab.sy
        if (Math.hypot(grab.x, grab.y) > 4 && !grab.moved) {
          grab.moved = true
          // the release must not land as a click on what lies under the pointer then
          swallow = true
          // nor the real control show through where the object was pulled from
          stage.current?.toggleAttribute("data-pulled", true)
        }
        // pulled far enough, it takes the page's skin with it (strip)
        if (!stripped && Math.hypot(grab.x, grab.y) > 60) strip(true, e.clientX, e.clientY)
        lastPull = [e.clientX, e.clientY]
        scene.current?.wake()
        return
      }
      document.body.style.cursor = over(e) ? "grab" : ""
    }
    const onGrabUp = () => {
      armed = null
      // the swallowed click comes right after the release, or not at all
      if (swallow) window.setTimeout(() => (swallow = false), 50)
      if (!grab.down) return
      grab.down = false
      document.body.style.cursor = ""
      stage.current?.removeAttribute("data-pulled")
      if (stripped) strip(false, lastPull[0], lastPull[1])
      if (!grab.moved) {
        grab.x = 0
        grab.y = 0
        poke()
        return
      }
      // a spring home: overshoots a little and settles on its path
      let vx = 0
      let vy = 0
      const step = () => {
        vx = (vx + -grab.x * 0.12) * 0.78
        vy = (vy + -grab.y * 0.12) * 0.78
        grab.x += vx
        grab.y += vy
        scene.current?.wake()
        if (Math.hypot(grab.x, grab.y) + Math.hypot(vx, vy) < 0.5) {
          grab.x = 0
          grab.y = 0
          return
        }
        grab.spring = requestAnimationFrame(step)
      }
      grab.spring = requestAnimationFrame(step)
    }
    // The hero shows what it is once, by itself: a visitor who has done nothing for a few
    // seconds at the top sees the object pulled off its place, the page come off with it, and
    // the spring bring both back (the same pull a hand makes; never again once they act)
    let demoed = false
    const quiet = () => {
      demoed = true
      clearTimeout(demoTimer)
    }
    const demo = () => {
      if (demoed || grab.down || window.scrollY > 40 || !fine.matches || !drawn || document.hidden)
        return
      demoed = true
      const cx = drawn.x + drawn.width / 2
      const cy = drawn.y + drawn.height / 2
      const start = performance.now()
      stage.current?.toggleAttribute("data-pulled", true)
      const pull = (now: number) => {
        const k = Math.min(1, (now - start) / 560)
        const e = 1 - (1 - k) ** 3
        grab.x = -130 * e
        grab.y = 36 * e
        lastPull = [cx + grab.x, cy + grab.y]
        if (!stripped && k > 0.45) strip(true, lastPull[0], lastPull[1])
        scene.current?.wake()
        if (k < 1) grab.spring = requestAnimationFrame(pull)
        else
          demoTimer = window.setTimeout(() => {
            // let go, as a hand would: the page dresses again and the spring takes it home
            grab.down = true
            grab.moved = true
            onGrabUp()
          }, 1100)
      }
      grab.spring = requestAnimationFrame(pull)
    }
    let demoTimer = window.setTimeout(demo, 3200)
    for (const type of ["pointerdown", "keydown", "wheel", "touchstart"] as const)
      window.addEventListener(type, quiet, { once: true, passive: true })
    window.addEventListener("pointerdown", onGrabDown, true)
    window.addEventListener("pointermove", onGrabMove, { passive: true })
    window.addEventListener("pointerup", onGrabUp)
    window.addEventListener("click", onClickCapture, true)
    // A scroll that stops mid-flight never leaves the object hanging over the copy: once the
    // page has been still a moment, it glides on to the nearer of its two docks (the scroll
    // still decides where it is: this is only where it is drawn), and back onto its path as the
    // scroll goes on
    let lastScroll = 0
    let settleK = 0
    const flown = (t: number) => {
      const goal = performance.now() - lastScroll > 200 ? 1 : 0
      settleK += (goal - settleK) * (goal ? 0.1 : 0.3)
      if (Math.abs(goal - settleK) > 0.002) scene.current?.wake()
      const k = settleK * settleK * (3 - 2 * settleK)
      return t + ((t < 0.5 ? 0 : 1) - t) * k
    }
    let shownT = 0
    const route = () => {
      const { p, boxes } = where()
      const from = p ? boxes[p.from] : null
      const to = p ? boxes[p.to] : null
      if (p && from && to) {
        if (isDocked(p)) return settled(to)
        // where it is drawn along the flight (alpha reads the same, this frame)
        shownT = flown(p.t)
        if (phone()) return hop(from, to, shownT).box
        // one throw from dock to dock, higher the further it goes (a short hop barely lifts)
        const reach = Math.hypot(centre(to) - centre(from), to.x - from.x)
        return arc(from, to, shownT, Math.min(vh() * 0.16, reach * 0.35))
      }
      // before the machine lets go: the hero, then the hero's trip to the machine's control
      const { next, y, s0, t } = travel()
      const start = at.getBoundingClientRect()
      if (!next || y <= s0) return start
      const end = next.getBoundingClientRect()
      if (t >= 1) {
        const g = settle()
        const w = end.width * g
        const h = end.height * g
        return new DOMRect(end.x - (w - end.width) / 2, end.y - (h - end.height) / 2, w, h)
      }
      const a = shift(start, y - s0)
      if (phone()) return hop(a, end, t).box
      const e = t * t * (3 - 2 * t)
      return new DOMRect(
        lerp(a.x, end.x, e),
        lerp(a.y, end.y, e),
        lerp(a.width, end.width, e),
        lerp(a.height, end.height, e),
      )
    }
    const alpha = () => {
      // the machine's own control shows only while the object is fading off it
      getPeelTarget()?.style.removeProperty("opacity")
      const { p, boxes } = where()
      const from = p ? boxes[p.from] : null
      const to = p ? boxes[p.to] : null
      if (!p || !from || !to) {
        // a phone's hero → machine hop
        const { next, y, s0, t } = travel()
        if (phone() && next && y > s0 && t < 1) {
          const a = at.getBoundingClientRect()
          return hop(a, next.getBoundingClientRect(), t).alpha
        }
        return 1
      }
      const leaving = dockOf(p.from)
      const reaching = dockOf(p.to)
      // on a dock it melts into: whole as it touches down, gone within an eighth of a screen
      if (isDocked(p))
        return reaching?.mode === "melt" ? Math.max(0, 1 - p.past / (vh() * 0.12)) : 1
      // out of a dock it melted into, it comes back over the first stretch of the flight
      const emerge = leaving?.mode === "melt" ? Math.min(1, shownT / 0.08) : 1
      return phone() ? Math.min(emerge, hop(from, to, shownT).alpha) : emerge
    }
    let presses = 0
    let pulse = 0
    // in flight it always flies as the checked component (on, with its tick): an unchecked
    // checkbox in the site's skin is a blank white square, which reads as debris
    let flying = false
    // the wall's component has been reached (and turned on) on this pass; the agents' too
    let touched = false
    // a component the object lands on as "on": pressed if it is off, without pulling focus (and
    // the page) to it; focus goes back to where the visitor had it
    const turnOn = (el: HTMLElement) => {
      const off =
        el.getAttribute("aria-checked") === "false" ||
        el.getAttribute("aria-pressed") === "false" ||
        el.getAttribute("data-state") === "unchecked"
      if (!off) return
      const had = document.activeElement
      el.focus({ preventScroll: true })
      el.click()
      if (had instanceof HTMLElement && had !== document.body) had.focus({ preventScroll: true })
      else el.blur()
    }
    const follow = () => {
      const handle = scene.current
      if (!handle) return
      const { p } = where()
      const docked = p && isDocked(p) ? dockOf(p.to)?.id : undefined
      if (docked === "test") {
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
      if (p && dockOf(p.to)?.id === "agents" && kind !== "button") {
        // on its way to the agents' preview and on it: that control's state, as the reply's
        // test leaves it (agents.tsx), off until driven
        const el = document.querySelector<HTMLElement>('[data-object-dock="agents"]')
        checkedNow =
          el?.getAttribute("aria-checked") === "true" ||
          el?.getAttribute("data-state") === "checked"
        handle.setChecked(checkedNow)
        return
      }
      if (p) {
        // after the machine: on wherever it is (the builder's preview starts on)
        if (kind === "button") handle.setPress(false)
        else {
          checkedNow = true
          handle.setChecked(true)
        }
        return
      }
      const value = past ? getPeelOn() : heroOnRef.current
      if (kind === "button") handle.setPress(past && getPeelOn())
      else {
        checkedNow = value
        handle.setChecked(value)
      }
    }
    // the real components the object stands for, and what was done to them, to undo it
    const touchedEls = new Set<HTMLElement>()
    const setOpacity = (el: HTMLElement | null | undefined, value: string | null) => {
      if (!el) return
      if (value === null) el.style.removeProperty("opacity")
      else {
        el.style.setProperty("opacity", value, "important")
        touchedEls.add(el)
      }
    }
    let legKey = ""
    // the render loop sleeps when nothing moves: woken once the scroll has been still long
    // enough for the object to settle (flown), and when the page's layout changes under it
    let idleWake = 0
    const relayout = new ResizeObserver(() => update())
    const main = document.querySelector("main")
    if (main) relayout.observe(main)
    const onScroll = () => {
      lastScroll = performance.now()
      clearTimeout(idleWake)
      idleWake = window.setTimeout(() => scene.current?.wake(), 220)
      update()
    }
    // everything the object's place decides, for a scroll or a page that changed under it
    const update = () => {
      const peel = Math.min(1, Math.max(0, peelAt()))
      scene.current?.setPeel(peel)
      scene.current?.wake()
      if (peel > 0.55 !== shown) {
        shown = !shown
        setBare(shown)
        cue("peel", { value: shown ? 1 : 0 })
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
      const { p, els } = where()
      const leaving = dockOf(p?.from)
      const reaching = dockOf(p?.to)
      const docked = isDocked(p) ? reaching?.id : undefined
      if (p && p.t >= 1) held = leg(p)
      else if (!p || held !== leg(p) || p.t <= 0.8) held = ""
      const key = p ? `${p.from}>${p.to}${docked ? ":on" : ""}` : past ? "machine" : "hero"
      if (key !== legKey) {
        legKey = key
        if (docked && dockedKey !== key) dockedAt = performance.now()
        dockedKey = docked ? key : ""
        follow()
      }
      if (p && scene.current) {
        // whole again once it leaves the machine: a peeled object in flight reads as torn
        scene.current.setPeel(0, true)
        // the machine's label goes with the object
        setLanded(false)
        // it wears the builder's skin on its way in, there, and gives it back on its way out;
        // a skin the visitor picked stays on for the rest of the trip
        const colors = getLookColors()
        const smooth = (a: number, b: number, v: number) => {
          const k = Math.min(1, Math.max(0, (v - a) / (b - a)))
          return k * k * (3 - 2 * k)
        }
        const k =
          reaching?.id === "look"
            ? smooth(0.6, 1, p.t)
            : leaving?.id === "look"
              ? 1 - smooth(0.55, 1, p.t)
              : 0
        scene.current.setLook(colors.brand, colors.surface, colors.picked ? 1 : k)
        if (colors.material) scene.current.setMaterial(colors.material)
      } else if (past) setLanded(true)
      // the real components: a melt dock's shows as a ghost of itself while the object flies to
      // it or away from it (never a hole), is gone while the object stands on it (a ghost peeking
      // out from under the object read as a smudge), and comes back whole as it dissolves
      const objectAlpha = alpha()
      for (const [i, d] of DOCKS.entries()) {
        if (d.mode !== "melt") continue
        const el = els[i]
        const on = p && p.to === i && isDocked(p)
        const near = p && ((p.to === i && p.t >= 0.6) || (p.from === i && p.t < 0.15))
        setOpacity(
          el,
          on
            ? objectAlpha > 0.5
              ? "0"
              : null
            : near
              ? String(Math.max(0.25, 1 - objectAlpha))
              : null,
        )
      }
      // the test's control: a ghost while the object flies to it, gone as it comes down on it
      const testEl = els[DOCKS.findIndex((d) => d.id === "test")]
      if (testEl) {
        const inbound = reaching?.id === "test" && p && !isDocked(p)
        // (a phone draws no object mid-hop: its control stays whole until the object grows in)
        if (inbound && p.t >= (phone() ? 0.8 : 0.6)) setOpacity(testEl, "0")
        else if (inbound && !phone()) setOpacity(testEl, "0.3")
        else setOpacity(testEl, null)
      }
      // hysteresis: the control grows to the object's size on arrival, which moves the page a
      // little; and on its way out it counts as there while it still covers the control at all
      const testRect = testEl?.getBoundingClientRect()
      const stillOver =
        leaving?.id === "test" &&
        p !== null &&
        p.t < 0.5 &&
        drawn !== null &&
        testRect !== undefined &&
        drawn.right > testRect.left &&
        drawn.left < testRect.right &&
        drawn.bottom > testRect.top &&
        drawn.top < testRect.bottom
      const arrived =
        stillOver || (reaching?.id === "test" && p !== null && p.t >= (atTests ? 0.9 : 0.97))
      if (arrived !== atTests) {
        atTests = arrived
        setTestLanded(arrived)
      }
      // the install's core gives its face to the object while it is there
      const coreAt = DOCKS.findIndex((d) => d.id === "core")
      els[coreAt]?.toggleAttribute(
        "data-docked",
        Boolean(p && ((p.to === coreAt && p.t >= 0.85) || (p.from === coreAt && p.t < 0.15))),
      )
      // the wall's card holds its skin still while the object comes in (wall-specimens.tsx), and
      // on touchdown the object turns the component on: it lands as the state it carried
      const wallAt = DOCKS.findIndex((d) => d.id === "wall")
      const wallEl = els[wallAt]
      if (wallEl) {
        wallEl
          .closest("li")
          ?.toggleAttribute(
            "data-held",
            Boolean(
              p && ((p.to === wallAt && objectAlpha > 0) || (p.from === wallAt && p.t < 0.15)),
            ),
          )
        const down = docked === "wall"
        if (down && !touched) turnOn(wallEl)
        touched = down
      }
      // (the agents' preview is driven by its own reply's test, agents.tsx)
      // the finale's touchdown: it turns on with its own sound, and Get started answers
      const home = docked === "finale"
      if (home !== atFinale) {
        atFinale = home
        els[DOCKS.length - 1]?.closest("footer")?.toggleAttribute("data-finale", home)
        if (home) {
          cue("on")
          if (kind === "button") {
            scene.current?.setPress(true)
            clearTimeout(pulse)
            pulse = window.setTimeout(() => scene.current?.setPress(false), 220)
          }
        }
      }
      const air = Boolean(p && !isDocked(p))
      if (air !== flying) {
        flying = air
        // silent: a sound on every lift-off and touchdown was all a scroll down the page heard
        follow()
      }
      // the test starts once the object has landed in its box (it runs once; tested.tsx ignores
      // repeats, and pauses so the landing and the control's change of state read first)
      if (atTests) emitTestArrived()
    }
    const offPeelOn = onPeelOn(follow)
    // the agents' preview was driven (agents.tsx): its control changed under the object
    const onAgentsDriven = () => {
      follow()
      update()
    }
    window.addEventListener("rind:agents-driven", onAgentsDriven)
    // a state change or a remounted control (a new run): follow it, wake the render loop, and
    // re-apply the hand-over to the new control
    const offTestState = onTestState(() => {
      follow()
      update()
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
          update()
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
      relayout.disconnect()
      clearTimeout(idleWake)
      offPeelOn()
      offTestState()
      clearTimeout(pulse)
      setTestLanded(false)
      window.removeEventListener("load", schedule)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("pointerdown", onGrabDown, true)
      window.removeEventListener("pointermove", onGrabMove)
      window.removeEventListener("pointerup", onGrabUp)
      clearTimeout(demoTimer)
      for (const type of ["pointerdown", "keydown", "wheel", "touchstart"] as const)
        window.removeEventListener(type, quiet)
      window.removeEventListener("rind:agents-driven", onAgentsDriven)
      window.removeEventListener("click", onClickCapture, true)
      cancelAnimationFrame(grab.spring)
      document.body.style.cursor = ""
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle)
      clearTimeout(idle)
      clearTimeout(hint)
      hero.removeAttribute("data-bare")
      document.documentElement.removeAttribute("data-stripped")
      for (const el of touchedEls) el.style.removeProperty("opacity")
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
          {bare ? (
            "Bare. Everything else stayed."
          ) : (
            <>
              The look is the only thing that comes off.{" "}
              {/* a fine pointer can drag the object, and the page's skin comes off with it */}
              <span className={styles.pull}>Pull it.</span>
            </>
          )}
        </p>
      </div>
    </>
  )
}
