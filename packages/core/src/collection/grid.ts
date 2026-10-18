// collection-grid (design §1): a grid collection addresses focus as a row key plus a child
// index (0 = the row, 1..n = its controls in document order). Pure: child moves and who owns
// a key are decided here, the single place nested controls and the grid agree on. Table and
// Calendar later add a column axis (the child index becomes a column).

/** Which element of a row receives a keyboard event (decides which keys the grid handles). */
export type KeyOwner = "row" | "control" | "editable" | "nested" | "other"

/** The child navigation of a grid's rows: arrows into the controls, or Tab through them. */
export type ChildNavigation = "arrow" | "tab"

// A checkbox, radio or button input has no caret: arrows are the grid's, not the input's.
const EDITABLE =
  'input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="image"]), textarea, select, [contenteditable]:not([contenteditable="false"])'
const CONTROL = '[data-part="item-control"], [data-part="item-checkbox"]'
const NESTED = '[role="grid"], [role="listbox"], [role="tree"], [role="menu"], [role="toolbar"]'

/**
 * Who owns an event whose target is `target`, inside `row`: the row itself, one of its
 * controls (`data-part="item-control"`), an editable element (or anything inside one), a
 * nested composite inside the row, or something else. Editable wins over control (a text
 * field that is also a control keeps every key).
 */
export function owner(target: Element | null, row: Element): KeyOwner {
  if (!target || !row.contains(target)) return "other"
  if (target === row) return "row"
  const nested = target.closest(NESTED)
  if (nested && nested !== row && row.contains(nested)) return "nested"
  const editable = target.closest(EDITABLE)
  if (editable && row.contains(editable)) return "editable"
  const control = target.closest(CONTROL)
  if (control && row.contains(control)) return "control"
  return "other"
}

/**
 * The next child index for a move among a row's `count` controls: `next` goes to the next
 * control (none past the last: no wrap), `previous` to the previous one or the row, `row` to
 * the row. Null when nothing moves.
 */
export function childMove(
  index: number,
  count: number,
  direction: "next" | "previous" | "row",
): number | null {
  if (direction === "row") return index === 0 ? null : 0
  if (direction === "next") return index < count ? index + 1 : null
  return index > 0 ? index - 1 : null
}

/** The keys a control handles itself: the grid handles only these (by mode). */
export function gridHandlesOnControl(key: string, mode: ChildNavigation): boolean {
  if (key === "ArrowUp" || key === "ArrowDown" || key === "Escape") return true
  return mode === "arrow" && (key === "ArrowLeft" || key === "ArrowRight")
}
