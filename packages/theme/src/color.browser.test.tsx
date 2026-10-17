// add-color-picker 10.1: the colour stylesheets alone, on markup shaped like the parts. The
// rendered captures (forced colors, RTL, vertical, alpha checkerboard) are in the Playwright
// fixture of @rind-ui/testing.
import { afterEach, describe, expect, it } from "vitest"
import area from "./color-area.css?inline"
import checker from "./color-checker.css?inline"
import field from "./color-field.css?inline"
import picker from "./color-picker.css?inline"
import slider from "./color-slider.css?inline"
import swatch from "./color-swatch.css?inline"
import swatchPicker from "./color-swatch-picker.css?inline"
import sliderBase from "./slider.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${sliderBase}\n${checker}\n${swatch}\n${area}\n${slider}\n${field}\n${swatchPicker}\n${picker}`,
  )

describe("colour stylesheets", () => {
  it("the area is a 12rem square with a double-ringed thumb", () => {
    sheet()
    const host = mount(
      `<div data-scope="color-area" data-part="root" style="position:relative"><div data-scope="color-area" data-part="background"></div><div data-scope="color-area" data-part="thumb" style="position:absolute;--rind-color:#336699"></div></div>`,
    )
    const root = q(host, '[data-part="root"]')
    const r = root.getBoundingClientRect()
    expect(r.width).toBe(r.height)
    expect(r.width).toBeCloseTo(192, 0)
    const thumb = getComputedStyle(q(host, '[data-part="thumb"]'))
    expect(thumb.boxShadow).toMatch(/0px 0px 0px 2px[\s\S]*0px 0px 0px 3px/)
    expect(thumb.backgroundColor).toBe("rgb(51, 102, 153)")
  })

  it("a transparent swatch layers its colour over the checkerboard", () => {
    sheet()
    const host = mount(
      `<div data-scope="color-swatch" data-part="root" data-transparent style="--rind-color:rgba(255,0,0,0.5);background-color:rgba(255,0,0,0.5)"></div>`,
    )
    const s = getComputedStyle(q(host, '[data-part="root"]'))
    expect(s.backgroundImage).toContain("linear-gradient")
    expect(s.backgroundImage).toContain("conic-gradient")
    expect(s.boxShadow).not.toBe("none")
  })

  it("a colour slider's track has no fill of its own (a grid shows through alpha)", () => {
    sheet()
    const host = mount(
      `<div data-scope="slider" data-part="root" data-channel="alpha"><div data-scope="slider" data-part="track" data-channel="alpha"></div></div>`,
    )
    expect(getComputedStyle(q(host, '[data-part="track"]')).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
  })

  it("an invalid field changes its border width, not only its colour", () => {
    sheet()
    const host = mount(
      `<input data-scope="color-field" data-part="input"><input data-scope="color-field" data-part="input" data-invalid>`,
    )
    const [ok, bad] = Array.from(host.querySelectorAll("input")).map((i) => getComputedStyle(i))
    expect(Number.parseFloat(bad?.borderTopWidth ?? "0")).toBeGreaterThan(
      Number.parseFloat(ok?.borderTopWidth ?? "0"),
    )
  })

  it("the picker content is a 15rem panel", () => {
    sheet()
    const host = mount(`<div data-scope="color-picker" data-part="content"></div>`)
    expect(q(host, '[data-part="content"]').getBoundingClientRect().width).toBeCloseTo(240, 0)
  })

  it("every sheet has forced-colors rules", () => {
    for (const css of [area, slider, swatch, field, swatchPicker, picker, checker]) {
      expect(css).toMatch(/@media \(forced-colors: active\)/)
    }
  })
})
