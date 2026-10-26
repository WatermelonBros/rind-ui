// caret-rect (add-mentions design §8): where a character of a textarea is on screen. A hidden
// mirror div copies the textarea's box and text metrics, holds the text before the index and a
// marker span; the marker's rect, offset by the textarea's own position and scroll, is the
// caret's. Written once for Mentions and Prompt Input.

const COPIED = [
  "box-sizing",
  "width",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "font-stretch",
  "letter-spacing",
  "word-spacing",
  "line-height",
  "text-transform",
  "text-indent",
  "tab-size",
  "white-space",
  "word-break",
  "overflow-wrap",
  "direction",
] as const

export interface CaretRect {
  readonly left: number
  readonly top: number
  readonly height: number
}

/** The viewport rect of the character at `index` in a textarea or input (zero width). */
export function caretRect(field: HTMLTextAreaElement | HTMLInputElement, index: number): CaretRect {
  const doc = field.ownerDocument
  const win = doc.defaultView
  const style = win?.getComputedStyle(field)
  const mirror = doc.createElement("div")
  const s = mirror.style
  if (style) for (const p of COPIED) s.setProperty(p, style.getPropertyValue(p))
  s.position = "absolute"
  s.visibility = "hidden"
  s.top = "0"
  s.left = "-9999px"
  s.overflow = "hidden"
  if (field instanceof HTMLTextAreaElement) {
    s.whiteSpace = "pre-wrap"
    s.overflowWrap = "break-word"
  } else s.whiteSpace = "pre"
  mirror.textContent = field.value.slice(0, index)
  const marker = doc.createElement("span")
  // A zero-width character keeps the marker on the caret's line, even at a line's end.
  marker.textContent = field.value.slice(index) || "​"
  mirror.appendChild(marker)
  doc.body.appendChild(mirror)
  const box = field.getBoundingClientRect()
  const lineHeight = Number.parseFloat(style?.lineHeight ?? "") || marker.offsetHeight
  const rect = {
    left: box.left + marker.offsetLeft - field.scrollLeft,
    top: box.top + marker.offsetTop - field.scrollTop,
    height: lineHeight,
  }
  mirror.remove()
  return rect
}
