// The subset of the accessible-name computation a development check needs for a
// button-like element: aria-labelledby, aria-label, then its text without hidden
// descendants. Not the full algorithm (no embedded controls, no CSS content).

const textOf = (node: Node): string => {
  if (node.nodeType === 3) return node.textContent ?? ""
  if (!(node instanceof Element)) return ""
  if (node.getAttribute("aria-hidden") === "true" || node.hasAttribute("hidden")) return ""
  const label = node.getAttribute("aria-label")
  if (label?.trim()) return label
  if (node.tagName === "IMG") return node.getAttribute("alt") ?? ""
  return Array.from(node.childNodes, textOf).join("")
}

/** The accessible name of a button-like element (subset; see the module comment). */
export function accessibleNameOf(el: Element): string {
  const ids = el.getAttribute("aria-labelledby")
  if (ids?.trim()) {
    const doc = el.ownerDocument
    return ids
      .split(/\s+/)
      .map((id) => {
        const ref = doc.getElementById(id)
        return ref ? textOf(ref) : ""
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  }
  return textOf(el).replace(/\s+/g, " ").trim()
}
