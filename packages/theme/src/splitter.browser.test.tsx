// add-splitter 6.1: the Splitter stylesheet alone, on the markup core renders: a 1px line
// drawn as a border on the handle's axis, a hit area of at least --rind-hit-area, the cursor
// per axis, the accent while dragging, and forced-colors rules.
import { afterEach, describe, expect, it } from "vitest"
import splitter from "./splitter.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${splitter}`,
  )

const attrs = (part: string, orientation: string, extra = "") =>
  `data-scope="splitter" data-part="${part}" data-instance="s" data-orientation="${orientation}" ${extra}`

const markup = (orientation = "horizontal", handle = "") => {
  const vertical = orientation === "vertical"
  return `<div ${attrs("root", orientation)} style="display:flex;flex-direction:${vertical ? "column" : "row"};width:300px;height:200px">
  <div ${attrs("panel", orientation)} style="flex:50 1 0px"></div>
  <div ${attrs("handle", orientation, handle)} role="separator" tabindex="0" aria-label="Sidebar" style="flex:0 0 auto;position:relative"></div>
  <div ${attrs("panel", orientation)} style="flex:50 1 0px"></div>
</div>`
}

describe("Splitter stylesheet", () => {
  it("a horizontal Splitter's handle is a 1px vertical line with a 24px hit area", () => {
    sheet()
    const h = q(mount(markup()), '[data-part="handle"]')
    const s = getComputedStyle(h)
    expect(h.getBoundingClientRect().width).toBe(1)
    expect(s.borderLeftStyle).toBe("solid")
    expect(s.cursor).toBe("col-resize")
    expect(Number.parseFloat(getComputedStyle(h, "::before").width)).toBeGreaterThanOrEqual(24)
  })

  it("a vertical Splitter's handle is a horizontal line with a row-resize cursor", () => {
    sheet()
    const h = q(mount(markup("vertical")), '[data-part="handle"]')
    expect(h.getBoundingClientRect().height).toBe(1)
    expect(getComputedStyle(h).borderTopStyle).toBe("solid")
    expect(getComputedStyle(h).cursor).toBe("row-resize")
    expect(Number.parseFloat(getComputedStyle(h, "::before").height)).toBeGreaterThanOrEqual(24)
  })

  it("the dragged handle takes the accent; a disabled one keeps the default cursor", () => {
    sheet()
    const idle = getComputedStyle(q(mount(markup()), '[data-part="handle"]')).borderLeftColor
    cleanup()
    sheet()
    const dragged = q(mount(markup("horizontal", "data-dragging")), '[data-part="handle"]')
    expect(getComputedStyle(dragged).borderLeftColor).not.toBe(idle)
    cleanup()
    sheet()
    const off = q(mount(markup("horizontal", "data-disabled")), '[data-part="handle"]')
    expect(getComputedStyle(off).cursor).toBe("default")
  })

  it("reads --rind-splitter-* tokens", () => {
    sheet()
    const host = mount(`<div style="--rind-splitter-handle-size:4px">${markup()}</div>`)
    expect(q(host, '[data-part="handle"]').getBoundingClientRect().width).toBe(4)
  })

  it("has forced-colors rules and no variant, size or tone rules", () => {
    expect(splitter).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText/)
    expect(splitter).not.toMatch(/data-(variant|size|tone)/)
    expect(splitter).not.toMatch(/transition:/)
  })
})
