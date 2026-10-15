// add-toggle-group 6.1: the Toggle Group stylesheet alone: on cue that is not colour, joined
// borders by orientation, target size, forced-colors mapping (rendered captures are in
// toggle-group.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q } from "./test-css"
import toggleGroup from "./toggle-group.css?inline"

afterEach(cleanup)

const item = (name: string, on: boolean) =>
  `<button type="button" data-scope="toggle-group" data-part="item" aria-pressed="${on}" data-state="${on ? "on" : "off"}">${name}</button>`

const markup = (orientation = "horizontal", dir = "ltr") =>
  `<div dir="${dir}" role="group" aria-label="Format" data-scope="toggle-group" data-part="root" data-orientation="${orientation}">${item("Bold", false)}${item("Italic", true)}${item("Underline", false)}</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${toggleGroup}`,
  )

const forcedColors = () =>
  [...sheet().cssRules]
    .flatMap((r) => (r instanceof CSSLayerBlockRule ? [...r.cssRules] : [r]))
    .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
    .filter((r) => r.conditionText.includes("forced-colors"))
    .flatMap((r) => [...r.cssRules])
    .map((r) => r.cssText)
    .join("\n")

const rects = (host: HTMLElement) =>
  [...host.querySelectorAll("button")].map((b) => b.getBoundingClientRect())

describe("Toggle Group stylesheet", () => {
  it("on adds an outline and a background, not colour alone", () => {
    sheet()
    const host = mount(markup())
    const [off, on] = [q(host, '[data-state="off"]'), q(host, '[data-state="on"]')]
    expect(getComputedStyle(off).outlineStyle).toBe("none")
    expect(getComputedStyle(on).outlineStyle).toBe("solid")
    expect(Number.parseFloat(getComputedStyle(on).outlineWidth)).toBeGreaterThan(0)
    expect(getComputedStyle(on).backgroundColor).not.toBe(getComputedStyle(off).backgroundColor)
  })

  it("items are at least 24x24, even when empty", () => {
    sheet()
    const host = mount(markup())
    for (const b of host.querySelectorAll("button")) b.textContent = ""
    for (const r of rects(host)) {
      expect(r.width).toBeGreaterThanOrEqual(24)
      expect(r.height).toBeGreaterThanOrEqual(24)
    }
  })

  it("horizontal: one row, adjacent items share a border", () => {
    sheet()
    const [a, b] = rects(mount(markup("horizontal")))
    expect(a?.top).toBe(b?.top)
    expect(Math.round((a?.right ?? 0) - (b?.left ?? 0))).toBeGreaterThan(0)
  })

  it("vertical: one column, adjacent items share a border", () => {
    sheet()
    const [a, b] = rects(mount(markup("vertical")))
    expect(a?.left).toBe(b?.left)
    expect(Math.round((a?.bottom ?? 0) - (b?.top ?? 0))).toBeGreaterThan(0)
  })

  it("horizontal follows the reading direction", () => {
    sheet()
    const ltr = rects(mount(markup("horizontal", "ltr")))
    expect((ltr[0]?.left ?? 0) < (ltr[2]?.left ?? 0)).toBe(true)
    cleanup()
    sheet()
    const r = rects(mount(markup("horizontal", "rtl")))
    expect((r[0]?.left ?? 0) > (r[2]?.left ?? 0)).toBe(true)
  })

  it("disabled changes the cursor", () => {
    sheet()
    const b = q(mount(markup()), "button")
    const enabled = getComputedStyle(b).cursor
    b.setAttribute("data-disabled", "")
    expect(getComputedStyle(b).cursor).not.toBe(enabled)
  })

  // Forced colors cannot be emulated from Vitest browser mode: the rendered check is in
  // toggle-group.pw.test.ts. Here the system-colour mapping must exist.
  it("forced colors: ButtonText borders, Highlight when on, GrayText when disabled", () => {
    const rules = forcedColors()
    expect(rules).toMatch(/border-color: buttontext/i)
    expect(rules).toMatch(/highlight/i)
    expect(rules).toMatch(/graytext/i)
  })

  it("has no [hidden] override and uses logical properties only", () => {
    const css = toggleGroup.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).not.toMatch(/\[hidden\]/)
    expect(css).not.toMatch(/\b(left|right|margin-left|margin-right):/)
  })
})
