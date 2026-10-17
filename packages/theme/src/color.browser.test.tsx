// add-color-picker 10.1, color-picker-one-scope: the Color Picker's one stylesheet alone, on
// markup shaped like its parts (every part under `data-scope="color-picker"`). The
// rendered captures (forced colors, RTL, vertical, alpha checkerboard) are in the Playwright
// fixture of @rind-ui/testing.
import { afterEach, describe, expect, it } from "vitest"
import picker from "./color-picker.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${picker}`,
  )

describe("colour stylesheets", () => {
  it("the area is a 12rem square with a double-ringed thumb", () => {
    sheet()
    const host = mount(
      `<div data-scope="color-picker" data-part="area" style="position:relative"><div data-scope="color-picker" data-part="area-background"></div><div data-scope="color-picker" data-part="area-thumb" style="position:absolute;--rind-color:#336699"></div></div>`,
    )
    const root = q(host, '[data-part="area"]')
    const r = root.getBoundingClientRect()
    expect(r.width).toBe(r.height)
    expect(r.width).toBeCloseTo(192, 0)
    const thumb = getComputedStyle(q(host, '[data-part="area-thumb"]'))
    expect(thumb.boxShadow).toMatch(/0px 0px 0px 2px[\s\S]*0px 0px 0px 3px/)
    expect(thumb.backgroundColor).toBe("rgb(51, 102, 153)")
  })

  it("a transparent swatch layers its colour over the checkerboard", () => {
    sheet()
    const host = mount(
      `<div data-scope="color-picker" data-part="swatch" data-transparent style="--rind-color:rgba(255,0,0,0.5);background-color:rgba(255,0,0,0.5)"></div>`,
    )
    const s = getComputedStyle(q(host, '[data-part="swatch"]'))
    expect(s.backgroundImage).toContain("linear-gradient")
    expect(s.backgroundImage).toContain("conic-gradient")
    expect(s.boxShadow).not.toBe("none")
  })

  it("a colour slider's track has no fill of its own (a grid shows through alpha)", () => {
    sheet()
    const host = mount(
      `<div data-scope="color-picker" data-part="channel-slider" data-channel="alpha"><div data-scope="color-picker" data-part="channel-slider-track" data-channel="alpha"></div></div>`,
    )
    expect(getComputedStyle(q(host, '[data-part="channel-slider-track"]')).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
  })

  it("an invalid field changes its border width, not only its colour", () => {
    sheet()
    const host = mount(
      `<input data-scope="color-picker" data-part="channel-input"><input data-scope="color-picker" data-part="channel-input" data-invalid>`,
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

  it("has forced-colors rules and no selector outside the picker's scope", () => {
    expect(picker).toMatch(/@media \(forced-colors: active\)/)
    for (const scope of picker.matchAll(/data-scope="([^"]+)"/g))
      expect(scope[1]).toBe("color-picker")
  })
})
