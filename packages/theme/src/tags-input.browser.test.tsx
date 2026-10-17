// add-tags-input: the Tags Input stylesheet alone: target sizes, variant x size matrix, danger
// tone for invalid and refused, Input sizing, chip border and highlight outline, forced colors.
import { afterEach, describe, expect, it } from "vitest"
import tagsInput from "./tags-input.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const a = (part: string, extra = "") => `data-scope="tags-input" data-part="${part}" ${extra}`

const markup = (control = "", chip = "") => `<div ${a("control", control)}>
  <div role="toolbar" aria-label="Tags" ${a("chips")}>
    <span ${a("chip", chip)}><span ${a("chip-text")}>rome</span><button type="button" aria-label="Remove rome" ${a("chip-remove")}>x</button></span>
    <span ${a("chip", "data-highlighted")}><span ${a("chip-text")}>paris</span><button type="button" aria-label="Remove paris" ${a("chip-remove")}>x</button></span>
  </div>
  <input aria-label="Tags" ${a("input")}>
  <button type="button" aria-label="Clear" ${a("clear-trigger", "data-visible")}></button>
</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${tagsInput}`,
  )

const control = (host: HTMLElement) => q(host, '[data-part="control"]')

describe("Tags Input stylesheet", () => {
  it("chip remove and clear button are at least 24px", () => {
    sheet()
    const host = mount(markup())
    for (const s of ['[data-part="chip-remove"]', '[data-part="clear-trigger"]']) {
      const el = q(host, s)
      expect(el.offsetWidth, s).toBeGreaterThanOrEqual(24)
      expect(el.offsetHeight, s).toBeGreaterThanOrEqual(24)
    }
  })

  it("the clear button is hidden until it has something to clear", () => {
    sheet()
    const host = mount(markup())
    q(host, '[data-part="clear-trigger"]').removeAttribute("data-visible")
    expect(getComputedStyle(q(host, '[data-part="clear-trigger"]')).display).toBe("none")
  })

  it("a chip has a visible border and the highlighted chip an outline", () => {
    sheet()
    const host = mount(markup())
    const [plain, lit] = [q(host, '[data-part="chip"]'), q(host, "[data-highlighted]")]
    expect(Number.parseFloat(getComputedStyle(plain).borderTopWidth)).toBeGreaterThan(0)
    expect(getComputedStyle(plain).outlineStyle).toBe("none")
    expect(getComputedStyle(lit).outlineStyle).toBe("solid")
    expect(Number.parseFloat(getComputedStyle(lit).outlineWidth)).toBeGreaterThan(0)
  })

  it("data-variant changes the Control and the Chip", () => {
    sheet()
    const bg = (v: string) =>
      getComputedStyle(control(mount(markup(`data-variant="${v}"`)))).backgroundColor
    expect(bg("soft")).not.toBe(bg("outline"))
    expect(bg("solid")).not.toBe(bg("outline"))
    expect(bg("ghost")).toBe("rgba(0, 0, 0, 0)")
    const chip = (v: string) =>
      getComputedStyle(q(mount(markup("", `data-variant="${v}"`)), '[data-part="chip"]'))
        .backgroundColor
    expect(chip("solid")).not.toBe(chip("soft"))
    expect(chip("outline")).toBe("rgba(0, 0, 0, 0)")
  })

  it("data-size changes the Control and the Chip", () => {
    sheet()
    const size = (s: string) => {
      const host = mount(`<div data-size="${s}">${markup()}</div>`)
      return {
        control: control(host).getBoundingClientRect().height,
        font: Number.parseFloat(getComputedStyle(q(host, '[data-part="chip"]')).fontSize),
      }
    }
    expect(size("lg").control).toBeGreaterThan(size("sm").control)
    expect(size("lg").font).toBeGreaterThan(size("sm").font)
  })

  it("invalid and refused double the border", () => {
    sheet()
    const w = (host: HTMLElement) =>
      Number.parseFloat(getComputedStyle(control(host)).borderTopWidth)
    const plain = w(mount(markup()))
    expect(w(mount(markup("data-invalid")))).toBeGreaterThan(plain)
    const refused = mount(markup())
    q(refused, '[data-part="input"]').setAttribute("data-refused", "duplicate")
    expect(w(refused)).toBeGreaterThan(plain)
  })

  it("the Input has a minimum width, grows with flex and uses field-sizing", () => {
    sheet()
    const host = mount(markup())
    const s = getComputedStyle(q(host, '[data-part="input"]'))
    expect(s.flexGrow).toBe("1")
    expect(s.minWidth).not.toBe("0px")
    expect(CSS.supports("field-sizing", "content") ? s.fieldSizing : "content").toBe("content")
  })

  it("reads the --rind-tags-input-* tokens, falling back to --rind-combobox-*", () => {
    sheet()
    const own = mount(
      `<div style="--rind-tags-input-control-radius:9px;--rind-tags-input-chip-bg:rgb(1, 2, 3)">${markup()}</div>`,
    )
    expect(getComputedStyle(control(own)).borderTopLeftRadius).toBe("9px")
    const chipBg = getComputedStyle(
      q(
        mount(`<div style="--rind-tags-input-chip-bg:rgb(1, 2, 3)">${markup()}</div>`),
        '[data-part="chip"]',
      ),
    ).backgroundColor
    expect(chipBg).toBe("rgb(1, 2, 3)")
    const fallback = getComputedStyle(
      q(
        mount(`<div style="--rind-combobox-chip-bg:rgb(4, 5, 6)">${markup()}</div>`),
        '[data-part="chip"]',
      ),
    ).backgroundColor
    expect(fallback).toBe("rgb(4, 5, 6)")
  })

  it("forced colors: chip border, highlighted chip outline, GrayText rules exist", () => {
    const css = tagsInput.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*part="chip"\]\) \{\s*border-color: CanvasText[\s\S]*data-highlighted\]\) \{\s*outline: 2px solid Highlight[\s\S]*/,
    )
    expect(css).toMatch(/GrayText/)
    expect(css).not.toMatch(/\[hidden\]/)
  })
})
