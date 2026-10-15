// add-radio-group 7.1: the Radio Group stylesheet alone: ring, dot, layout by orientation,
// target size, forced-colors mapping (the rendered captures are in radio-group.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import radioGroup from "./radio-group.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const item = (
  name: string,
  checked: boolean,
) => `<div data-scope="radio-group" data-part="item" data-state="${checked ? "checked" : "unchecked"}">
  <button type="button" role="radio" data-scope="radio-group" data-part="item-control" data-rind-pressable data-state="${checked ? "checked" : "unchecked"}">${checked ? '<span data-scope="radio-group" data-part="item-indicator" aria-hidden="true" data-state="checked"></span>' : ""}</button>
  <label data-scope="radio-group" data-part="item-label">${name}</label>
</div>`

const markup = (
  orientation = "vertical",
  dir = "ltr",
) => `<div dir="${dir}" data-scope="radio-group" data-part="root" data-orientation="${orientation}">
  <span data-scope="radio-group" data-part="label">Size</span>
  ${item("S", false)}${item("M", true)}${item("L", false)}
</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${radioGroup}`,
  )

const forcedColors = () => {
  const css = sheet()
  return [...css.cssRules]
    .flatMap((r) => (r instanceof CSSLayerBlockRule ? [...r.cssRules] : [r]))
    .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
    .filter((r) => r.conditionText.includes("forced-colors"))
    .flatMap((r) => [...r.cssRules])
    .map((r) => r.cssText)
    .join("\n")
}

describe("Radio Group stylesheet", () => {
  it("the control is a round ring and the target is at least 24x24", () => {
    sheet()
    const host = mount(markup())
    const control = q(host, '[data-part="item-control"]')
    const s = getComputedStyle(control)
    expect(s.borderTopStyle).toBe("solid")
    expect(Number.parseFloat(s.borderTopWidth)).toBeGreaterThan(0)
    expect(Number.parseFloat(s.borderTopLeftRadius)).toBeGreaterThanOrEqual(
      control.getBoundingClientRect().width / 2,
    )
    const hit = getComputedStyle(control, "::before")
    expect(Number.parseFloat(hit.width)).toBeGreaterThanOrEqual(24)
    expect(Number.parseFloat(hit.height)).toBeGreaterThanOrEqual(24)
  })

  it("the dot is a currentColor circle inside the ring, only for the checked item", () => {
    sheet()
    const host = mount(markup())
    const dot = q(host, '[data-part="item-indicator"]')
    const control = q(host, '[data-state="checked"][data-part="item-control"]')
    const s = getComputedStyle(dot)
    expect(s.backgroundColor).toBe(getComputedStyle(control).color)
    const d = dot.getBoundingClientRect()
    expect(d.width).toBeGreaterThan(0)
    expect(d.width).toBeCloseTo(d.height, 0)
    expect(d.width).toBeLessThan(control.getBoundingClientRect().width)
    expect(host.querySelectorAll('[data-part="item-indicator"]')).toHaveLength(1)
  })

  it("checked differs from unchecked by more than the dot colour: the ring changes too", () => {
    sheet()
    const host = mount(markup())
    const [off, on] = [
      q(host, '[data-state="unchecked"][data-part="item-control"]'),
      q(host, '[data-state="checked"][data-part="item-control"]'),
    ]
    expect(getComputedStyle(on).borderTopColor).not.toBe(getComputedStyle(off).borderTopColor)
  })

  it("vertical stacks the items, horizontal puts them in one row", () => {
    sheet()
    const rows = (orientation: string) => {
      const host = mount(markup(orientation))
      const tops = [...host.querySelectorAll('[data-part="item"]')].map(
        (el) => el.getBoundingClientRect().top,
      )
      cleanup()
      sheet()
      return new Set(tops).size
    }
    expect(rows("vertical")).toBe(3)
    expect(rows("horizontal")).toBe(1)
  })

  it("horizontal follows the reading direction", () => {
    sheet()
    const firstLeft = (dir: string) => {
      const host = mount(markup("horizontal", dir))
      const lefts = [...host.querySelectorAll('[data-part="item"]')].map(
        (el) => el.getBoundingClientRect().left,
      )
      cleanup()
      sheet()
      return lefts
    }
    const [ltr, rtl] = [firstLeft("ltr"), firstLeft("rtl")]
    expect(ltr[0]).toBeLessThan(ltr[2] as number)
    expect(rtl[0]).toBeGreaterThan(rtl[2] as number)
  })

  it("the label is part of the target", () => {
    sheet()
    const host = mount(markup())
    expect(
      q(host, '[data-part="item-label"]').getBoundingClientRect().height,
    ).toBeGreaterThanOrEqual(24)
  })

  it("disabled changes the cursor", () => {
    sheet()
    const host = mount(markup())
    const control = q(host, '[data-part="item-control"]')
    const enabled = getComputedStyle(control).cursor
    control.setAttribute("data-disabled", "")
    expect(getComputedStyle(control).cursor).not.toBe(enabled)
  })

  // Forced colors cannot be emulated from Vitest browser mode: the rendered check is in
  // radio-group.pw.test.ts. Here the system-colour mapping must exist.
  it("forced colors: ButtonText ring, Highlight dot, GrayText when disabled", () => {
    const rules = forcedColors()
    expect(rules).toMatch(/item-control[^{]*\{[^}]*border-color: buttontext/i)
    expect(rules).toMatch(/item-indicator[^{]*\{[^}]*highlight/i)
    expect(rules).toMatch(/graytext/i)
  })

  it("has no [hidden] override, uses duration tokens and logical properties only", () => {
    const css = radioGroup.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).not.toMatch(/\[hidden\]/)
    expect(css).toMatch(/--rind-duration-fast/)
    expect(css).not.toMatch(/\b(left|right|margin-left|margin-right):/)
  })
})
