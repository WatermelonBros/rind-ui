// stroke-input (add-signature-pad design §4): free-hand strokes from Pointer Events, as a
// sibling of pointer-drag (which maps one axis). A stroke belongs to the pointer that started
// it, by pointerId, never isPrimary (signature_pad#787, #834); moves read coalesced events
// (perfect-freehand#83); a stroke ends on up, cancel, lost capture or a move with no button
// (signature_pad#702, #723); listeners live on the owner document; points are mapped through
// the current rect, its CSS scale and zoom (signature_pad#713) into the surface's own CSS box.

import { cssZoom } from "./css-zoom"

export interface StrokeInputPoint {
  /** In the surface's CSS box (0..width, 0..height), unscaled. */
  readonly x: number
  readonly y: number
  /** 0–1; 0.5 when the device reports none. */
  readonly pressure: number
  /** The event's timestamp (ms). */
  readonly time: number
}

export type StrokeMessage =
  | {
      readonly type: "down"
      readonly pointerId: number
      readonly point: StrokeInputPoint
      readonly box: { readonly width: number; readonly height: number }
    }
  | { readonly type: "move"; readonly pointerId: number; readonly points: StrokeInputPoint[] }
  | { readonly type: "up"; readonly pointerId: number }
  | { readonly type: "cancel"; readonly pointerId: number }

interface PointerLike {
  readonly clientX: number
  readonly clientY: number
  readonly pressure: number
  readonly pointerType: string
  readonly timeStamp: number
}

/** The surface's unscaled CSS box and the rect it renders at. */
export function strokeBox(surface: HTMLElement) {
  const rect = surface.getBoundingClientRect()
  const zoom = cssZoom(surface)
  // offsetWidth is the layout size: a CSS transform scales the rect, not the layout.
  const width = surface.offsetWidth || rect.width / zoom
  const height = surface.offsetHeight || rect.height / zoom
  return { rect, width, height }
}

/** A client point in the surface's own CSS box, through the rect-to-layout ratio. */
export function strokePoint(surface: HTMLElement, e: PointerLike): StrokeInputPoint {
  const { rect, width, height } = strokeBox(surface)
  const sx = rect.width > 0 ? width / rect.width : 1
  const sy = rect.height > 0 ? height / rect.height : 1
  // A mouse reports pressure 0.5 while a button is down; a pen or touch its own (0 = unknown).
  const pressure = e.pressure > 0 ? e.pressure : 0.5
  return {
    x: (e.clientX - rect.left) * sx,
    y: (e.clientY - rect.top) * sy,
    pressure,
    time: e.timeStamp,
  }
}

/**
 * Starts a stroke from a `pointerdown` on `surface` and reports its points until it ends.
 * Returns the cleanup. Call it from the surface's own `pointerdown` handler.
 */
export function startStroke(
  surface: HTMLElement,
  down: PointerEvent,
  send: (message: StrokeMessage) => void,
): () => void {
  const id = down.pointerId
  const doc = surface.ownerDocument
  const { width, height } = strokeBox(surface)
  send({ type: "down", pointerId: id, point: strokePoint(surface, down), box: { width, height } })
  try {
    surface.setPointerCapture(id)
  } catch {
    // A synthetic pointer (tests, assistive technology) has no capture; document listeners hold.
  }
  let done = false
  const end = (type: "up" | "cancel") => {
    if (done) return
    done = true
    cleanup()
    send({ type, pointerId: id })
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    // No button pressed any more: the pointerup was lost (an iframe, a popup window).
    if (e.buttons === 0 && e.pointerType === "mouse") {
      end("up")
      return
    }
    const events =
      typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length > 0
        ? e.getCoalescedEvents()
        : [e]
    send({ type: "move", pointerId: id, points: events.map((c) => strokePoint(surface, c)) })
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerId === id) end("up")
  }
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId === id) end("cancel")
  }
  doc.addEventListener("pointermove", onMove)
  doc.addEventListener("pointerup", onUp)
  doc.addEventListener("pointercancel", onCancel)
  surface.addEventListener("lostpointercapture", onCancel)
  function cleanup() {
    doc.removeEventListener("pointermove", onMove)
    doc.removeEventListener("pointerup", onUp)
    doc.removeEventListener("pointercancel", onCancel)
    surface.removeEventListener("lostpointercapture", onCancel)
    try {
      if (surface.hasPointerCapture?.(id)) surface.releasePointerCapture(id)
    } catch {
      // already released
    }
  }
  return () => {
    done = true
    cleanup()
  }
}

/** Whether a `pointerdown` starts a stroke: the primary button, or a pen or touch contact. */
export const startsStroke = (e: PointerEvent) => e.pointerType !== "mouse" || e.button === 0

/**
 * iPadOS Scribble takes Apple Pencil events unless the surface's touchstart is cancelled
 * (signature_pad#518). A non-passive listener; returns the cleanup.
 */
export function preventTouchScribble(surface: HTMLElement): () => void {
  const onTouch = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault()
  }
  surface.addEventListener("touchstart", onTouch, { passive: false })
  return () => surface.removeEventListener("touchstart", onTouch)
}
