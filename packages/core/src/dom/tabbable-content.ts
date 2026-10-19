// tabbable-content: whether an element contains a tabbable descendant, reported on change
// (a text-only tab panel is itself focusable; one with a form is not: ariakit#6332).

export const TABBABLE =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, [contenteditable=""], [contenteditable="true"], [tabindex]'

export function hasTabbable(el: Element): boolean {
  for (const n of Array.from(el.querySelectorAll<HTMLElement>(TABBABLE))) {
    if ((n as HTMLButtonElement).disabled) continue
    if (n.getAttribute("tabindex") !== null && Number(n.getAttribute("tabindex")) < 0) continue
    if (n.closest("[hidden], [inert]") && n.closest("[hidden], [inert]") !== el) continue
    return true
  }
  return false
}

/** Calls `onChange` now and whenever the answer changes; returns the disconnect. */
export function observeTabbable(el: Element, onChange: (tabbable: boolean) => void): () => void {
  let last = hasTabbable(el)
  onChange(last)
  const win = el.ownerDocument.defaultView
  if (!win || typeof win.MutationObserver !== "function") return () => {}
  const mo = new win.MutationObserver(() => {
    const now = hasTabbable(el)
    if (now === last) return
    last = now
    onChange(now)
  })
  mo.observe(el, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["tabindex", "disabled", "href", "contenteditable", "hidden", "inert"],
  })
  return () => mo.disconnect()
}
