// sortable-drag (add-sortable design §3): one pointer drag of a sortable item. It starts after
// a 4 px move (a 300 ms press on touch, so a swipe still scrolls the page), follows the pointer,
// finds the drop index from the other items' midpoints (measured once, shifted by the scroll
// container's scroll), auto-scrolls that container near its edges at a speed proportional to
// the depth (dnd-kit #1992; only the list's own container, #2070), and cancels on Escape or
// pointercancel. Its listeners exist only while the gesture lasts (React Aria #10599).

export type SortableAxis = "x" | "y"

export interface SortableDragOptions {
  /** The items in their current order, the dragged one included. */
  readonly items: readonly HTMLElement[]
  /** The dragged item's index in `items`. */
  readonly index: number
  readonly axis: SortableAxis
  /** The element the indicator offset is measured from (the Root). */
  readonly root: HTMLElement
  readonly onStart: () => void
  /**
   * `delta`: how far the item moved (px, scroll included); `target`: the index it would land at
   * in the new order; `indicator`: the drop line's offset along the axis from the root (px).
   */
  readonly onMove: (delta: { x: number; y: number }, target: number, indicator: number) => void
  /** `drop`: false when cancelled (Escape, pointercancel) or the threshold was never passed. */
  readonly onEnd: (drop: boolean) => void
}

const THRESHOLD = 4
const LONG_PRESS = 300
const EDGE = 48
const MAX_SPEED = 18

const scrolls = (el: Element, axis: SortableAxis) => {
  const style = getComputedStyle(el)
  const overflow = axis === "y" ? style.overflowY : style.overflowX
  const size = axis === "y" ? el.scrollHeight > el.clientHeight : el.scrollWidth > el.clientWidth
  return size && /auto|scroll|overlay/.test(overflow)
}

/** The nearest ancestor that scrolls along the axis, else the document's scrolling element. */
function scrollParent(el: HTMLElement, axis: SortableAxis): Element {
  for (let p = el.parentElement; p; p = p.parentElement) if (scrolls(p, axis)) return p
  return el.ownerDocument.scrollingElement ?? el.ownerDocument.documentElement
}

export function sortableDrag(start: PointerEvent, o: SortableDragOptions): () => void {
  const doc = o.root.ownerDocument
  const win = doc.defaultView as Window & typeof globalThis
  const y = o.axis === "y"
  const along = (p: { clientX: number; clientY: number }) => (y ? p.clientY : p.clientX)
  const scroller = scrollParent(o.root, o.axis)
  const scrollPos = () => (y ? scroller.scrollTop : scroller.scrollLeft)
  const scroll0 = scrollPos()
  // Measured once: the others' extents along the axis, in client px at the start.
  const others = o.items
    .map((el, i) => ({ i, r: el.getBoundingClientRect() }))
    .filter((e) => e.i !== o.index)
    .map(({ r }) => (y ? { a: r.top, b: r.bottom } : { a: r.left, b: r.right }))
  const rootStart = y ? o.root.getBoundingClientRect().top : o.root.getBoundingClientRect().left
  let last = { clientX: start.clientX, clientY: start.clientY }
  let started = false
  let frame = 0
  let timer = 0
  const touch = start.pointerType === "touch"

  const report = () => {
    const shift = scrollPos() - scroll0
    const at = along(last) + shift
    // The drop index: how many other items have their midpoint before the pointer.
    let target = 0
    for (const e of others) if ((e.a + e.b) / 2 < at) target++
    const gapAt =
      others.length === 0
        ? 0
        : target === 0
          ? (others[0]?.a ?? 0)
          : target >= others.length
            ? (others[others.length - 1]?.b ?? 0)
            : ((others[target - 1]?.b ?? 0) + (others[target]?.a ?? 0)) / 2
    o.onMove(
      {
        x: last.clientX - start.clientX + (y ? 0 : shift),
        y: last.clientY - start.clientY + (y ? shift : 0),
      },
      target,
      gapAt - rootStart,
    )
  }

  // Auto-scroll on rAF while the pointer is near the container's edge.
  const tick = () => {
    frame = 0
    if (!started) return
    const box =
      scroller === doc.scrollingElement || scroller === doc.documentElement
        ? { a: 0, b: y ? win.innerHeight : win.innerWidth }
        : (() => {
            const r = scroller.getBoundingClientRect()
            return y ? { a: r.top, b: r.bottom } : { a: r.left, b: r.right }
          })()
    const p = along(last)
    const depth = p < box.a + EDGE ? -(box.a + EDGE - p) : p > box.b - EDGE ? p - (box.b - EDGE) : 0
    if (depth !== 0) {
      const speed = Math.sign(depth) * Math.min(MAX_SPEED, (Math.abs(depth) / EDGE) * MAX_SPEED)
      if (y) scroller.scrollTop += speed
      else scroller.scrollLeft += speed
      report()
      frame = win.requestAnimationFrame(tick)
    }
  }

  const begin = () => {
    if (started) return
    started = true
    o.onStart()
    report()
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== start.pointerId) return
    last = { clientX: e.clientX, clientY: e.clientY }
    if (!started) {
      const far = Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) > THRESHOLD
      // On touch, moving before the long press is a scroll: give up.
      if (far && touch) return end(false)
      if (far) begin()
      return
    }
    e.preventDefault()
    report()
    if (!frame) frame = win.requestAnimationFrame(tick)
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerId === start.pointerId) end(started)
  }
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId === start.pointerId) end(false)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !started) return
    e.preventDefault()
    e.stopPropagation()
    end(false)
  }
  let done = false
  const cleanup = () => {
    win.clearTimeout(timer)
    if (frame) win.cancelAnimationFrame(frame)
    win.removeEventListener("pointermove", onMove)
    win.removeEventListener("pointerup", onUp)
    win.removeEventListener("pointercancel", onCancel)
    win.removeEventListener("keydown", onKey, true)
  }
  function end(drop: boolean) {
    if (done) return
    done = true
    cleanup()
    o.onEnd(drop && started)
  }

  if (touch) timer = win.setTimeout(begin, LONG_PRESS)
  win.addEventListener("pointermove", onMove, { passive: false })
  win.addEventListener("pointerup", onUp)
  win.addEventListener("pointercancel", onCancel)
  win.addEventListener("keydown", onKey, true)
  return () => end(false)
}
