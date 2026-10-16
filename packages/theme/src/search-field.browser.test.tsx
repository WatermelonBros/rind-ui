// add-search-field: the Search Field stylesheet alone, on the markup core renders: native
// search chrome reset, icon space, ClearTrigger inside the field at 24px, forced colors.
import { afterEach, describe, expect, it } from "vitest"
import searchField from "./search-field.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${searchField}`,
  )

const a = (part: string, extra = "") => `data-scope="search-field" data-part="${part}" ${extra}`

const markup = (root = "", icon = true) => `<div ${a("root", root)}>
  <label ${a("label")}>Search</label>
  ${icon ? `<span aria-hidden="true" ${a("icon")}></span>` : ""}
  <input type="search" aria-label="Search" value="x" ${a("input")}>
  <button type="button" aria-label="Clear" ${a("clear-trigger")}></button>
</div>`

const parts = (html: string) => {
  const host = mount(html)
  return {
    input: q(host, '[data-part="input"]'),
    clear: q(host, '[data-part="clear-trigger"]'),
  }
}

describe("Search Field stylesheet", () => {
  it("the input is a bordered field with the native search chrome reset", () => {
    sheet()
    const { input } = parts(markup())
    const style = getComputedStyle(input)
    expect(style.borderTopStyle).toBe("solid")
    expect(style.appearance || style.webkitAppearance).toBe("none")
  })

  it("the ClearTrigger is at least 24x24, transparent, inside the input's box", () => {
    sheet()
    const { input, clear } = parts(markup())
    const c = clear.getBoundingClientRect()
    const i = input.getBoundingClientRect()
    expect(c.width).toBeGreaterThanOrEqual(24)
    expect(c.height).toBeGreaterThanOrEqual(24)
    expect(c.left).toBeGreaterThanOrEqual(i.left)
    expect(c.right).toBeLessThanOrEqual(i.right)
    expect(c.top).toBeGreaterThanOrEqual(i.top)
    expect(c.bottom).toBeLessThanOrEqual(i.bottom)
    const style = getComputedStyle(clear)
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    const glyph = getComputedStyle(clear, "::after")
    expect(glyph.backgroundColor).toBe(style.color)
    expect(glyph.maskImage || glyph.webkitMaskImage).not.toBe("none")
  })

  it("the input reserves room for the clear trigger and, with an icon, for the icon", () => {
    sheet()
    const { input, clear } = parts(markup())
    const pad = Number.parseFloat(getComputedStyle(input).paddingRight)
    expect(pad).toBeGreaterThanOrEqual(
      input.getBoundingClientRect().right - clear.getBoundingClientRect().left,
    )
    const withIcon = Number.parseFloat(getComputedStyle(input).paddingLeft)
    cleanup()
    sheet()
    const without = Number.parseFloat(getComputedStyle(parts(markup("", false)).input).paddingLeft)
    expect(withIcon).toBeGreaterThan(without)
  })

  it("the icon slot does not cover the text start", () => {
    sheet()
    const host = mount(markup())
    const icon = q(host, '[data-part="icon"]').getBoundingClientRect()
    const input = q(host, '[data-part="input"]')
    const textStart =
      input.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(input).paddingLeft)
    expect(icon.right).toBeLessThanOrEqual(textStart)
  })

  it("invalid doubles the border; the trigger stays inside", () => {
    sheet()
    const { input, clear } = parts(markup("data-invalid"))
    expect(getComputedStyle(input).borderTopWidth).toBe("2px")
    expect(clear.getBoundingClientRect().right).toBeLessThanOrEqual(
      input.getBoundingClientRect().right - 2,
    )
  })

  it("forced colors: field boundary and the ClearTrigger glyph have system colours", () => {
    const css = searchField.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*FieldText[\s\S]*ButtonText[\s\S]*GrayText/,
    )
    expect(css).not.toMatch(/\[hidden\]/)
  })
})
