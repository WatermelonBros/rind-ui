// collection-grid "Spatial Navigation": the item above or below an item in a wrapped layout,
// measured from the items' boxes (by `data-key`). Null when nothing can be measured (zero
// rects, jsdom): the caller falls back to collection order. On the first or last visual row
// it is `key` itself: the highlight stays (APG grid), never sideways in collection order.

/**
 * The key of the item nearest above (`up`) or below (`down`) `key`'s centre horizontally,
 * among `items` (the list's rows in collection order); clamped to the last short row. `key`
 * itself on an edge row, null when nothing can be measured.
 */
export function spatialTarget(
  items: readonly Element[],
  key: string,
  direction: "up" | "down",
): string | null {
  const boxes = items.map((el) => ({
    key: el.getAttribute("data-key"),
    r: el.getBoundingClientRect(),
  }))
  const from = boxes.find((b) => b.key === key)
  if (!from || from.r.width === 0 || from.r.height === 0) return null
  const cx = from.r.left + from.r.width / 2
  const rowTop = from.r.top + from.r.height / 2
  const candidates = boxes.filter((b) => {
    if (b.key === null || b.r.width === 0) return false
    const mid = b.r.top + b.r.height / 2
    return direction === "down" ? mid > rowTop + 1 : mid < rowTop - 1
  })
  if (candidates.length === 0) return key
  // The nearest visual row in that direction, then the item nearest horizontally in it.
  const rowMid = (b: (typeof boxes)[number]) => b.r.top + b.r.height / 2
  const target = candidates.reduce((best, b) =>
    Math.abs(rowMid(b) - rowTop) < Math.abs(rowMid(best) - rowTop) ? b : best,
  )
  const line = candidates.filter((b) => Math.abs(rowMid(b) - rowMid(target)) < 1)
  const nearest = line.reduce((best, b) =>
    Math.abs(b.r.left + b.r.width / 2 - cx) < Math.abs(best.r.left + best.r.width / 2 - cx)
      ? b
      : best,
  )
  return nearest.key
}
