// crop-gestures (add-image-cropper design §3): the DOM side of an Image Cropper's viewport. It
// measures the viewport, turns pointers into drags of the selection, a handle or the image
// (the target is found by part, never by position), a wheel notch into a zoom step at the
// pointer, and two touch pointers into a pinch. Coordinates are viewport px.

export type CropDragTarget =
  | "selection"
  | "image"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"

export interface CropGestureHandlers {
  readonly onSize: (size: { width: number; height: number }) => void
  readonly onDragStart: (target: CropDragTarget, x: number, y: number) => void
  readonly onDragMove: (x: number, y: number, lockRatio: boolean) => void
  readonly onDragEnd: () => void
  readonly onWheel: (direction: 1 | -1, at: { x: number; y: number }) => void
  readonly onPinchStart: (distance: number) => void
  readonly onPinchMove: (distance: number, center: { x: number; y: number }) => void
  readonly onPinchEnd: () => void
}

const HANDLES = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"])

/** The drag target under a pointer: a handle by its position, the selection, else the image. */
function targetOf(el: Element | null): CropDragTarget {
  const handle = el?.closest('[data-scope="image-cropper"][data-part="handle"]')
  const position = handle?.getAttribute("data-position") ?? ""
  if (HANDLES.has(position) && handle?.getAttribute("data-disabled") === null) {
    return position as CropDragTarget
  }
  if (el?.closest('[data-scope="image-cropper"][data-part="selection"]')) return "selection"
  return "image"
}

export function cropGestures(viewport: HTMLElement, h: CropGestureHandlers): () => void {
  const win = viewport.ownerDocument.defaultView
  const local = (e: { clientX: number; clientY: number }) => {
    const r = viewport.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const pointers = new Map<number, { x: number; y: number }>()
  let dragging = false
  let pinching = false
  const pinch = () => {
    const [a, b] = [...pointers.values()]
    if (!a || !b) return null
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    pointers.set(e.pointerId, local(e))
    // Best effort: a synthetic pointer (tests, assistive tech) has no capture to take.
    try {
      viewport.setPointerCapture?.(e.pointerId)
    } catch {}
    if (pointers.size === 2) {
      // A second finger turns the drag into a pinch.
      if (dragging) h.onDragEnd()
      dragging = false
      pinching = true
      const p = pinch()
      if (p) h.onPinchStart(p.distance)
      return
    }
    if (pointers.size === 1) {
      e.preventDefault()
      dragging = true
      const at = local(e)
      h.onDragStart(targetOf(e.target as Element), at.x, at.y)
    }
  }
  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    const at = local(e)
    pointers.set(e.pointerId, at)
    if (pinching) {
      const p = pinch()
      if (p) h.onPinchMove(p.distance, p.center)
    } else if (dragging) h.onDragMove(at.x, at.y, e.shiftKey)
  }
  const onUp = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return
    if (pinching && pointers.size < 2) {
      pinching = false
      h.onPinchEnd()
      return
    }
    if (dragging && pointers.size === 0) {
      dragging = false
      h.onDragEnd()
    }
  }
  const onWheel = (e: WheelEvent) => {
    if (e.deltaY === 0) return
    // The page must not scroll while zooming the image.
    e.preventDefault()
    h.onWheel(e.deltaY < 0 ? 1 : -1, local(e))
  }
  const ro =
    typeof win?.ResizeObserver === "function"
      ? new win.ResizeObserver(() => {
          const r = viewport.getBoundingClientRect()
          h.onSize({ width: r.width, height: r.height })
        })
      : null
  ro?.observe(viewport)
  const first = viewport.getBoundingClientRect()
  h.onSize({ width: first.width, height: first.height })

  viewport.addEventListener("pointerdown", onDown)
  viewport.addEventListener("pointermove", onMove)
  viewport.addEventListener("pointerup", onUp)
  viewport.addEventListener("pointercancel", onUp)
  viewport.addEventListener("wheel", onWheel, { passive: false })
  return () => {
    ro?.disconnect()
    viewport.removeEventListener("pointerdown", onDown)
    viewport.removeEventListener("pointermove", onMove)
    viewport.removeEventListener("pointerup", onUp)
    viewport.removeEventListener("pointercancel", onUp)
    viewport.removeEventListener("wheel", onWheel)
  }
}
