// tree-drag (add-tree-view-dnd design §3): one pointer drag of a tree row. It starts after a
// 4 px move (a 300 ms press on touch, so a swipe still scrolls), reports the row under the
// pointer and where in it (a 0–1 fraction from its top) for the drop zones, cancels on Escape
// or pointercancel, and swallows the click that follows a drag (dropping is not a press on
// the row). Its listeners exist only while the gesture lasts (React Aria #10599).

export interface TreeDragOptions {
  /** The `role="tree"` element: rows are found inside it. */
  readonly tree: HTMLElement
  readonly onStart: () => void
  /** The row under the pointer (null outside every row) and the pointer's fraction in it. */
  readonly onOver: (row: HTMLElement | null, fraction: number) => void
  /** `drop`: false when cancelled or the threshold was never passed. */
  readonly onEnd: (drop: boolean) => void
}

const THRESHOLD = 4
const LONG_PRESS = 300

export function treeDrag(start: PointerEvent, o: TreeDragOptions): () => void {
  const doc = o.tree.ownerDocument
  const win = doc.defaultView as Window & typeof globalThis
  const touch = start.pointerType === "touch"
  let started = false
  let done = false
  let timer = 0
  let last = { x: start.clientX, y: start.clientY }

  const over = () => {
    const el = doc.elementFromPoint(last.x, last.y)
    const row = el?.closest<HTMLElement>('[role="treeitem"]') ?? null
    if (!row || !o.tree.contains(row)) return o.onOver(null, 0)
    const r = row.getBoundingClientRect()
    o.onOver(row, r.height > 0 ? Math.min(1, Math.max(0, (last.y - r.top) / r.height)) : 0.5)
  }
  const begin = () => {
    if (started || done) return
    started = true
    // A text selection the press began would stretch across the rows while dragging.
    doc.getSelection()?.removeAllRanges()
    o.onStart()
    over()
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== start.pointerId) return
    last = { x: e.clientX, y: e.clientY }
    if (!started) {
      const far = Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) > THRESHOLD
      // On touch, moving before the long press is a scroll: give up.
      if (far && touch) return end(false)
      if (far) begin()
      return
    }
    e.preventDefault()
    over()
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
  const swallow = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  function end(drop: boolean) {
    if (done) return
    done = true
    win.clearTimeout(timer)
    win.removeEventListener("pointermove", onMove)
    win.removeEventListener("pointerup", onUp)
    win.removeEventListener("pointercancel", onCancel)
    win.removeEventListener("keydown", onKey, true)
    if (started) {
      // The click the browser fires after this pointerup belongs to the drag, not the row.
      win.addEventListener("click", swallow, { capture: true, once: true })
      win.setTimeout(() => win.removeEventListener("click", swallow, { capture: true }), 0)
    }
    o.onEnd(drop && started)
  }
  if (touch) timer = win.setTimeout(begin, LONG_PRESS)
  win.addEventListener("pointermove", onMove, { passive: false })
  win.addEventListener("pointerup", onUp)
  win.addEventListener("pointercancel", onCancel)
  win.addEventListener("keydown", onKey, true)
  return () => end(false)
}
