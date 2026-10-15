// Text fields by tag, type and contenteditable, never `instanceof` (a field from another
// document, a same-origin iframe, is not an instance of this window's classes: ariakit#6316).

const TEXT_TYPES = new Set(["text", "search", "url", "tel", "email", "password", "number", ""])

export function isTextField(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === "TEXTAREA") return true
  if (tag === "INPUT") return TEXT_TYPES.has((el.getAttribute("type") ?? "").toLowerCase())
  return (el as HTMLElement).isContentEditable === true
}

/** The caret and value length of a text field (selection of its own document). */
export function textFieldCaret(
  el: Element,
): { readonly value: number; readonly start: number; readonly end: number } | null {
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const field = el as HTMLInputElement
    // number inputs have no selection API: treat the caret as being at both ends.
    const start = field.selectionStart
    const end = field.selectionEnd
    const value = field.value.length
    if (start === null || end === null) return { value, start: value, end: value }
    return { value, start, end }
  }
  const sel = el.ownerDocument.getSelection()
  const text = el.textContent ?? ""
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
    return { value: text.length, start: 0, end: 0 }
  }
  const range = sel.getRangeAt(0)
  const before = el.ownerDocument.createRange()
  before.selectNodeContents(el)
  before.setEnd(range.startContainer, range.startOffset)
  const start = before.toString().length
  return { value: text.length, start, end: start + range.toString().length }
}
