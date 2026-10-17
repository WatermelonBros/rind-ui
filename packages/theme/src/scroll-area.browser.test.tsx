// add-scroll-area 7.1: the Scroll Area stylesheet alone: hidden scrollbars fade out and stop
// taking the pointer, the thumb keeps a minimum size, tokens apply, forced colors paint the
// thumb in CanvasText (the rendered capture is in scroll-area.pw.test.ts), no variant rules.
import { afterEach, describe, expect, it } from "vitest"
import scrollArea from "./scroll-area.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${scrollArea}`,
  )

const bar = (state: string, style = "") =>
  `<div data-scope="scroll-area" data-part="scrollbar" data-orientation="vertical" data-state="${state}" style="height:200px;${style}"><div data-scope="scroll-area" data-part="thumb" data-orientation="vertical" style="--rind-scroll-area-thumb-size:4px"></div></div>`

describe("Scroll Area stylesheet", () => {
  it("a hidden scrollbar is transparent and lets the pointer through", () => {
    sheet()
    const el = q(mount(bar("hidden")), '[data-part="scrollbar"]')
    const s = getComputedStyle(el)
    expect(s.opacity).toBe("0")
    expect(s.pointerEvents).toBe("none")
    expect(getComputedStyle(q(mount(bar("visible")), '[data-part="scrollbar"]')).opacity).toBe("1")
  })

  it("the thumb keeps its minimum size", () => {
    sheet()
    const thumb = q(mount(bar("visible")), '[data-part="thumb"]')
    expect(thumb.getBoundingClientRect().height).toBe(18)
  })

  it("reads --rind-scroll-area-* tokens", () => {
    sheet()
    const el = q(
      mount(bar("visible", "--rind-scroll-area-scrollbar-size:16px")),
      '[data-part="scrollbar"]',
    )
    expect(el.getBoundingClientRect().width).toBe(16)
  })

  it("has a forced-colors rule and no variant or size rules", () => {
    expect(scrollArea).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText/)
    expect(scrollArea).not.toMatch(/data-(variant|size)/)
  })
})
