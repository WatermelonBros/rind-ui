// collection-grid: a row's controls in document order (its `item-control` parts), and the
// development warning for focusable elements inside a row that are not controls.

declare const process: { env: { NODE_ENV?: string } }

const FOCUSABLE =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable]:not([contenteditable='false'])"

/** A row's controls: its item-control parts and its selection checkbox. */
export const CONTROL = '[data-part="item-control"], [data-part="item-checkbox"]'

const NESTED = '[role="grid"], [role="listbox"], [role="tree"], [role="menu"], [role="toolbar"]'

/** The row's own controls: nested composites' controls are theirs. */
export function controlsOf(row: Element): HTMLElement[] {
  return [...row.querySelectorAll<HTMLElement>(CONTROL)].filter(
    (c) => c.closest('[role="row"]') === row,
  )
}

/** Development: focusable elements in a row that the grid cannot navigate to. */
export function warnForeignFocusables(row: Element, scope: string): void {
  if (process.env.NODE_ENV === "production") return
  for (const el of row.querySelectorAll(FOCUSABLE)) {
    if (el.closest('[role="row"]') !== row) continue
    if (el.closest(CONTROL)) continue
    // Inside a nested composite (a Tag Group in the row): that composite manages it.
    const nested = el.closest(NESTED)
    if (nested && nested !== row && row.contains(nested)) continue
    console.warn(
      `[rind-ui] ${scope}: a <${el.tagName.toLowerCase()}> "${(el.textContent ?? "").trim()}" in row "${row.getAttribute("data-key")}" is focusable but not an item-control; render it through the ItemControl part.`,
    )
  }
}
