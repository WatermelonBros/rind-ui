// pointer-drag: one drag lifecycle for components that move a value along an axis (Slider
// first; Splitter, Color Area, Angle Slider later). Pointer capture, document listeners that
// live only while a drag is active (base-ui#3311), cancellation (pointercancel, lost capture
// before pointerup — base-ui#1910 —, a hidden document) and the mapping from a pointer
// position to a fraction of the axis, so machines only ever see numbers.

export interface DragAxis {
  readonly axis: "horizontal" | "vertical"
  /** Mirrors a horizontal axis; ignored for a vertical one (it grows upward). */
  readonly dir: "ltr" | "rtl"
  /** Subtracted from every fraction: where the press landed relative to the dragged thumb. */
  readonly grabOffset?: number
  /** Half its size on the axis is kept clear at each end (a thumb contained in its track). */
  readonly inset?: Element | null
}

export type DragMessage =
  | { readonly type: "move"; readonly fraction: number }
  | { readonly type: "up" }
  | { readonly type: "cancel" }

interface PointerLike {
  readonly clientX: number
  readonly clientY: number
}

const px = (style: CSSStyleDeclaration, name: string) =>
  Number.parseFloat(style.getPropertyValue(name)) || 0

/** The extent of the surface's content box on the axis, minus the inset at each end. */
function extent(surface: Element, o: DragAxis) {
  const rect = surface.getBoundingClientRect()
  const style = surface.ownerDocument.defaultView?.getComputedStyle(surface)
  const insetRect = o.inset?.getBoundingClientRect()
  if (o.axis === "horizontal") {
    const half = (insetRect?.width ?? 0) / 2
    const start =
      rect.left + (style ? px(style, "border-left-width") + px(style, "padding-left") : 0)
    const end =
      rect.right - (style ? px(style, "border-right-width") + px(style, "padding-right") : 0)
    return { start: start + half, size: end - start - 2 * half }
  }
  const half = (insetRect?.height ?? 0) / 2
  const top = rect.top + (style ? px(style, "border-top-width") + px(style, "padding-top") : 0)
  const bottom =
    rect.bottom - (style ? px(style, "border-bottom-width") + px(style, "padding-bottom") : 0)
  return { start: bottom - half, size: bottom - top - 2 * half }
}

/** The raw fraction (0 to 1) of a point on the surface's axis, or null without a size. */
function rawFraction(surface: Element, p: PointerLike, o: DragAxis): number | null {
  const { start, size } = extent(surface, o)
  if (!(size > 0)) return null
  const f =
    o.axis === "horizontal"
      ? o.dir === "rtl"
        ? (start + size - p.clientX) / size
        : (p.clientX - start) / size
      : (start - p.clientY) / size
  return Number.isFinite(f) ? f : null
}

const clamp01 = (f: number) => Math.min(1, Math.max(0, f))

/** The fraction a pointer is at, after the grab offset, clamped to 0..1; null without layout. */
export function pointerFraction(surface: Element, p: PointerLike, o: DragAxis): number | null {
  const f = rawFraction(surface, p, o)
  return f === null ? null : clamp01(f - (o.grabOffset ?? 0))
}

/** A press that starts a drag: the primary mouse button, or any pen or touch contact. */
export const isDragPress = (e: { readonly pointerType: string; readonly button: number }) =>
  e.pointerType !== "mouse" || e.button === 0

/**
 * Tracks one drag from `e`: captures the pointer, listens on the owner document until the
 * drag ends, and reports moves as fractions. Returns the function that stops tracking
 * (removes every listener and releases capture), which a cancel or a release also run.
 */
export function startDrag(
  surface: Element,
  e: { readonly pointerId: number },
  o: DragAxis,
  send: (m: DragMessage) => void,
): () => void {
  return trackPointer<DragMessage & { readonly type: "move" }>(surface, e.pointerId, send, (p) => {
    const fraction = pointerFraction(surface, p, o)
    return fraction === null ? null : { type: "move", fraction }
  })
}

/**
 * One pointer's drag lifecycle; `move` maps each pointer move to a message (or none). Returns
 * the function that stops tracking. `capture: false` leaves the pointer uncaptured, so the
 * press's own target keeps its mouse events (and the focus a mousedown gives it).
 */
export function trackPointer<M extends { readonly type: string }>(
  surface: Element,
  id: number,
  send: (m: M | { readonly type: "up" } | { readonly type: "cancel" }) => void,
  move: (p: PointerEvent) => M | null,
  capture = true,
): () => void {
  const doc = surface.ownerDocument
  try {
    if (capture) surface.setPointerCapture?.(id)
  } catch {
    // An already released pointer (a synthetic event): moves still reach the document.
  }
  let active = true
  const stop = () => {
    if (!active) return
    active = false
    doc.removeEventListener("pointermove", onMove)
    doc.removeEventListener("pointerup", onUp)
    doc.removeEventListener("pointercancel", onCancel)
    doc.removeEventListener("lostpointercapture", onLost)
    doc.removeEventListener("visibilitychange", onHidden)
    try {
      if (surface.hasPointerCapture?.(id)) surface.releasePointerCapture(id)
    } catch {
      // Capture already gone.
    }
  }
  const end = (m: { readonly type: "up" } | { readonly type: "cancel" }) => {
    if (!active) return
    stop()
    send(m)
  }
  function onMove(ev: Event) {
    const p = ev as PointerEvent
    if (p.pointerId !== id) return
    // No button pressed any more: released where no pointerup reached us (an iframe edge).
    if (p.buttons === 0) return end({ type: "up" })
    const m = move(p)
    if (m !== null) send(m)
  }
  function onUp(ev: Event) {
    if ((ev as PointerEvent).pointerId === id) end({ type: "up" })
  }
  function onCancel(ev: Event) {
    if ((ev as PointerEvent).pointerId === id) end({ type: "cancel" })
  }
  function onLost(ev: Event) {
    if ((ev as PointerEvent).pointerId === id) end({ type: "cancel" })
  }
  function onHidden() {
    if (doc.visibilityState === "hidden") end({ type: "cancel" })
  }
  doc.addEventListener("pointermove", onMove)
  doc.addEventListener("pointerup", onUp)
  doc.addEventListener("pointercancel", onCancel)
  doc.addEventListener("lostpointercapture", onLost)
  doc.addEventListener("visibilitychange", onHidden)
  return stop
}

/** What a machine's drag effect reaches the press through (injected; recorded in tests). */
export interface PointerDragCapability {
  /** Starts tracking the last press; returns the cleanup. A no-op without a press. */
  track(send: (m: DragMessage) => void): () => void
}

/**
 * A press-then-track session: the part's `pointerdown` calls `press` (which measures once and
 * returns the fraction for the machine's POINTER.DOWN), the machine's drag effect calls
 * `track`. One drag at a time: a second press while tracking is ignored.
 */
export function pointerDragSession() {
  let pending: { surface: Element; pointerId: number; options: DragAxis } | null = null
  let tracking = false
  return {
    /** True while a drag is tracked (a second pointer must not start another). */
    get active() {
      return tracking
    },
    /**
     * Records a press; returns its fraction (`null` with no layout). `anchor` is the
     * fraction of the pressed thumb, so the drag keeps the offset from its centre.
     */
    press(
      surface: Element,
      e: PointerLike & { readonly pointerId: number },
      options: DragAxis & { readonly anchor?: number | undefined },
    ): number | null {
      const raw = rawFraction(surface, e, options)
      const grabOffset = raw !== null && options.anchor !== undefined ? raw - options.anchor : 0
      pending = {
        surface,
        pointerId: e.pointerId,
        options: { axis: options.axis, dir: options.dir, inset: options.inset ?? null, grabOffset },
      }
      return raw === null ? null : clamp01(raw - grabOffset)
    },
    track(send: (m: DragMessage) => void): () => void {
      const p = pending
      pending = null
      if (!p || tracking) return () => {}
      tracking = true
      const stop = startDrag(p.surface, p, p.options, (m) => {
        if (m.type !== "move") tracking = false
        send(m)
      })
      return () => {
        tracking = false
        stop()
      }
    },
  } satisfies PointerDragCapability & Record<string, unknown>
}

export type PointerDragSession = ReturnType<typeof pointerDragSession>

// --- 2D mode (Color Area): both axes at once ---

/** A point as fractions: x from the inline start (mirrored under RTL), y from the bottom. */
export interface DragPoint {
  readonly x: number
  readonly y: number
}

export type DragMessage2D =
  | { readonly type: "move"; readonly x: number; readonly y: number }
  | { readonly type: "up" }
  | { readonly type: "cancel" }

export interface DragArea {
  readonly dir: "ltr" | "rtl"
  /** Subtracted from every point: where the press landed relative to the dragged thumb. */
  readonly grabOffset?: DragPoint
}

function rawPoint(surface: Element, p: PointerLike, dir: "ltr" | "rtl"): DragPoint | null {
  const x = rawFraction(surface, p, { axis: "horizontal", dir })
  const y = rawFraction(surface, p, { axis: "vertical", dir: "ltr" })
  return x === null || y === null ? null : { x, y }
}

/** The point a pointer is at, after the grab offset, clamped to 0..1; null without layout. */
export function pointerPoint(surface: Element, p: PointerLike, o: DragArea): DragPoint | null {
  const raw = rawPoint(surface, p, o.dir)
  if (!raw) return null
  return {
    x: clamp01(raw.x - (o.grabOffset?.x ?? 0)),
    y: clamp01(raw.y - (o.grabOffset?.y ?? 0)),
  }
}

/** What a 2D machine's drag effect reaches the press through. */
export interface PointerDragCapability2D {
  track(send: (m: DragMessage2D) => void): () => void
}

/** `pointerDragSession` for two axes (design request to `pointer-drag`: `axis: "both"`). */
export function pointerDragSession2D() {
  let pending: { surface: Element; pointerId: number; options: DragArea } | null = null
  let tracking = false
  return {
    get active() {
      return tracking
    },
    /** Records a press; returns its point (`null` without layout); `anchor`: the thumb's point. */
    press(
      surface: Element,
      e: PointerLike & { readonly pointerId: number },
      options: { readonly dir: "ltr" | "rtl"; readonly anchor?: DragPoint | undefined },
    ): DragPoint | null {
      const raw = rawPoint(surface, e, options.dir)
      const grabOffset =
        raw !== null && options.anchor
          ? { x: raw.x - options.anchor.x, y: raw.y - options.anchor.y }
          : { x: 0, y: 0 }
      pending = { surface, pointerId: e.pointerId, options: { dir: options.dir, grabOffset } }
      return raw === null
        ? null
        : { x: clamp01(raw.x - grabOffset.x), y: clamp01(raw.y - grabOffset.y) }
    },
    track(send: (m: DragMessage2D) => void): () => void {
      const p = pending
      pending = null
      if (!p || tracking) return () => {}
      tracking = true
      const stop = trackPointer<DragMessage2D>(
        p.surface,
        p.pointerId,
        (m) => {
          if (m.type !== "move") tracking = false
          send(m)
        },
        (ptr) => {
          const point = pointerPoint(p.surface, ptr, p.options)
          return point === null ? null : { type: "move", ...point }
        },
      )
      return () => {
        tracking = false
        stop()
      }
    },
  } satisfies PointerDragCapability2D & Record<string, unknown>
}

export type PointerDragSession2D = ReturnType<typeof pointerDragSession2D>
