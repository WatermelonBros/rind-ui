// Visual adjacency of date segments (date-segments "Moving Between Segments"): arrows move to
// the segment next to the focused one on screen, so they follow what the user sees in either
// direction (React Aria's findNextSegment over bounding rects). With a `scope`, segments of
// every field inside it count (paired fields in one row). Where nothing is laid out (jsdom:
// zero rects), DOM order within the field's own root.

const SEGMENTS = '[data-scope="date-field"][data-part="segment"][data-editable]'

/** The field's editable, enabled segment inputs in DOM order. */
export function editableSegments(container: ParentNode): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>(SEGMENTS)).filter(
    (el) => !el.disabled,
  )
}

/**
 * The segment visually after (`next`: rightwards in ltr, leftwards in rtl) or before
 * `from`, or null at the edge.
 */
export function adjacentSegment(
  from: HTMLElement,
  direction: "next" | "previous",
  o: { readonly root: ParentNode; readonly scope?: ParentNode | null; readonly dir: "ltr" | "rtl" },
): HTMLElement | null {
  const own = editableSegments(o.root)
  const start = from.getBoundingClientRect()
  if (start.width === 0 && start.height === 0) {
    const i = own.indexOf(from as HTMLInputElement)
    return own[i + (direction === "next" ? 1 : -1)] ?? null
  }
  const rightwards = (direction === "next") === (o.dir === "ltr")
  let best: { el: HTMLElement; distance: number } | null = null
  for (const el of editableSegments(o.scope ?? o.root)) {
    if (el === from) continue
    const r = el.getBoundingClientRect()
    const distance = rightwards ? r.left - start.left : start.left - r.left
    if (distance > 0 && (!best || distance < best.distance)) best = { el, distance }
  }
  return best?.el ?? null
}

/**
 * Where a press on the group outside any segment puts focus: the last non-empty segment
 * before the press point (in reading direction), else the first segment.
 */
export function segmentAtPress(
  root: ParentNode,
  x: number,
  dir: "ltr" | "rtl",
): HTMLInputElement | null {
  const all = editableSegments(root)
  let hit: HTMLInputElement | null = null
  for (const el of all) {
    const r = el.getBoundingClientRect()
    const before = dir === "ltr" ? r.left < x : r.right > x
    if (before && el.value !== "") hit = el
  }
  return hit ?? all[0] ?? null
}
