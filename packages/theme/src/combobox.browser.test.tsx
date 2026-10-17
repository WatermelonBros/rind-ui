// add-combobox: the Combobox stylesheet alone: target sizes, selected cue that is not colour,
// popup clamped to the anchor and the available space, variants, forced-colors rules.
import { afterEach, describe, expect, it } from "vitest"
import combobox from "./combobox.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const a = (part: string, extra = "") => `data-scope="combobox" data-part="${part}" ${extra}`

const markup = (control = "", popup = "") => `<div ${a("control", control)}>
  <input role="combobox" aria-label="Fruit" ${a("input")}>
  <button type="button" aria-label="Clear" ${a("clear-trigger", "data-visible")}></button>
  <button type="button" aria-label="Open" ${a("trigger", 'data-state="closed"')}></button>
</div>
<div ${a("popup", `data-side="bottom" data-state="open" ${popup}`)}>
  <div role="listbox" ${a("list")}>
    <div role="option" ${a("item", 'data-state="unchecked"')}><span ${a("item-text")}>Apple</span><span ${a("item-indicator", 'data-state="unchecked"')}></span></div>
    <div role="option" aria-selected="true" ${a("item", 'data-state="checked" data-highlighted')}><span ${a("item-text")}>Pear</span><span ${a("item-indicator", 'data-state="checked"')}></span></div>
  </div>
</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${combobox}`,
  )

describe("Combobox stylesheet", () => {
  it("trigger, clear button and options are at least 24px", () => {
    sheet()
    const host = mount(markup())
    for (const s of [
      '[data-part="trigger"]',
      '[data-part="clear-trigger"]',
      '[data-part="item"]',
    ]) {
      const r = { width: q(host, s).offsetWidth, height: q(host, s).offsetHeight }
      expect(r.width, s).toBeGreaterThanOrEqual(24)
      expect(r.height, s).toBeGreaterThanOrEqual(24)
    }
  })

  it("the clear button is hidden until it has something to clear", () => {
    sheet()
    const host = mount(markup())
    q(host, '[data-part="clear-trigger"]').removeAttribute("data-visible")
    expect(getComputedStyle(q(host, '[data-part="clear-trigger"]')).display).toBe("none")
  })

  it("selected differs from unselected by more than colour", () => {
    sheet()
    const host = mount(markup())
    const [off, on] = [q(host, '[data-state="unchecked"]'), q(host, '[data-state="checked"]')]
    expect(getComputedStyle(on).backgroundColor).not.toBe(getComputedStyle(off).backgroundColor)
    expect(Number(getComputedStyle(on).fontWeight)).toBeGreaterThan(
      Number(getComputedStyle(off).fontWeight),
    )
    expect(
      q(host, '[data-part="item-indicator"][data-state="unchecked"]').checkVisibility({
        visibilityProperty: true,
      }),
    ).toBe(false)
    expect(
      q(host, '[data-part="item-indicator"][data-state="checked"]').getBoundingClientRect().width,
    ).toBeGreaterThan(0)
  })

  it("the popup is as wide as the anchor and clamped to the available height", () => {
    sheet()
    const host = mount(
      `<div style="--rind-anchor-width:240px;--rind-available-height:90px;--rind-available-width:400px">${markup()}</div>`,
    )
    const s = getComputedStyle(q(host, '[data-part="popup"]'))
    expect(s.width).toBe("240px")
    expect(s.maxHeight).toBe("90px")
  })

  it("reads the --rind-combobox-* tokens", () => {
    sheet()
    const host = mount(
      `<div style="--rind-combobox-popup-bg:rgb(1, 2, 3);--rind-combobox-control-radius:9px;--rind-combobox-item-height:40px">${markup()}</div>`,
    )
    expect(getComputedStyle(q(host, '[data-part="popup"]')).backgroundColor).toBe("rgb(1, 2, 3)")
    expect(getComputedStyle(q(host, '[data-part="control"]')).borderTopLeftRadius).toBe("9px")
    expect(q(host, '[data-part="item"]').offsetHeight).toBe(40)
  })

  it("data-variant and data-size change the Control", () => {
    sheet()
    const bg = (v: string) =>
      getComputedStyle(q(mount(markup(`data-variant="${v}"`)), '[data-part="control"]'))
        .backgroundColor
    expect(bg("soft")).not.toBe(bg("outline"))
    expect(bg("ghost")).toBe("rgba(0, 0, 0, 0)")
    const h = (s: string) =>
      q(
        mount(`<div data-size="${s}">${markup()}</div>`),
        '[data-part="control"]',
      ).getBoundingClientRect().height
    expect(h("lg")).toBeGreaterThan(h("sm"))
  })

  it("invalid doubles the border", () => {
    sheet()
    const host = mount(markup("data-invalid"))
    const plain = mount(markup())
    expect(
      Number.parseFloat(getComputedStyle(q(host, '[data-part="control"]')).borderTopWidth),
    ).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(q(plain, '[data-part="control"]')).borderTopWidth),
    )
  })

  it("forced colors: highlight outline, SelectedItem check, GrayText rules exist", () => {
    const css = combobox.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*outline[\s\S]*SelectedItem[\s\S]*item-indicator[\s\S]*GrayText/,
    )
    expect(css).not.toMatch(/\[hidden\]/)
  })
})
