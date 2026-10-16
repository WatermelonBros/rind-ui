// add-pin-input: the Pin Input stylesheet alone, on the markup core renders: slots in a row,
// a visible slot boundary, the ring on the active slot, a fake caret, forced-colors rules.
import { afterEach, describe, expect, it } from "vitest"
import pinInput from "./pin-input.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${pinInput}`,
  )

const a = (part: string, extra = "") =>
  `data-scope="pin-input" data-part="${part}" data-instance="p" ${extra}`

const markup = (
  root = "",
  control = "",
  active = "data-active data-caret",
) => `<div ${a("root", root)}>
  <label ${a("label")}>Code</label>
  <div ${a("control", control)}>
    <input aria-label="Code" ${a("input")} style="position:absolute;inset:0;opacity:0">
    <div ${a("slot", "data-index=0 data-filled")}>1</div>
    <div ${a("slot", `data-index=1 ${active}`)}></div>
    <div ${a("slot", "data-index=2")}></div>
  </div>
</div>`

const parts = (html: string) => {
  const host = mount(html)
  return {
    root: q(host, '[data-part="root"]'),
    control: q(host, '[data-part="control"]'),
    slots: Array.from(host.querySelectorAll<HTMLElement>('[data-part="slot"]')),
  }
}

describe("Pin Input stylesheet", () => {
  it("slots sit in a row separated by the gap", () => {
    sheet()
    const { slots, control } = parts(markup())
    const [s0, s1] = slots.map((s) => s.getBoundingClientRect())
    if (!s0 || !s1) throw new Error("slots missing")
    expect(s0.top).toBe(s1.top)
    const gap = Number.parseFloat(getComputedStyle(control).columnGap)
    expect(gap).toBeGreaterThan(0)
    expect(Math.round(s1.left - s0.right)).toBe(Math.round(gap))
  })

  it("each slot has a solid boundary and tabular, centred characters", () => {
    sheet()
    const [slot] = parts(markup()).slots
    if (!slot) throw new Error("slot missing")
    const style = getComputedStyle(slot)
    expect(style.borderTopStyle).toBe("solid")
    expect(style.fontVariantNumeric).toContain("tabular-nums")
    expect(style.justifyContent).toBe("center")
  })

  it("the active slot has the ring with keyboard focus", () => {
    sheet()
    const { slots } = parts(markup("", "data-focus data-focus-visible"))
    expect(getComputedStyle(slots[1] as HTMLElement).outlineStyle).toBe("solid")
    expect(getComputedStyle(slots[0] as HTMLElement).outlineStyle).toBe("none")
  })

  it("pointer focus emphasises the border instead of drawing the ring", () => {
    sheet()
    const { slots } = parts(markup("", "data-focus"))
    const active = getComputedStyle(slots[1] as HTMLElement)
    expect(active.outlineStyle).toBe("none")
    expect(active.borderTopWidth).not.toBe(getComputedStyle(slots[0] as HTMLElement).borderTopWidth)
  })

  it("an empty active slot draws a caret that blinks", () => {
    sheet()
    const { slots } = parts(markup())
    const caret = getComputedStyle(slots[1] as HTMLElement, "::after")
    expect(caret.content).not.toBe("none")
    expect(caret.animationName).not.toBe("none")
    const other = getComputedStyle(slots[2] as HTMLElement, "::after")
    expect(other.content).toBe("none")
  })

  it("soft, invalid and data-size change the slots", () => {
    sheet()
    const base = parts(markup()).slots[0] as HTMLElement
    const bg = getComputedStyle(base).backgroundColor
    const h = base.getBoundingClientRect().height
    cleanup()
    sheet()
    expect(
      getComputedStyle(parts(markup('data-variant="soft"')).slots[0] as HTMLElement)
        .backgroundColor,
    ).not.toBe(bg)
    cleanup()
    sheet()
    expect(
      parts(markup('data-size="lg"')).slots[0]?.getBoundingClientRect().height,
    ).toBeGreaterThan(h)
    cleanup()
    sheet()
    const inv = getComputedStyle(parts(markup("data-invalid")).slots[0] as HTMLElement)
    expect(Number.parseFloat(inv.borderTopWidth)).toBeGreaterThan(1)
  })

  it("reserves the badge space at the control's inline end", () => {
    sheet()
    const { control } = parts(markup())
    const w = control.getBoundingClientRect().width
    cleanup()
    inject(
      `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${pinInput}\n@layer rind.preferences { :root { --rind-pin-input-badge-space: 40px } }`,
    )
    expect(parts(markup()).control.getBoundingClientRect().width).toBe(w + 40)
  })

  it("reduced motion stops the caret; forced colors map slots, ring and caret", () => {
    const css = pinInput.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/)
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*CanvasText[\s\S]*Highlight[\s\S]*GrayText/,
    )
  })
})
