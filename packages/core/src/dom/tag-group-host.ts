// Tag Group's development checks after mount (design §4): an interactive list needs a name,
// and a Tag Group cannot sit inside an option or a menu item (it would hold controls).

declare const process: { env: { NODE_ENV?: string } }

/** Development: an interactive list without a name, or a group inside an option/menuitem. */
export function checkTagGroupList(el: Element, interactive: boolean): void {
  if (process.env.NODE_ENV === "production") return
  if (!interactive) return
  if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) {
    console.warn(
      "[rind-ui] TagGroup: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.",
    )
  }
  const host = el.parentElement?.closest('[role="option"], [role="menuitem"]')
  if (host) {
    console.warn(
      `[rind-ui] TagGroup: a Tag Group is inside a ${host.getAttribute("role")} ("${host.textContent?.trim().slice(0, 40)}"), which cannot hold interactive content.`,
    )
  }
}

/** The element is the one registered under `id` (the tag's own anchor), or inside it. */
export function isWithinId(target: Element | null, id: string): boolean {
  const el = target?.ownerDocument.getElementById(id)
  return el !== null && el !== undefined && target !== null && el.contains(target)
}
