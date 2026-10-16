// add-number-input 8.1: the Number Input stylesheet alone, on the markup core renders: a
// bordered field, the ring on the Control, 24px steppers with currentColor glyphs, the
// at-bound state, tabular numerals, soft and invalid, forced-colors rules.
import { afterEach, describe, expect, it } from "vitest"
import numberInput from "./number-input.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${numberInput}`,
  )

const a = (part: string, extra = "") =>
  `data-scope="number-input" data-part="${part}" data-instance="n" ${extra}`

const markup = (root = "", control = "", inc = "") => `<div ${a("root", root)}>
  <label ${a("label")}>Quantity</label>
  <div ${a("control", control)}>
    <button type="button" tabindex="-1" aria-label="Decrease" ${a("decrement-trigger")}></button>
    <input type="text" role="spinbutton" aria-label="Quantity" value="12" ${a("input")}>
    <button type="button" tabindex="-1" aria-label="Increase" ${a("increment-trigger", inc)}></button>
  </div>
</div>`

const parts = (html: string) => {
  const host = mount(html)
  return {
    root: q(host, '[data-part="root"]'),
    control: q(host, '[data-part="control"]'),
    input: q(host, '[data-part="input"]'),
    inc: q(host, '[data-part="increment-trigger"]'),
  }
}

describe("Number Input stylesheet", () => {
  it("the Control is a bordered field; the input is borderless and tabular", () => {
    sheet()
    const { control, input } = parts(markup())
    expect(getComputedStyle(control).borderTopStyle).toBe("solid")
    expect(getComputedStyle(input).borderTopStyle).toBe("none")
    expect(getComputedStyle(input).fontVariantNumeric).toContain("tabular-nums")
  })

  it("steppers are at least 24px and draw a glyph in currentColor", () => {
    sheet()
    const { inc } = parts(markup())
    const r = inc.getBoundingClientRect()
    expect(r.width).toBeGreaterThanOrEqual(24)
    expect(r.height).toBeGreaterThanOrEqual(24)
    const glyph = getComputedStyle(inc, "::after")
    expect(glyph.backgroundColor).toBe(getComputedStyle(inc).color)
    expect(glyph.maskImage || glyph.webkitMaskImage).not.toBe("none")
  })

  it("the ring is on the Control while the input has keyboard focus", () => {
    sheet()
    const { control } = parts(markup("", "data-focus-visible"))
    expect(getComputedStyle(control).outlineStyle).toBe("solid")
  })

  it("a stepper at its bound is dimmed with a not-allowed cursor", () => {
    sheet()
    const { inc } = parts(markup("", "", "data-disabled"))
    expect(Number(getComputedStyle(inc).opacity)).toBeLessThan(1)
    expect(getComputedStyle(inc).cursor).toBe("not-allowed")
  })

  it("soft and invalid change the field", () => {
    sheet()
    const base = getComputedStyle(parts(markup()).control).backgroundColor
    cleanup()
    sheet()
    expect(getComputedStyle(parts(markup('data-variant="soft"')).control).backgroundColor).not.toBe(
      base,
    )
    cleanup()
    sheet()
    expect(getComputedStyle(parts(markup("data-invalid")).control).borderTopWidth).not.toBe(
      getComputedStyle(document.documentElement).getPropertyValue("--rind-border-width"),
    )
  })

  it("data-size changes the field height", () => {
    sheet()
    const md = parts(markup()).control.getBoundingClientRect().height
    cleanup()
    sheet()
    const lg = parts(markup('data-size="lg"')).control.getBoundingClientRect().height
    expect(lg).toBeGreaterThan(md)
  })

  it("forced colors: field, ring and at-bound GrayText rules exist", () => {
    const css = numberInput.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*FieldText[\s\S]*Highlight[\s\S]*GrayText/,
    )
    expect(css).not.toMatch(/\[hidden\]/)
  })
})
