"use client"

import { Button, CheckboxGroup, Switch } from "@rind-ui/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cue } from "../sound"
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
    // the WebGL object is on screen at all (no GPU: it never draws, and nothing stands in for it)
    let glOn = false
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
      // soon after the hand-over at its berth, so the gutter is never empty for long
      const s4 =
        lr.top + y + lr.height / 2 - window.innerHeight * (window.innerWidth <= 900 ? 0.25 : 0.4)
      const tr = test.getBoundingClientRect()
      // a phone runs the test while the control is still low on the screen, so the visitor
      // sees the PASS before scrolling on
      const anchor = window.innerWidth <= 900 ? 0.68 : 0.6
      const s5 = tr.top + y + tr.height / 2 - window.innerHeight * anchor
      const t = Math.min(1, Math.max(0, (y - s4) / Math.max(1, s5 - s4)))
      const emerge = Math.min(1, Math.max(0, (y - s4) / (window.innerHeight * 0.08)))
      return { look, test, y, s4, t, emerge }
    }
    // After the tests: once their band has let go (and the ticks it sends have left first), the
    // object lifts off the tests' control, rides the right-hand gutter down through the claims
    // and the agents, and ends its trip on the wall's component of its own kind, one of the
    // catalogue, where it dissolves into the real one
    const wallLeg = () => {
      const test = getTestTarget()
      const band = test?.closest("[data-band]")
      const wall = document.querySelector<HTMLElement>(`[data-object-land="${kind}"]`)
      if (!test || !band || !wall) return null
      const y = window.scrollY
      const s6 = band.getBoundingClientRect().bottom + y - window.innerHeight * 0.55
      const r = wall.getBoundingClientRect()
      const s7 = r.top + y + r.height / 2 - window.innerHeight * 0.55
      const t = Math.min(1, Math.max(0, (y - s6) / Math.max(1, s7 - s6)))
      // desktop's last move goes by where its card is, not by the leg's share: it starts once the
      // card's top edge is on screen (80% down) and is over when it is halfway up; then it fades
      const vh = window.innerHeight
      const card = wall.closest("li")?.getBoundingClientRect() ?? r
      const near = Math.min(1, Math.max(0, (vh * 0.95 - card.top) / (vh * 0.4)))
      const gone = Math.min(1, Math.max(0, (vh * 0.5 - card.top) / (vh * 0.1)))
      return { test, wall, card, y, s6, t, near, gone }
    }
    // The room right of the content frame (the builder's; the tests share its width): the
    // object flies down it at a size that fits, never under 64px across, so it neither covers
    // the panels nor shrinks to a speck
    const gutterFit = (w: number, h: number) => {
      const frame = getLookTarget()?.closest("[data-look]")?.parentElement?.getBoundingClientRect()
      const right = frame?.right ?? window.innerWidth
      // 24px off the frame: the drawn object (depth, shadow) runs past its box
      const room = window.innerWidth - right - 24 - 32
      // big enough to read as the object, not debris (it may overlap the frame's edge for that),
      // centred in the room when there is room, and always 32px clear of the viewport's edge
      const k = Math.max(112, Math.min(w, room)) / w
      const x = right + 24 + Math.max(0, (room - w * k) / 2)
      return { w: w * k, h: h * k, x: Math.min(x, window.innerWidth - w * k - 32) }
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
    // in the right-hand gutter the object never drops level with the screen-reader toggle pinned
    // in the corner (landed controls are never in the gutter, so they are not moved)
    const path = () => {
      const r = route()
      if (window.innerWidth <= 900 || r.x < window.innerWidth - 260) return r
      const floor = window.innerHeight - r.height - 120
      return r.y > floor ? new DOMRect(r.x, floor, r.width, r.height) : r
    }
    // Where it is drawn: on its path, plus where a hand has pulled it (grab, below)
    let drawn: DOMRect | null = null
    const target = () => {
      const r = path()
      drawn = r
      return grab.x || grab.y ? new DOMRect(r.x + grab.x, r.y + grab.y, r.width, r.height) : r
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
    const onGrabMove = (e: PointerEvent) => {
      if (armed && !grab.down && Math.hypot(e.clientX - armed.x, e.clientY - armed.y) > 6) {
        cancelAnimationFrame(grab.spring)
        grab.down = true
        grab.moved = true
        grab.sx = armed.x - grab.x
        grab.sy = armed.y - grab.y
        armed = null
        swallow = true
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
        if (Math.hypot(grab.x, grab.y) > 4) grab.moved = true
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
    window.addEventListener("pointerdown", onGrabDown, true)
    window.addEventListener("pointermove", onGrabMove, { passive: true })
    window.addEventListener("pointerup", onGrabUp)
    window.addEventListener("click", onClickCapture, true)
    // A phone has no gutter: in flight the object shrinks and rides the screen's right edge,
    // peeking in from it, then grows onto its next control. Every leg the same way, so it is
    // always in sight and never sits on the text.
    const ride = (from: DOMRect, to: DOMRect, t: number) => {
      const w = 60
      const h = w * (from.height / Math.max(1, from.width))
      const x = window.innerWidth - w - 12
      const edge = new DOMRect(x, clearY(x, window.innerHeight * 0.42 - h / 2, w, h), w, h)
      const smooth = (a: number, b: number) => {
        const k = Math.min(1, Math.max(0, (t - a) / (b - a)))
        return k * k * (3 - 2 * k)
      }
      const mix = (a: DOMRect, b: DOMRect, k: number) =>
        new DOMRect(
          lerp(a.x, b.x, k),
          lerp(a.y, b.y, k),
          lerp(a.width, b.width, k),
          lerp(a.height, b.height, k),
        )
      const inward = smooth(0.7, 1)
      const r = inward > 0 ? mix(edge, to, inward) : mix(from, edge, smooth(0, 0.3))
      // anywhere between its two controls, it tucks away wherever it would lie on copy (alpha)
      rodeAt = performance.now()
      covered = t > 0.02 && t < 0.9 && overText(r, [from, to])
      return r
    }
    // A phone's column of text runs to the edge the object rides: rather than lie on the words or
    // on a control the visitor could use, it tucks away over them and comes back out in the gaps
    // between blocks (the controls it leaves and lands on excepted)
    let rodeAt = 0
    let covered = false
    let tuckK = 1
    const inside = (a: DOMRect, b: DOMRect) =>
      a.x + a.width / 2 > b.left &&
      a.x + a.width / 2 < b.right &&
      a.y + a.height / 2 > b.top &&
      a.y + a.height / 2 < b.bottom
    const overText = (r: DOMRect, ends: readonly DOMRect[]) =>
      [
        [r.x + r.width / 2, r.y + r.height / 2],
        [r.x + 6, r.y + 6],
        [r.x + 6, r.y + r.height - 6],
      ].some(([px = 0, py = 0]) =>
        document.elementsFromPoint(px, py).some((el) => {
          const hit = el.closest(
            "main p, main li, main pre, main label, main h2, main h3, main input, main button, main a, main [role], main [data-scope]",
          )
          return hit !== null && !ends.some((e) => inside(e, hit.getBoundingClientRect()))
        }),
      )
    const tuck = () => {
      const want = performance.now() - rodeAt < 100 && covered ? 0 : 1
      tuckK += (want - tuckK) * 0.3
      return tuckK
    }
    // A phone's edge lane crosses right-aligned controls (the tests' Run) and the ends of titles:
    // the object slides past them, above or below, eased so it glides rather than jumps
    let laneY = Number.NaN
    const clearY = (x: number, y: number, w: number, h: number) => {
      let want = y
      for (let i = 0; i < 3; i++) {
        const hit = [
          [x + 4, want + 4],
          [x + w - 4, want + 4],
          [x + 4, want + h - 4],
          [x + w - 4, want + h - 4],
          [x + w / 2, want + h / 2],
        ]
          .flatMap(([px = 0, py = 0]) => document.elementsFromPoint(px, py))
          .map((el) =>
            el.closest(
              "main a, main button, main input, main [role]:not(section), main h2, main h3",
            ),
          )
          .find((el): el is Element => el !== null)
        if (!hit) break
        const r = hit.getBoundingClientRect()
        want = r.bottom + h + 8 < window.innerHeight * 0.85 ? r.bottom + 8 : r.top - h - 8
      }
      // never up under the bar, where it showed through as a faint trail
      want = Math.max(want, 84)
      laneY = Number.isNaN(laneY) ? want : laneY + (want - laneY) * 0.2
      return laneY
    }
    const route = () => {
      const end = wallLeg()
      if (end && end.y > end.s6) {
        const live = end.wall.getBoundingClientRect()
        if (end.t >= 1 || end.gone > 0) return live
        const from = end.test.getBoundingClientRect()
        if (window.innerWidth <= 900) {
          // a phone's wall scrolls sideways: a card out of view to the right is reached by
          // leaving through the right edge, towards it
          const off = live.left > window.innerWidth - 8
          const to = off
            ? new DOMRect(window.innerWidth + 24, live.y, live.width, live.height)
            : live
          return ride(from, to, end.t)
        }
        const smooth = (a: number, b: number) => {
          const k = Math.min(1, Math.max(0, (end.t - a) / (b - a)))
          return k * k * (3 - 2 * k)
        }
        // out to the gutter at the size that fits it, level there while the page passes; once
        // its card is on screen (near), still in the gutter, down to the card's top edge at the
        // component's own size, across the gap above the row, and down onto the component:
        // never over the wall's title, its lead or another card
        const g = gutterFit(from.width, from.height)
        const out = smooth(0, 0.15)
        const k = end.near
        const ks = (a: number, b: number) => {
          const v = Math.min(1, Math.max(0, (k - a) / (b - a)))
          return v * v * (3 - 2 * v)
        }
        const midY = window.innerHeight * 0.42 - g.h / 2
        // a card at the row's end is entered from the gutter along the component's own line,
        // crossing no other card; any other, across the gap above its row
        const row = end.wall.closest("ul")?.getBoundingClientRect()
        const last = row ? end.card.right > row.right - 8 : false
        // across the gap it keeps a size that reads as the object (a small control, Bold, would
        // make it a speck), centred on the control's line, and takes the control's own size only
        // as it lands
        const k64 = Math.max(1, 44 / Math.max(live.width, live.height))
        const tw = live.width * k64
        const th = live.height * k64
        const tx = live.x + live.width / 2 - tw / 2
        const ty = live.y + live.height / 2 - th / 2
        const edgeY = last ? ty : end.card.top - th - 10
        const shrink = ks(0, 0.4)
        const across = ks(0.4, 0.75)
        const land = ks(0.75, 1)
        return new DOMRect(
          lerp(lerp(lerp(from.x, g.x, out), tx, across), live.x, land),
          lerp(lerp(lerp(from.y, midY, out), edgeY, shrink), live.y, land),
          lerp(lerp(lerp(from.width, g.w, out), tw, shrink), live.width, land),
          lerp(lerp(lerp(from.height, g.h, out), th, shrink), live.height, land),
        )
      }
      const fin = testLeg()
      if (fin && fin.y > fin.s4) {
        const live = fin.test.getBoundingClientRect()
        if (atTests) return live
        if (window.innerWidth <= 900) return ride(fin.look.getBoundingClientRect(), live, fin.t)
        // it comes back at its berth in the gutter, level with the builder's component where it
        // handed over (alpha: emerge), and flies on from there, never across the builder
        const held = shift(fin.look.getBoundingClientRect(), fin.y - fin.s4)
        const from = berth(held, held.width, held.height)
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
        if (window.innerWidth <= 900) return ride(from, live, last.t)
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
        // at its berth, level with the builder's component, it hands over in a cross-dissolve
        // (alpha): it never goes into the builder, whose controls are the visitor's to use
        if (flip(last.t) >= 0) return end
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
      if (window.innerWidth <= 900) return ride(a, to, t)
      const e = t * t * (3 - 2 * t)
      return new DOMRect(
        lerp(a.x, to.x, e),
        lerp(a.y, to.y, e),
        lerp(a.width, to.width, e),
        lerp(a.height, to.height, e),
      )
    }
    // the hop from the berth onto the builder's component: -1 before it, then 0→1 with the
    // scroll over the leg's last fifth, so a steady scroll always shows the arc
    const flip = (t: number) => (t < 0.8 ? -1 : Math.min(1, (t - 0.8) / 0.18))
    const alpha = () => baseAlpha() * tuck()
    const baseAlpha = () => {
      // the machine's own control shows only while the object is fading off it (below)
      getPeelTarget()?.style.removeProperty("opacity")
      // dissolving into the wall's component as it touches down, gone once it has
      const end = wallLeg()
      if (end && end.y > end.s6) {
        if (window.innerWidth <= 900) return end.t < 0.92 ? 1 : Math.max(0, (1 - end.t) / 0.08)
        return 1 - end.gone
      }
      // re-emerging from the builder's component for the final leg
      const fin = testLeg()
      const phone = window.innerWidth <= 900
      if (fin && fin.y > fin.s4) return phone ? 1 : fin.emerge
      const last = lastLeg()
      if (last && last.y > last.s2) {
        // a phone rides the edge (route) and hands over to the real component as it scrolls on:
        // a clean swap, since a half-faded object over the control reads as a ghost
        if (phone) return last.fade === 0 ? 1 : 0
        // desktop: visible all the way to its berth, then it dissolves there as the component,
        // waiting as a ghost of itself (never a hole), comes up to full in its place
        const p = flip(last.t)
        last.look.style.opacity = last.t >= 0.6 && p < 1 ? String(0.25 + 0.75 * Math.max(0, p)) : ""
        // whole until the hand-over is nearly done, then gone in a breath: a long dissolve read
        // as a washed-out ghost of the object
        return p >= 0 ? Math.min(1, (1 - p) / 0.25) : 1
      }
      return 1
    }
    // on touchdown the object takes the next scene's state; before, the hero's
    let leg = 0
    let presses = 0
    let pulse = 0
    // between landings it always flies as the checked component (on, with its tick): an
    // unchecked checkbox in the site's skin is a blank white square, which reads as debris
    let flying = false
    // the wall's component has been reached (and turned on) on this pass
    let touched = false
    const follow = () => {
      const handle = scene.current
      if (!handle) return
      if ((flying || leg === 4) && kind !== "button") {
        checkedNow = true
        handle.setChecked(true)
        return
      }
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
      else {
        checkedNow = value
        handle.setChecked(value)
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
      const end = wallLeg()
      const leaving = Boolean(end && end.y > end.s6)
      const nextLeg = leaving ? 4 : fin && fin.t > 0.5 ? 3 : last && last.t > 0.5 ? 2 : past ? 1 : 0
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
        // whole again as soon as it leaves the machine: a half-peeled object in flight read as
        // torn, a bare one as a disabled placeholder
        if (window.innerWidth > 900 && last.y > last.s2) scene.current.setPeel(0, true)
        // the machine's label goes with the object: once it lifts off, a label left at the top
        // of the screen named nothing
        if (last.y > last.s2) setLanded(false)
        else if (past) setLanded(true)
        // the component stays in place on a phone until the object appears on it; on a desktop it
        // comes in as the object dissolves at its berth
        const phone = window.innerWidth <= 900
        last.look.style.opacity =
          last.y <= last.s2
            ? ""
            : phone
              ? last.t >= 0.7 && last.fade === 0
                ? "0"
                : ""
              : last.look.style.opacity
      }
      // one control at a time: the test's own stays hidden while the object flies to it (on a
      // phone, from when the object leaves the edge to come down on it)
      if (fin) {
        // a ghost of itself while the object is still far (never an empty slot by its label),
        // gone once the object comes down on it
        const flying = !leaving && fin.y > fin.s4
        const near = window.innerWidth > 900 ? fin.t >= 0.6 : fin.t >= 0.7
        if (flying && near) fin.test.style.setProperty("opacity", "0", "important")
        else if (flying) fin.test.style.setProperty("opacity", "0.3", "important")
        else fin.test.style.removeProperty("opacity")
      }
      if (fin && scene.current && fin.y > fin.s4 && !leaving) {
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
      // a brand the visitor picked stays on the object for the whole flight, hero to tests
      const colors = getLookColors()
      if (colors.picked && scene.current) scene.current.setLook(colors.brand, colors.surface, 1)
      // hysteresis: the control grows to the object's size on arrival, which moves the page a
      // little; without it, arrival would flicker on and off at the threshold
      // and on its way out it still counts as there while it covers the control at all: the
      // control showing under an object still on it read as two controls
      const testRect = getTestTarget()?.getBoundingClientRect()
      const stillOver =
        leaving &&
        atTests &&
        drawn !== null &&
        testRect !== undefined &&
        drawn.right > testRect.left &&
        drawn.left < testRect.right &&
        drawn.bottom > testRect.top &&
        drawn.top < testRect.bottom
      const arrived =
        stillOver || (!leaving && Boolean(fin && (atTests ? fin.t > 0.9 : fin.t >= 0.97)))
      if (arrived !== atTests) {
        atTests = arrived
        setTestLanded(arrived)
      }
      // its card holds its skin still while the object comes in (wall-specimens.tsx), and on
      // touchdown the object turns the component on: it lands as the state it carried
      if (end) {
        const card = end.wall.closest("li")
        card?.toggleAttribute("data-held", leaving && end.near > 0 && end.gone < 1)
        // a phone's object comes down on the component itself: the real one waits unseen
        // until the object has dissolved into it, never two controls on top of each other
        if (window.innerWidth <= 900) {
          // only while the object is really drawn there (it tucks away over controls): the
          // card is never left without its control
          const over = leaving && end.t >= 0.7 && end.t < 1 && glOn && alpha() > 0.5
          if (over) end.wall.style.setProperty("opacity", "0")
          else end.wall.style.removeProperty("opacity")
        }
        const down = leaving && (window.innerWidth <= 900 ? end.t >= 1 : end.gone >= 1)
        if (down && !touched) {
          const off =
            end.wall.getAttribute("aria-checked") === "false" ||
            end.wall.getAttribute("aria-pressed") === "false" ||
            end.wall.getAttribute("data-state") === "unchecked"
          if (off) {
            // the press must not pull focus (and the page) to the wall: a component that
            // focuses what it presses finds it focused already, without scrolling; then focus
            // goes back to where the visitor had it
            const had = document.activeElement
            end.wall.focus({ preventScroll: true })
            end.wall.click()
            if (had instanceof HTMLElement && had !== document.body)
              had.focus({ preventScroll: true })
            else end.wall.blur()
          }
        }
        touched = down
      }
      // down the gutter to the wall, in the site's own skin and whole
      if (leaving && scene.current) {
        if (!colors.picked) scene.current.setLook(colors.brand, colors.surface, 0)
        scene.current.setPeel(0)
      }
      const air = Boolean(
        (leaving && end && end.t < 1) ||
          (!leaving && fin && fin.y > fin.s4 && !atTests) ||
          (!(fin && fin.y > fin.s4) && last && last.y > last.s2 && flip(last.t) < 1),
      )
      if (air !== flying) {
        flying = air
        follow()
      }
      // the test starts once the object has landed in its box (it runs once; tested.tsx ignores
      // repeats, and pauses so the landing and the control's change of state read first)
      if (atTests) emitTestArrived()
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
              glOn = true
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
      window.removeEventListener("pointerdown", onGrabDown, true)
      window.removeEventListener("pointermove", onGrabMove)
      window.removeEventListener("pointerup", onGrabUp)
      window.removeEventListener("click", onClickCapture, true)
      cancelAnimationFrame(grab.spring)
      document.body.style.cursor = ""
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
