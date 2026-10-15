// add-tabs 8.2: the Tabs stylesheet alone: selected cue that is not colour, indicator
// transition rules (reduced motion, data-resizing), target size, forced-colors mapping.
import { afterEach, describe, expect, it } from "vitest"
import tabs from "./tabs.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const tab = (name: string, on: boolean) =>
  `<button type="button" role="tab" data-scope="tabs" data-part="tab" aria-selected="${on}"${on ? " data-selected" : ""}>${name}</button>`

const markup = (indicatorAttrs = "") =>
  `<div data-scope="tabs" data-part="root" data-orientation="horizontal"><div role="tablist" aria-label="Sections" data-scope="tabs" data-part="list" data-orientation="horizontal">${tab("Account", false)}${tab("Billing", true)}<span aria-hidden="true" data-scope="tabs" data-part="indicator" data-orientation="horizontal" style="--rind-indicator-left:40px;--rind-indicator-width:60px" ${indicatorAttrs}></span></div></div>`

const sheet = (extra = "") =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${tabs}\n${extra}`,
  )

const forcedColors = () =>
  [...sheet().cssRules]
    .flatMap((r) => (r instanceof CSSLayerBlockRule ? [...r.cssRules] : [r]))
    .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
    .filter((r) => r.conditionText.includes("forced-colors"))
    .flatMap((r) => [...r.cssRules])
    .map((r) => r.cssText)
    .join("\n")

describe("Tabs stylesheet", () => {
  it("the selected tab differs by weight, not colour alone", () => {
    sheet()
    const host = mount(markup())
    const [off, on] = [q(host, '[aria-selected="false"]'), q(host, '[aria-selected="true"]')]
    expect(getComputedStyle(on).fontWeight).not.toBe(getComputedStyle(off).fontWeight)
  })

  it("tabs are at least 24x24, even when empty", () => {
    sheet()
    const host = mount(markup())
    for (const b of host.querySelectorAll('[role="tab"]')) {
      b.textContent = ""
      const r = b.getBoundingClientRect()
      expect(r.width).toBeGreaterThanOrEqual(24)
      expect(r.height).toBeGreaterThanOrEqual(24)
    }
  })

  it("the indicator is placed from the measured variables and transitions", () => {
    sheet()
    const host = mount(markup())
    const ind = q(host, '[data-part="indicator"]')
    const list = q(host, '[data-part="list"]').getBoundingClientRect()
    const r = ind.getBoundingClientRect()
    expect(getComputedStyle(ind).position).toBe("absolute")
    expect(r.width).toBeCloseTo(60, 0)
    expect(Math.round(r.left - list.left)).toBeGreaterThanOrEqual(40)
    expect(getComputedStyle(ind).transitionProperty).toMatch(/translate|inline-size|width/)
  })

  // review fix (add-tabs r1): the measured offsets are physical, so is the anchoring.
  it.each(["ltr", "rtl"])("the indicator sits under the selected tab (%s)", (dir) => {
    sheet()
    const host = mount(`<div dir="${dir}" style="inline-size: 600px">${markup()}</div>`)
    const list = q(host, '[data-part="list"]')
    list.style.display = "flex"
    list.style.position = "relative"
    const on = q(host, '[aria-selected="true"]')
    const ind = q(host, '[data-part="indicator"]')
    ind.style.setProperty("--rind-indicator-left", `${on.offsetLeft}px`)
    ind.style.setProperty("--rind-indicator-width", `${on.offsetWidth}px`)
    ind.setAttribute("data-resizing", "")
    const [r, t] = [ind.getBoundingClientRect(), on.getBoundingClientRect()]
    expect(Math.abs(r.left - t.left)).toBeLessThan(1)
    expect(Math.abs(r.width - t.width)).toBeLessThan(1)
  })

  it("data-resizing disables the transition", () => {
    sheet()
    const ind = q(mount(markup("data-resizing")), '[data-part="indicator"]')
    expect(getComputedStyle(ind).transitionProperty).toBe("none")
    expect(Number.parseFloat(getComputedStyle(ind).transitionDuration)).toBe(0)
  })

  it("reduced motion removes the indicator transition (rule present)", () => {
    sheet()
    const css = [...sheet().cssRules]
      .flatMap((r) => (r instanceof CSSLayerBlockRule ? [...r.cssRules] : [r]))
      .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
      .filter((r) => r.conditionText.includes("prefers-reduced-motion"))
      .flatMap((r) => [...r.cssRules])
      .map((r) => r.cssText)
      .join("\n")
    expect(css).toMatch(/transition: none|transition-property: none/)
  })

  it("disabled changes the cursor", () => {
    sheet()
    const b = q(mount(markup()), '[role="tab"]')
    const enabled = getComputedStyle(b).cursor
    b.setAttribute("data-disabled", "")
    expect(getComputedStyle(b).cursor).not.toBe(enabled)
  })

  // Forced colors cannot be emulated from Vitest browser mode: the rendered check is in
  // tabs.pw.test.ts. Here the system-colour mapping must exist.
  it("forced colors: a Highlight bottom border on the selected tab, GrayText when disabled", () => {
    const rules = forcedColors()
    expect(rules).toMatch(/border-block-end-color: highlight/i)
    expect(rules).toMatch(/graytext/i)
  })

  // Logical properties everywhere except the indicator, whose measured offsets are physical.
  it("has no [hidden] override and uses logical properties outside the indicator", () => {
    const css = tabs.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).not.toMatch(/\[hidden\]/)
    const rest = css.replace(
      /:where\(\[data-scope="tabs"\]\[data-part="indicator"\][^{]*\{[^}]*\}/g,
      "",
    )
    expect(rest).not.toMatch(/\b(left|right|margin-left|margin-right):/)
  })
})
