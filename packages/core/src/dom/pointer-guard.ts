// Real pointer movement only: browsers fire zero-delta mousemove/pointermove when content
// scrolls under a resting pointer (keyboard navigation scrolling the list), which must not
// steal the highlight. One record per window, shared by every collection item.

const last = new WeakMap<object, { x: number; y: number }>()
const watched = new WeakSet<object>()

/**
 * Every pointer move in the window updates the record, after the items' own handlers (bubble
 * phase on the window, the last stop): a popup opened under a resting pointer then knows where
 * it rests, and its first scroll-induced move is not mistaken for movement (BU#4002, zag#3273).
 */
function watch(view: object) {
  if (watched.has(view)) return
  watched.add(view)
  const target = view as Partial<Pick<Window, "addEventListener">>
  target.addEventListener?.(
    "pointermove",
    (e: PointerEvent) => last.set(view, { x: e.clientX, y: e.clientY }),
    { passive: true },
  )
}

/**
 * True when the pointer at (`x`, `y`) actually moved since the last call for `view`
 * (the window), and records the position.
 */
export function pointerMoved(view: object, x: number, y: number): boolean {
  watch(view)
  const prev = last.get(view)
  last.set(view, { x, y })
  return !prev || prev.x !== x || prev.y !== y
}
