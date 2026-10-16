// add-popover 7.1: the Popover stylesheet on top of positioner.css: surface, tokens,
// available-size clamping, transform origin, entry and exit, modal variant, arrow, reduced
// motion and the forced-colors mapping.
import { afterEach, describe, expect, it } from "vitest"
import popover from "./popover.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.overlay}\n${files.positioner}\n${popover}`,
  )

const markup = (contentAttrs = "", state = "open") =>
  `<div data-scope="popover" data-part="positioner" data-side="bottom" data-state="${state}" style="position:absolute;top:20px;left:20px"><div role="dialog" aria-label="P" data-scope="popover" data-part="content" data-side="bottom" data-state="${state}" ${contentAttrs}><button data-scope="popover" data-part="close-trigger" aria-label="Close"></button>Body<div data-scope="popover" data-part="arrow" data-side="bottom" style="position:absolute"></div></div></div>`

describe("Popover stylesheet", () => {
  it("the content has a border, a radius and padding", () => {
    sheet()
    const s = getComputedStyle(q(mount(markup()), '[data-part="content"]'))
    expect(Number.parseFloat(s.borderTopWidth)).toBeGreaterThan(0)
    expect(Number.parseFloat(s.borderTopLeftRadius)).toBeGreaterThan(0)
    expect(Number.parseFloat(s.paddingTop)).toBeGreaterThan(0)
  })

  it("reads the --rind-popover-* tokens", () => {
    sheet()
    const host = mount(
      `<div style="--rind-popover-bg:rgb(1, 2, 3);--rind-popover-radius:7px;--rind-popover-padding:11px;--rind-popover-max-width:300px">${markup()}</div>`,
    )
    const c = getComputedStyle(q(host, '[data-part="content"]'))
    expect(c.backgroundColor).toBe("rgb(1, 2, 3)")
    expect(c.borderTopLeftRadius).toBe("7px")
    expect(c.paddingTop).toBe("11px")
    expect(c.maxWidth).toBe("300px")
  })

  it("is clamped to the available size", () => {
    sheet()
    const host = mount(
      `<div style="--rind-available-height:120px;--rind-available-width:200px">${markup()}</div>`,
    )
    const s = getComputedStyle(q(host, '[data-part="content"]'))
    expect(s.maxHeight).toBe("120px")
    expect(s.maxWidth).toBe("200px")
  })

  it("takes its transform origin from the positioning variable", () => {
    sheet()
    const host = mount(`<div style="--rind-transform-origin:12px 34px">${markup()}</div>`)
    expect(getComputedStyle(q(host, '[data-part="content"]')).transformOrigin).toBe("12px 34px")
  })

  it("exits to transparent when closed, and the modal variant has its own shadow", () => {
    sheet()
    const closed = getComputedStyle(q(mount(markup("", "closed")), '[data-part="content"]'))
    expect(closed.opacity).toBe("0")
    const host = mount(
      `<div style="--rind-popover-modal-shadow:rgb(9, 9, 9) 0 0 1px">${markup("data-modal")}</div>`,
    )
    expect(getComputedStyle(q(host, '[data-part="content"]')).boxShadow).toMatch(/rgb\(9, 9, 9\)/)
  })

  it("the arrow follows the size token and the close trigger is at least 24x24", () => {
    sheet()
    const host = mount(`<div style="--rind-popover-arrow-size:16px">${markup()}</div>`)
    const arrow = q(host, '[data-part="arrow"]')
    expect(arrow.offsetWidth).toBe(16)
    expect(arrow.offsetHeight).toBe(16)
    const b = q(host, '[data-part="close-trigger"]')
    expect(b.offsetWidth).toBeGreaterThanOrEqual(24)
    expect(b.offsetHeight).toBeGreaterThanOrEqual(24)
  })

  it("has the entry, forced-colors and reduced-motion rules and no variant attributes", () => {
    expect(popover).toMatch(/@starting-style/)
    expect(popover).toMatch(/\[data-state="closed"\]/)
    expect(popover).toMatch(/@media \(forced-colors: active\)[\s\S]*border-color: CanvasText/)
    expect(popover).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
    expect(popover).not.toMatch(/data-(variant|size|tone)/)
  })
})
