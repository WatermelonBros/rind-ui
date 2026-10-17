// swipe-gesture (add-drawer design §2): one swipe lifecycle shared by Drawer and Toast. It
// reports only discrete events (start, release, cancel) and exposes movement as CSS custom
// properties written through the CSSOM, so a drag costs no machine event and no render per
// move (base-ui#4863). Touch is tracked with touch events (iOS sends pointercancel when it
// takes a pan); mouse and pen with pointer events and pointer capture.

import type { ClockEnv, DomEnv, SchedulerEnv } from "../env/capabilities"

/** A physical direction (logical sides are resolved by the component). */
export type SwipeDirection = "up" | "down" | "left" | "right"

/** What a release reports: `direction` null means "not a swipe toward an allowed edge". */
export interface SwipeRelease {
  readonly direction: SwipeDirection | null
  /** Along the locked axis toward `direction` (CSS px; 0 without a direction). */
  readonly offset: number
  /** px/ms over the last samples (0 without a direction). */
  readonly velocity: number
  /** The element's border-box size on the locked axis. */
  readonly size: number
}

export interface SwipeTracker {
  /** Removes every listener and resets the variables (a gesture in progress is cancelled). */
  stop(): void
  /** Resets the variables to zero (the component settled after a release). */
  reset(): void
}

export interface SwipeOptions {
  readonly element: () => HTMLElement | null
  readonly directions: () => readonly SwipeDirection[]
  /** `--rind-<prefix>-swipe-x|y|progress`. */
  readonly prefix: string
  /** Parts that always start a swipe, even inside `[data-rind-no-swipe]` (a drag handle). */
  readonly alwaysFrom?: () => readonly Element[]
  readonly canStart?: (target: Element) => boolean
  onStart(e: { readonly modality: "pointer" | "touch" }): void
  onEnd(e: SwipeRelease): void
  onCancel(): void
  /** Per frame, never a machine event: the progress toward dismissal (0 to 1). */
  onProgress?(progress: number): void
}

// --- pure helpers (Node-tested) --------------------------------------------------------------

/** Movement before anything is claimed (px). */
export const SWIPE_SLOP = 6
/** One axis must dominate the other by this ratio to lock. */
export const SWIPE_AXIS_BIAS = 2
/** Reversal from the furthest point that turns a release into "no direction" (px). */
export const SWIPE_CHANGE_OF_MIND = 10
/** Velocity window and the oldest sample a release may use (ms). */
export const SWIPE_VELOCITY_WINDOW = 100
export const SWIPE_VELOCITY_MAX_AGE = 80

export type SwipeAxis = "x" | "y"

/** The locked axis once the movement passes the slop with one axis dominating; else null. */
export function lockAxis(dx: number, dy: number): SwipeAxis | null {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (Math.max(ax, ay) < SWIPE_SLOP) return null
  if (ax >= ay * SWIPE_AXIS_BIAS) return "x"
  if (ay >= ax * SWIPE_AXIS_BIAS) return "y"
  return null
}

/** Rubber band against a disallowed direction: it moves less, increasingly so. */
export const damp = (d: number) => Math.sign(d) * Math.abs(d) ** 0.5

/** The direction of a movement `d` (> 0: down / right) on `axis`. */
export const swipeDirectionOf = (axis: SwipeAxis, d: number): SwipeDirection =>
  axis === "x" ? (d >= 0 ? "right" : "left") : d >= 0 ? "down" : "up"

export interface SwipeSample {
  /** Position on the locked axis (px). */
  readonly at: number
  /** When the event arrived (ms, the environment's clock). */
  readonly t: number
}

/**
 * Release velocity (px/ms, signed on the axis) from timestamps: samples in the last
 * window, none older than the max age at release, so the same physical speed gives the
 * same velocity at any input rate (base-ui#5837). Null: no usable samples.
 */
export function releaseVelocity(samples: readonly SwipeSample[], now: number): number | null {
  const recent = samples.filter((s) => now - s.t <= SWIPE_VELOCITY_WINDOW)
  const last = recent.at(-1)
  const first = recent[0]
  if (!last || !first || now - last.t > SWIPE_VELOCITY_MAX_AGE) return null
  const dt = last.t - first.t
  return dt > 0 ? (last.at - first.at) / dt : null
}

/** A release from the gesture's numbers: direction (null on a change of mind), offset, velocity. */
export function measureRelease(input: {
  readonly axis: SwipeAxis | null
  /** Movement on the axis from the lock point (px, signed). */
  readonly delta: number
  /** The furthest movement reached toward the release direction (px, signed). */
  readonly furthest: number
  readonly samples: readonly SwipeSample[]
  readonly now: number
  readonly allowed: readonly SwipeDirection[]
  readonly size: number
}): SwipeRelease {
  const none = { direction: null, offset: 0, velocity: 0, size: input.size }
  if (input.axis === null || input.delta === 0) return none
  const direction = swipeDirectionOf(input.axis, input.delta)
  if (!input.allowed.includes(direction)) return none
  if (Math.abs(input.furthest) - Math.abs(input.delta) > SWIPE_CHANGE_OF_MIND) return none
  const v = releaseVelocity(input.samples, input.now)
  // Toward the direction only: a last instant back the other way is no flick.
  const velocity = v === null ? 0 : Math.max(0, Math.sign(input.delta) * v)
  return { direction, offset: Math.abs(input.delta), velocity, size: input.size }
}

// --- start rules -----------------------------------------------------------------------------

const TEXT_INPUTS = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
  "range",
  "file",
])

/** A press on this element never starts a swipe (text entry, a range, a file input). */
function isExempt(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return TEXT_INPUTS.has(el.type)
  return (el as HTMLElement).isContentEditable === true
}

/** The composed ancestors of `target` up to and including `root` (null: not inside it). */
function composedPath(target: Element, root: Element): Element[] | null {
  const out: Element[] = []
  let node: Node | null = target
  while (node) {
    if (node instanceof Element) out.push(node)
    if (node === root) return out
    const parent: Node | null = node.parentNode
    node = parent instanceof ShadowRoot ? parent.host : parent
  }
  return null
}

/** A non-collapsed selection intersecting `el`. */
function selecting(el: Element): boolean {
  const sel = el.ownerDocument.defaultView?.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
  return sel.getRangeAt(0).intersectsNode(el)
}

/** Remaining scroll, toward the movement, of the scrollers from the target up to the swiped element. */
function canScroll(path: readonly Element[], axis: SwipeAxis, d: number): boolean {
  for (const el of path) {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el)
    const overflow = axis === "y" ? style?.overflowY : style?.overflowX
    if (overflow !== "auto" && overflow !== "scroll") continue
    if (axis === "y") {
      // Moving the finger down scrolls toward the top.
      if (d > 0 && el.scrollTop > 0) return true
      if (d < 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
    } else {
      if (d > 0 && Math.abs(el.scrollLeft) > 0) return true
      if (d < 0 && Math.abs(el.scrollLeft) + el.clientWidth < el.scrollWidth - 1) return true
    }
  }
  return false
}

// --- tracker ---------------------------------------------------------------------------------

interface Point {
  readonly x: number
  readonly y: number
  readonly t: number
}

/**
 * Tracks swipes on `options.element()`: listens for a press on it, and to the document only
 * while a gesture is pending or active (no page-level listener at rest).
 */
export function trackSwipe(
  env: DomEnv & SchedulerEnv & ClockEnv,
  options: SwipeOptions,
): SwipeTracker {
  // The environment's clock, read when each event arrives: a fake clock in tests makes the
  // reported velocity deterministic (event timestamps cannot be faked in a real browser).
  const now = () => env.clock.now()
  const found = options.element()
  if (!found) return { stop: () => {}, reset: () => {} }
  const el: HTMLElement = found
  const doc = el.ownerDocument
  const v = (name: string) => `--rind-${options.prefix}-swipe-${name}`

  const write = (x: number, y: number, progress: number) => {
    el.style.setProperty(v("x"), `${x}px`)
    el.style.setProperty(v("y"), `${y}px`)
    el.style.setProperty(v("progress"), String(progress))
  }
  const reset = () => {
    for (const n of ["x", "y", "progress"]) el.style.removeProperty(v(n))
  }

  // One gesture's state; null at rest.
  let g: {
    readonly modality: "pointer" | "touch"
    readonly pointerId: number | null
    readonly path: readonly Element[]
    readonly start: Point
    axis: SwipeAxis | null
    /** The point the gesture locked at (movement is measured from it). */
    origin: Point | null
    delta: number
    furthest: number
    samples: SwipeSample[]
    size: number
    frame: ReturnType<SchedulerEnv["scheduler"]["requestAnimationFrame"]> | null
    progress: number
  } | null = null

  const allowed = () => options.directions()

  const sizeOn = (axis: SwipeAxis) => {
    const r = el.getBoundingClientRect()
    return axis === "x" ? r.width : r.height
  }

  /** The press's path to the element, and whether it began on a part that always starts. */
  const startAllowed = (
    target: Element,
  ): { readonly path: readonly Element[]; readonly fromHandle: boolean } | null => {
    const path = composedPath(target, el)
    if (!path) return null // a portalled popup rendered from it: outside its DOM
    const always = options.alwaysFrom?.() ?? []
    const fromHandle = path.some((p) => always.includes(p))
    if (!fromHandle) {
      if (path.some(isExempt)) return null
      if (path.some((p) => p.hasAttribute("data-rind-no-swipe"))) return null
      if (selecting(el)) return null
    }
    if (options.canStart && !options.canStart(target)) return null
    return { path, fromHandle }
  }

  const flush = () => {
    if (!g) return
    g.frame = null
    const d = g.delta
    const axis = g.axis
    if (axis === null) return
    const dir = swipeDirectionOf(axis, d)
    const ok = allowed().includes(dir)
    const shown = ok ? d : damp(d)
    const progress = ok && g.size > 0 ? Math.min(1, Math.abs(d) / g.size) : 0
    write(axis === "x" ? shown : 0, axis === "y" ? shown : 0, progress)
    if (progress !== g.progress) {
      g.progress = progress
      options.onProgress?.(progress)
    }
  }

  const schedule = () => {
    if (g && g.frame === null) g.frame = env.scheduler.requestAnimationFrame(flush)
  }

  const end = (kind: "release" | "cancel", t: number) => {
    const cur = g
    if (!cur) return
    detach()
    if (cur.frame !== null) env.scheduler.cancelAnimationFrame(cur.frame)
    g = null
    if (cur.origin === null) return // never claimed: nothing was reported
    if (kind === "cancel") {
      reset()
      options.onCancel()
      return
    }
    options.onEnd(
      measureRelease({
        axis: cur.axis,
        delta: cur.delta,
        furthest: cur.furthest,
        samples: cur.samples,
        now: t,
        allowed: allowed(),
        size: cur.size,
      }),
    )
  }

  /** A move to (x, y) at t; returns whether the gesture claims it (prevent its default). */
  const move = (x: number, y: number, t: number): boolean => {
    if (!g) return false
    if (g.origin === null) {
      const axis = lockAxis(x - g.start.x, y - g.start.y)
      if (axis === null) return false
      const d = axis === "x" ? x - g.start.x : y - g.start.y
      // Scroll comes first: a scroller between the target and the element that can still
      // scroll that way takes the movement (the gesture waits until it reaches its edge).
      if (canScroll(g.path, axis, d)) {
        g = { ...g, start: { x, y, t } }
        return false
      }
      g.axis = axis
      // Rebaseline at the lock point: the element does not jump by the slop.
      g.origin = { x, y, t }
      g.size = sizeOn(axis)
      write(0, 0, 0)
      options.onStart({ modality: g.modality })
      if (!g) return true
    }
    const o = g.origin
    if (!o || g.axis === null) return false
    const d = g.axis === "x" ? x - o.x : y - o.y
    g.delta = d
    if (Math.abs(d) > Math.abs(g.furthest)) g.furthest = d
    g.samples.push({ at: d, t })
    if (g.samples.length > 32) g.samples.shift()
    schedule()
    return true
  }

  // --- pointer (mouse, pen) ---
  function onPointerMove(e: PointerEvent) {
    if (!g || e.pointerId !== g.pointerId) return
    if (e.buttons === 0) return end("release", now())
    if (move(e.clientX, e.clientY, now())) e.preventDefault()
  }
  function onPointerUp(e: PointerEvent) {
    if (g && e.pointerId === g.pointerId) end("release", now())
  }
  function onPointerCancel(e: PointerEvent) {
    if (g && e.pointerId === g.pointerId) end("cancel", now())
  }
  // After a pointerup the gesture has already ended: a loss before it is a cancel.
  function onLostCapture(e: PointerEvent) {
    if (g && e.pointerId === g.pointerId) end("cancel", now())
  }
  // --- touch ---
  function onTouchMove(e: TouchEvent) {
    if (!g) return
    if (e.touches.length > 1) return end("cancel", now())
    const t = e.touches[0]
    if (!t) return
    // Claimed only after attribution: a cross-axis scroll is never cancelled.
    if (move(t.clientX, t.clientY, now()) && e.cancelable) e.preventDefault()
  }
  function onTouchEnd(e: TouchEvent) {
    if (g && e.touches.length === 0) end("release", now())
  }
  function onTouchCancel() {
    end("cancel", now())
  }
  function onHidden() {
    if (doc.visibilityState === "hidden") end("cancel", now())
  }

  const attach = (touch: boolean) => {
    if (touch) {
      doc.addEventListener("touchmove", onTouchMove, { passive: false })
      doc.addEventListener("touchend", onTouchEnd)
      doc.addEventListener("touchcancel", onTouchCancel)
    } else {
      doc.addEventListener("pointermove", onPointerMove)
      doc.addEventListener("pointerup", onPointerUp)
      doc.addEventListener("pointercancel", onPointerCancel)
      doc.addEventListener("lostpointercapture", onLostCapture)
    }
    doc.addEventListener("visibilitychange", onHidden)
  }
  function detach() {
    doc.removeEventListener("touchmove", onTouchMove)
    doc.removeEventListener("touchend", onTouchEnd)
    doc.removeEventListener("touchcancel", onTouchCancel)
    doc.removeEventListener("pointermove", onPointerMove)
    doc.removeEventListener("pointerup", onPointerUp)
    doc.removeEventListener("pointercancel", onPointerCancel)
    doc.removeEventListener("lostpointercapture", onLostCapture)
    doc.removeEventListener("visibilitychange", onHidden)
    const id = g?.pointerId
    if (id !== null && id !== undefined) {
      try {
        if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id)
      } catch {
        // Capture already gone.
      }
    }
  }

  function onPointerDown(e: PointerEvent) {
    // Touch goes through touch events (iOS cancels the pointer when it takes a pan).
    if (e.pointerType === "touch" || g || e.button !== 0) return
    const target = e.target instanceof Element ? e.target : null
    if (!target) return
    // Mouse and pen swipes never start on buttons and links, except a part that always
    // starts one (a drawer's handle, a button with two or more snap points).
    const start = startAllowed(target)
    if (!start) return
    const { path } = start
    const onButton = path.some((p) => p.closest("button, a[href], [role='button']") === p)
    if (onButton && !start.fromHandle) return
    g = {
      modality: "pointer",
      pointerId: e.pointerId,
      path,
      start: { x: e.clientX, y: e.clientY, t: now() },
      axis: null,
      origin: null,
      delta: 0,
      furthest: 0,
      samples: [],
      size: 0,
      frame: null,
      progress: 0,
    }
    try {
      el.setPointerCapture?.(e.pointerId)
    } catch {
      // A synthetic event: moves still reach the document.
    }
    attach(false)
  }

  function onTouchStart(e: TouchEvent) {
    if (g) {
      // A second touch point cancels.
      if (e.touches.length > 1) end("cancel", now())
      return
    }
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    const target = e.target instanceof Element ? e.target : null
    if (!t || !target) return
    const start = startAllowed(target)
    if (!start) return
    const { path } = start
    g = {
      modality: "touch",
      pointerId: null,
      path,
      start: { x: t.clientX, y: t.clientY, t: now() },
      axis: null,
      origin: null,
      delta: 0,
      furthest: 0,
      samples: [],
      size: 0,
      frame: null,
      progress: 0,
    }
    attach(true)
  }

  el.addEventListener("pointerdown", onPointerDown)
  el.addEventListener("touchstart", onTouchStart, { passive: true })

  return {
    stop() {
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("touchstart", onTouchStart)
      if (g) end("cancel", now())
      detach()
      reset()
    },
    reset,
  }
}
