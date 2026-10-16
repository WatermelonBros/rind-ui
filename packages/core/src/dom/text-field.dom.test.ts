// Text fields by tag, type and contenteditable (ariakit#6316: never `instanceof`).
import { afterEach, describe, expect, it } from "vitest"
import { isTextField, textFieldCaret } from "./text-field"

afterEach(() => {
  document.body.innerHTML = ""
})
const make = (html: string) => {
  document.body.innerHTML = html
  return document.body.firstElementChild as HTMLElement
}
// jsdom does not implement isContentEditable.
const hasEditable = "isContentEditable" in HTMLElement.prototype

describe("isTextField", () => {
  it.each(["", "text", "search", "url", "tel", "email", "password", "number", "TEXT"])(
    "input type=%j is a text field",
    (type) => {
      expect(isTextField(make(`<input ${type ? `type="${type}"` : ""}>`))).toBe(true)
    },
  )
  it.each(["checkbox", "radio", "button", "submit", "range", "color", "file", "date"])(
    "input type=%s is not",
    (type) => {
      expect(isTextField(make(`<input type="${type}">`))).toBe(false)
    },
  )
  it("textarea yes; button, div and null no", () => {
    expect(isTextField(make("<textarea></textarea>"))).toBe(true)
    expect(isTextField(make("<button>x</button>"))).toBe(false)
    expect(isTextField(make("<div>x</div>"))).toBe(false)
    expect(isTextField(null)).toBe(false)
  })
  it.skipIf(!hasEditable)("contenteditable yes, contenteditable=false no", () => {
    expect(isTextField(make('<div contenteditable="true">x</div>'))).toBe(true)
    expect(isTextField(make('<div contenteditable="false">x</div>'))).toBe(false)
  })
  it("a field from another document is recognised (no instanceof)", () => {
    const frame = document.createElement("iframe")
    document.body.append(frame)
    const doc = frame.contentDocument as Document
    const input = doc.createElement("input")
    doc.body.append(input)
    expect(isTextField(input)).toBe(true)
    expect(input instanceof HTMLInputElement).toBe(false)
  })
})

describe("textFieldCaret", () => {
  it("input: value length, start and end", () => {
    const el = make('<input value="hello">') as HTMLInputElement
    el.setSelectionRange(2, 2)
    expect(textFieldCaret(el)).toEqual({ value: 5, start: 2, end: 2 })
    el.setSelectionRange(1, 4)
    expect(textFieldCaret(el)).toEqual({ value: 5, start: 1, end: 4 })
  })
  it("textarea", () => {
    const el = make("<textarea>ab\ncd</textarea>") as HTMLTextAreaElement
    el.setSelectionRange(5, 5)
    expect(textFieldCaret(el)).toEqual({ value: 5, start: 5, end: 5 })
  })
  it("input without a selection API (number): the caret is at both ends", () => {
    const el = make('<input type="number" value="12">') as HTMLInputElement
    expect(textFieldCaret(el)).toEqual({ value: 2, start: 2, end: 2 })
  })
  it("contenteditable: from the document selection", () => {
    const el = make('<div contenteditable="true">hello</div>')
    const text = el.firstChild as Text
    const range = document.createRange()
    range.setStart(text, 2)
    range.setEnd(text, 4)
    const sel = document.getSelection() as Selection
    sel.removeAllRanges()
    sel.addRange(range)
    expect(textFieldCaret(el)).toEqual({ value: 5, start: 2, end: 4 })
  })
  it("contenteditable without a selection inside: caret at the start", () => {
    const el = make('<div contenteditable="true">hello</div>')
    document.getSelection()?.removeAllRanges()
    expect(textFieldCaret(el)).toEqual({ value: 5, start: 0, end: 0 })
  })
})
