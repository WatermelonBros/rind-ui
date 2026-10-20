// zoom-gestures (add-image-viewer design §3): the DOM side of an Image Viewer's viewport.
// One pointer drags, two touch pointers pinch; ctrl-wheel (a trackpad pinch in Chromium and
// Firefox) and Safari's gesture events zoom about the pointer, also during a drag
// (react-zoom-pan-pinch #543, Viewer.js #492); a plain wheel is left to the page unless
// `wheelZooms()`; a double click toggles; a ResizeObserver reports the size (Viewer.js #663).

export interface ZoomGestureHandlers {
  readonly onSize: (size: { width: number; height: number }) => void
  readonly onDragStart: (x: number, y: number) => void
  readonly onDragMove: (x: number, y: number) => void
  readonly onDragEnd: () => void
  /** Multiply the zoom by `factor` about `at`. */
  readonly onZoomBy: (factor: number, at: { x: number; y: number }) => void
  readonly onPinchStart: (distance: number) => void
  readonly onPinchMove: (distance: number, center: { x: number; y: number }) => void
  readonly onPinchEnd: () => void
  readonly onToggle: (at: { x: number; y: number }) => void
  /** A plain wheel zooms (`wheel="zoom"`); otherwise it scrolls the page. */
  readonly wheelZooms: () => boolean
}

/** Safari's trackpad pinch event (not in the DOM typings). */
interface GestureEventLike extends Event {
  readonly scale: number
  readonly clientX: number
  readonly clientY: number
}

export function zoomGestures(viewport: HTMLElement, h: ZoomGestureHandlers): () => void {
  const win = viewport.ownerDocument.defaultView
  const local = (e: { clientX: number; clientY: number }) => {
    const r = viewport.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const pointers = new Map<number, { x: number; y: number }>()
  let dragging = false
  let pinching = false
  let gestureScale = 1
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
      if (dragging) h.onDragEnd()
      dragging = false
      pinching = true
      const p = pinch()
      if (p) h.onPinchStart(p.distance)
      return
    }
    if (pointers.size === 1) {
      dragging = true
      const at = local(e)
      h.onDragStart(at.x, at.y)
    }
  }
  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    const at = local(e)
    pointers.set(e.pointerId, at)
    if (pinching) {
      const p = pinch()
      if (p) h.onPinchMove(p.distance, p.center)
    } else if (dragging) h.onDragMove(at.x, at.y)
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
    if (e.deltaY === 0 || !(e.ctrlKey || h.wheelZooms())) return
    // Zooming the image, not the page.
    e.preventDefault()
    h.onZoomBy(Math.exp(-e.deltaY / 100), local(e))
  }
  const onGestureStart = (e: Event) => {
    e.preventDefault()
    gestureScale = 1
  }
  const onGestureChange = (e: Event) => {
    e.preventDefault()
    const g = e as GestureEventLike
    if (g.scale > 0) h.onZoomBy(g.scale / gestureScale, local(g))
    gestureScale = g.scale
  }
  const onDouble = (e: MouseEvent) => h.onToggle(local(e))
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
  viewport.addEventListener("gesturestart", onGestureStart)
  viewport.addEventListener("gesturechange", onGestureChange)
  viewport.addEventListener("dblclick", onDouble)
  return () => {
    ro?.disconnect()
    viewport.removeEventListener("pointerdown", onDown)
    viewport.removeEventListener("pointermove", onMove)
    viewport.removeEventListener("pointerup", onUp)
    viewport.removeEventListener("pointercancel", onUp)
    viewport.removeEventListener("wheel", onWheel)
    viewport.removeEventListener("gesturestart", onGestureStart)
    viewport.removeEventListener("gesturechange", onGestureChange)
    viewport.removeEventListener("dblclick", onDouble)
  }
}
