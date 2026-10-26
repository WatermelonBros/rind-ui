// add-mentions (theme): the Highlighter mirrors the Textarea box for box (one grid cell, the same
// font, padding, border widths and line height), so its text wraps and sits like the textarea's.
import { afterEach, describe, expect, it } from "vitest"
import mentions from "./mentions.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const text = "Hello there @Alice and more"
const markup = `<div data-scope="mentions" data-part="root">
  <div data-scope="mentions" data-part="highlighter" aria-hidden="true" style="pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word"><span>Hello there </span><mark data-scope="mentions" data-part="mention">@Alice</mark><span> and more​</span></div>
  <textarea data-scope="mentions" data-part="textarea" aria-label="Message">${text}</textarea></div>`

describe("mentions.css", () => {
  it("the Highlighter has the Textarea's box and text metrics", () => {
    inject(
      `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${mentions}`,
    )
    const host = mount(markup)
    const area = q<HTMLTextAreaElement>(host, "textarea")
    const mirror = q(host, '[data-part="highlighter"]')
    const a = area.getBoundingClientRect()
    const h = mirror.getBoundingClientRect()
    expect([h.left, h.top, h.width, h.height]).toEqual([a.left, a.top, a.width, a.height])
    const metrics = (el: Element) => {
      const s = getComputedStyle(el)
      return [
        "font-family",
        "font-size",
        "font-weight",
        "line-height",
        "letter-spacing",
        "padding-top",
        "padding-left",
        "padding-right",
        "border-top-width",
        "border-left-width",
        "box-sizing",
      ].map((p) => s.getPropertyValue(p))
    }
    expect(metrics(mirror)).toEqual(metrics(area))
    // The mirror's own text is invisible: only the marks show through the textarea.
    expect(getComputedStyle(mirror).color).toBe("rgba(0, 0, 0, 0)")
  })
})
