// add-tooltip 7.1: the Tooltip stylesheet on top of positioner.css: tokens, entry and exit,
// instant (delay group) without transition, arrow, reduced motion and forced colors.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q } from "./test-css"
import tooltip from "./tooltip.css?inline"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.overlay}\n${files.positioner}\n${tooltip}`,
  )

const markup = (attrs = "", state = "open") =>
  `<div data-scope="tooltip" data-part="positioner" data-side="top" data-state="${state}" style="position:absolute;top:60px;left:20px"><div role="tooltip" data-scope="tooltip" data-part="content" data-side="top" data-state="${state}" ${attrs}>Save<div data-scope="tooltip" data-part="arrow" data-side="top" style="position:absolute"></div></div></div>`

describe("Tooltip stylesheet", () => {
  it("the content has a radius and padding", () => {
    sheet()
    const s = getComputedStyle(q(mount(markup()), '[data-part="content"]'))
    expect(Number.parseFloat(s.borderTopLeftRadius)).toBeGreaterThan(0)
    expect(Number.parseFloat(s.paddingTop)).toBeGreaterThan(0)
  })

  it("reads the --rind-tooltip-* tokens", () => {
    sheet()
    const host = mount(
      `<div style="--rind-tooltip-bg:rgb(1, 2, 3);--rind-tooltip-radius:7px;--rind-tooltip-padding:11px;--rind-tooltip-max-width:150px;--rind-tooltip-font-size:19px">${markup()}</div>`,
    )
    const c = getComputedStyle(q(host, '[data-part="content"]'))
    expect(c.backgroundColor).toBe("rgb(1, 2, 3)")
    expect(c.borderTopLeftRadius).toBe("7px")
    expect(c.paddingTop).toBe("11px")
    expect(c.maxWidth).toBe("150px")
    expect(c.fontSize).toBe("19px")
  })

  it("is clamped to the available width", () => {
    sheet()
    const host = mount(`<div style="--rind-available-width:90px">${markup()}</div>`)
    expect(getComputedStyle(q(host, '[data-part="content"]')).maxWidth).toBe("90px")
  })

  it("exits to transparent when closed", () => {
    sheet()
    const s = getComputedStyle(q(mount(markup("", "closed")), '[data-part="content"]'))
    expect(s.opacity).toBe("0")
  })

  it("an instant tooltip has no transition", () => {
    sheet()
    const s = getComputedStyle(q(mount(markup("data-instant")), '[data-part="content"]'))
    expect(Number.parseFloat(s.transitionDuration)).toBe(0)
  })

  it("the arrow follows the size token", () => {
    sheet()
    const host = mount(`<div style="--rind-tooltip-arrow-size:12px">${markup()}</div>`)
    const arrow = q(host, '[data-part="arrow"]')
    expect(arrow.offsetWidth).toBe(12)
    expect(arrow.offsetHeight).toBe(12)
  })

  it("never overrides [hidden]; has entry, forced-colors and reduced-motion rules", () => {
    expect(tooltip.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\[hidden\]|display:/)
    expect(tooltip).toMatch(/@starting-style/)
    expect(tooltip).toMatch(/\[data-state="closed"\]/)
    expect(tooltip).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText/)
    expect(tooltip).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/)
    expect(tooltip).not.toMatch(/data-(variant|size|tone)/)
  })
})
