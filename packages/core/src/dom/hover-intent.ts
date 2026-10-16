// Hover intent in the DOM (hover-intent spec). While closed only the trigger's own handlers
// exist: a real pointer movement (pointermove, mouse or pen) over the trigger starts hover;
// boundary events after a scroll carry no movement and are ignored (ariakit#1662). While
// open, `track()` follows the pointer on the document: the zone is the trigger, the layer's
// elements, its descendant layers (composed path, so shadow roots count) and a grace polygon
// from the exit point to the element the pointer heads for — Radix's narrow polygon, not the
// hull of both rectangles (reka-ui#2203). Scroll and resize re-check the last position;
// leaving the document or the window losing focus count as leaving.
//
// STABLE API (see env/hover-intent.ts).

import type {
  DomEnv,
  ModalityEnv,
  PlatformInfo,
  SchedulerEnv,
  TimerHandle,
} from "../env/capabilities"
import type { HoverIntent, HoverIntentTrackOptions } from "../env/hover-intent"
import type { RectLike } from "../env/position"
import { isEmulatedMouse } from "./hover"
import { getLayerStack } from "./layer-stack"
import { registerReset } from "./resets"

type Point = { readonly x: number; readonly y: number }

const KEY = Symbol.for("rind-ui.hover-intent@1")
/** Pixels added on both sides of the exit point. */
const EXIT_PADDING = 4

/** Per document: the grace polygon the pointer is travelling in, if any. */
interface Transit {
  polygon: readonly Point[] | null
  /** The last pointer position a trigger saw (tracking starts from it, before any move). */
  pointer: Point | null
}
const transitOf = (doc: Document): Transit => {
  let t = Reflect.get(doc, KEY) as Transit | undefined
  if (!t) {
    t = { polygon: null, pointer: null }
    Reflect.set(doc, KEY, t)
  }
  return t
}
registerReset(() => {
  if (typeof document !== "undefined") Reflect.deleteProperty(document, KEY)
})

const isHoverPointer = (type: string) => type === "mouse" || type === "pen"

/** Ray casting. */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point // in bounds: i < length
    const b = polygon[j] as Point // in bounds: j < length
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/** Andrew's monotone chain. */
function hull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (sorted.length <= 2) return sorted
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const half = (list: Point[]) => {
    const out: Point[] = []
    for (const p of list) {
      while (out.length >= 2 && cross(out.at(-2) as Point, out.at(-1) as Point, p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/**
 * The grace polygon: the exit point padded on both sides of the direction it left the
 * source by, and the target's corners; empty when that side does not face the target.
 */
export function gracePolygon(
  exit: Point,
  source: RectLike,
  target: RectLike,
  /** The pointer's last movement before the exit, when known. */
  motion?: { readonly dx: number; readonly dy: number },
): Point[] {
  const distances = {
    top: Math.abs(source.top - exit.y),
    bottom: Math.abs(source.bottom - exit.y),
    left: Math.abs(source.left - exit.x),
    right: Math.abs(source.right - exit.x),
  }
  const facing = (s: keyof typeof distances) =>
    s === "top"
      ? target.bottom <= source.top + 1
      : s === "bottom"
        ? target.top >= source.bottom - 1
        : s === "left"
          ? target.right <= source.left + 1
          : target.left >= source.right - 1
  const sides = Object.keys(distances) as (keyof typeof distances)[]
  const nearest = sides.reduce((a, b) => (distances[a] <= distances[b] ? a : b))
  const heading = (s: keyof typeof distances) =>
    motion !== undefined &&
    (s === "top"
      ? motion.dy < 0
      : s === "bottom"
        ? motion.dy > 0
        : s === "left"
          ? motion.dx < 0
          : motion.dx > 0)
  // Leaving by a side that does not face the target is heading elsewhere: no grace area
  // (a wide card above must not cover the trigger's neighbours, reka-ui#2203) — unless the
  // pointer moves towards a side that does (out near a corner, into a flipped submenu:
  // radix#4036).
  const side = facing(nearest) ? nearest : sides.find((s) => facing(s) && heading(s))
  if (!side) return []
  const p = EXIT_PADDING
  const padded: Point[] =
    side === "top" || side === "bottom"
      ? [
          { x: exit.x - p, y: exit.y + (side === "top" ? p : -p) },
          { x: exit.x + p, y: exit.y + (side === "top" ? p : -p) },
        ]
      : [
          { x: exit.x + (side === "left" ? p : -p), y: exit.y - p },
          { x: exit.x + (side === "left" ? p : -p), y: exit.y + p },
        ]
  const corners: Point[] = [
    { x: target.left, y: target.top },
    { x: target.right, y: target.top },
    { x: target.right, y: target.bottom },
    { x: target.left, y: target.bottom },
  ]
  return hull([...padded, ...corners])
}

/** The bounding box of elements' rectangles. */
function boxOf(elements: readonly Element[]): RectLike | null {
  const rects = elements.map((e) => e.getBoundingClientRect()).filter((r) => r.width || r.height)
  if (rects.length === 0) return null
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.right))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top }
}

type Env = DomEnv & SchedulerEnv & ModalityEnv & PlatformInfo

export function domHoverIntent(env: Env): HoverIntent {
  const docOf = () => {
    const root = env.dom.getRootNode()
    return "body" in root ? root : root.ownerDocument
  }

  function track(o: HoverIntentTrackOptions): () => void {
    const doc = docOf()
    const win = doc.defaultView
    const transit = transitOf(doc)
    // Where a trigger last saw the pointer, when it is on this trigger: it may rest there
    // until the layer opens (a keyboard-opened layer starts with no pointer of its own).
    const seen = transit.pointer
    const box = o.trigger()?.getBoundingClientRect()
    const onTrigger =
      seen !== null &&
      box !== undefined &&
      seen.x >= box.left &&
      seen.x <= box.right &&
      seen.y >= box.top &&
      seen.y <= box.bottom
    let last: Point | null = onTrigger ? seen : null
    /** Where the pointer was last: inside the trigger, the layer, or outside both. */
    let region: "trigger" | "layer" | "outside" =
      onTrigger || o.trigger()?.matches(":hover") ? "trigger" : "outside"
    let polygon: Point[] | null = null
    let left = false
    let rest: TimerHandle | null = null
    let pending: TimerHandle | null = null

    const own = () => o.elements().filter((e) => e.isConnected)
    const containsTarget = (path: readonly EventTarget[], el: Element | null) =>
      el !== null && path.includes(el)
    const regionOf = (path: readonly EventTarget[], target: EventTarget | null): typeof region => {
      if (containsTarget(path, o.trigger())) return "trigger"
      if (own().some((e) => path.includes(e))) return "layer"
      // A descendant layer's elements (a portalled child tooltip or listbox).
      if (o.layer.contains(target)) return "layer"
      return "outside"
    }
    const setPolygon = (next: Point[] | null) => {
      polygon = next
      transit.polygon = next
      if (rest !== null) env.scheduler.clearTimeout(rest)
      rest = null
    }
    const restart = () => {
      if (rest !== null) env.scheduler.clearTimeout(rest)
      rest = null
      if (polygon && o.restMs !== undefined) {
        rest = env.scheduler.setTimeout(() => {
          setPolygon(null)
          leave()
        }, o.restMs)
      }
    }
    const stack = getLayerStack(doc)
    /** Any open layer opened from this one, of any kind (a select's listbox, a menu). */
    const hasOpenChild = () =>
      stack.layers().some((l) => {
        for (let p = l.parentId; p; p = stack.get(p)?.parentId) if (p === o.layer.id) return true
        return false
      })
    const leave = () => {
      if (left) return
      // An open descendant layer keeps this one open (radix#3175).
      if (hasOpenChild()) return
      left = true
      o.onLeave()
    }
    const enter = () => {
      if (!left) return
      left = false
      o.onEnter()
    }
    const targetRect = (to: "trigger" | "layer") =>
      to === "trigger"
        ? (o.trigger()?.getBoundingClientRect() ?? null)
        : (o.target?.() ?? boxOf(own()))
    const sourceRect = (from: "trigger" | "layer") =>
      from === "trigger" ? (o.trigger()?.getBoundingClientRect() ?? null) : boxOf(own())

    /**
     * One pointer position with what is under it. `grace`: leaving the trigger or the layer
     * opens a grace area (a real movement); a scroll or resize re-check never does.
     */
    const update = (
      p: Point,
      path: readonly EventTarget[],
      target: EventTarget | null,
      grace = true,
    ) => {
      const now = regionOf(path, target)
      const was = region
      const previous = last
      last = p
      region = now
      if (now !== "outside") {
        setPolygon(null)
        enter()
        return
      }
      if (was !== "outside" && grace) {
        // Just left the trigger or the layer: a grace area towards the other one.
        const source = sourceRect(was)
        const dest = targetRect(was === "trigger" ? "layer" : "trigger")
        const motion = previous ? { dx: p.x - previous.x, dy: p.y - previous.y } : undefined
        const area = source && dest ? gracePolygon(p, source, dest, motion) : []
        setPolygon(area.length > 0 ? area : null)
      }
      if (polygon && pointInPolygon(p, polygon)) {
        restart()
        return
      }
      setPolygon(null)
      leave()
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isHoverPointer(e.pointerType)) return
      transit.pointer = { x: e.clientX, y: e.clientY }
      update({ x: e.clientX, y: e.clientY }, e.composedPath(), e.target)
    }
    /** Scroll or resize under a resting pointer: what is under it now? */
    const reevaluate = () => {
      if (!last) {
        // Never hovered since it opened (opened by keyboard focus): scrolling is not ours.
        if (region === "outside") return
        // No movement since it opened (the pointer rested on the trigger): ask :hover, two
        // frames later — browsers update it after the scroll, not during its event.
        if (pending !== null) return
        pending = env.scheduler.requestAnimationFrame(() => {
          pending = env.scheduler.requestAnimationFrame(() => {
            pending = null
            if (last) return
            const hovered = [o.trigger(), ...own()].some((e) => e?.matches(":hover"))
            // An open child layer blocks the leave itself.
            if (!hovered) {
              setPolygon(null)
              region = "outside"
              leave()
            }
          })
        })
        return
      }
      const hit = doc.elementFromPoint(last.x, last.y)
      const path: EventTarget[] = []
      for (let n: Node | null = hit; n; ) {
        path.push(n)
        n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null)
      }
      setPolygon(null)
      update(last, path, hit, false)
    }
    const onDocumentLeave = () => {
      setPolygon(null)
      region = "outside"
      leave()
    }

    doc.addEventListener("pointermove", onPointerMove, { capture: true, passive: true })
    doc.addEventListener("scroll", reevaluate, { capture: true, passive: true })
    doc.documentElement.addEventListener("pointerleave", onDocumentLeave)
    win?.addEventListener("resize", reevaluate)
    win?.visualViewport?.addEventListener("resize", reevaluate)
    win?.addEventListener("blur", onDocumentLeave)
    return () => {
      if (pending !== null) env.scheduler.cancelAnimationFrame(pending)
      setPolygon(null)
      doc.removeEventListener("pointermove", onPointerMove, { capture: true })
      doc.removeEventListener("scroll", reevaluate, { capture: true })
      doc.documentElement.removeEventListener("pointerleave", onDocumentLeave)
      win?.removeEventListener("resize", reevaluate)
      win?.visualViewport?.removeEventListener("resize", reevaluate)
      win?.removeEventListener("blur", onDocumentLeave)
    }
  }

  return {
    track,
    isInTransit: (doc) => transitOf(doc).polygon !== null,
    triggerProps(send) {
      // The touch watcher must see the FIRST tap, before any emulated mouse event follows it.
      if (typeof document !== "undefined") isEmulatedMouse(env, docOf())
      // One HOVER.START per stay on the trigger, not one per movement.
      let hovering = false
      return {
        onPointerMove(e) {
          if (!isHoverPointer(e.pointerType)) return
          const doc = (e.currentTarget as Element | null)?.ownerDocument
          if (doc && e.clientX !== undefined && e.clientY !== undefined) {
            transitOf(doc).pointer = { x: e.clientX, y: e.clientY }
          }
          if (hovering) return
          if (isEmulatedMouse(env, doc)) return
          // Crossing another trigger on the way into an open layer's grace area.
          if (doc && transitOf(doc).polygon !== null) return
          hovering = true
          send({ type: "HOVER.START" })
        },
        onPointerLeave(e) {
          if (!hovering || !isHoverPointer(e.pointerType)) return
          hovering = false
          send({ type: "HOVER.END" })
        },
      }
    },
  }
}
