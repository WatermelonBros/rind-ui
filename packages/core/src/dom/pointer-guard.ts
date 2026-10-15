// Real pointer movement only: browsers fire zero-delta mousemove/pointermove when content
// scrolls under a resting pointer (keyboard navigation scrolling the list), which must not
// steal the highlight. One record per window, shared by every collection item.

const last = new WeakMap<object, { x: number; y: number }>()

/**
 * True when the pointer at (`x`, `y`) actually moved since the last call for `view`
 * (the window), and records the position.
 */
export function pointerMoved(view: object, x: number, y: number): boolean {
  const prev = last.get(view)
  last.set(view, { x, y })
  return !prev || prev.x !== x || prev.y !== y
}
