// The text a reader hears in an element's content: its text without `aria-hidden` subtrees
// (a sort trigger's arrow glyph, its hidden sort-state description).

export function visibleText(el: Node): string {
  let out = ""
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) out += n.textContent ?? ""
    else if (n.nodeType === 1 && (n as Element).getAttribute("aria-hidden") !== "true") {
      out += visibleText(n)
    }
  }
  return out.replace(/\s+/g, " ").trim()
}
