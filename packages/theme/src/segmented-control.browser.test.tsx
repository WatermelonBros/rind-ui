// add-segmented-control 7.1/7.2: the Segmented Control stylesheet alone: selected cue that is
// not colour, indicator rules (reduced motion, data-resizing), target size, physical anchoring,
// forced-colors mapping (the rendered capture is in segmented-control.pw.test.ts).
import { afterEach, describe, expect, it } from "vitest"
import segmented from "./segmented-control.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const item = (name: string, on: boolean) =>
  `<button type="button" role="radio" data-scope="segmented-control" data-part="item" aria-checked="${on}" data-state="${on ? "checked" : "unchecked"}">${name}</button>`

const markup = (indicatorAttrs = "") =>
  `<div role="radiogroup" aria-label="Range" data-scope="segmented-control" data-part="root" data-orientation="horizontal">${item("Day", false)}${item("Week", true)}<span aria-hidden="true" data-scope="segmented-control" data-part="indicator" data-orientation="horizontal" style="--rind-indicator-left:40px;--rind-indicator-width:60px;--rind-indicator-height:30px" ${indicatorAttrs}></span></div>`

const sheet = (extra = "") =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${segmented}\n${extra}`,
  )

const mediaRules = (condition: string) =>
  [...sheet().cssRules]
    .flatMap((r) => (r instanceof CSSLayerBlockRule ? [...r.cssRules] : [r]))
    .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
    .filter((r) => r.conditionText.includes(condition))
    .flatMap((r) => [...r.cssRules])
    .map((r) => r.cssText)
    .join("\n")

describe("Segmented Control stylesheet", () => {
  it("the root is a positioned inline pill", () => {
    sheet()
    const root = q(mount(markup()), '[data-part="root"]')
    const s = getComputedStyle(root)
    expect(s.position).toBe("relative")
    expect(s.display).toBe("inline-flex")
    expect(Number.parseFloat(s.borderTopLeftRadius)).toBeGreaterThan(0)
  })

  it("the selected segment differs by weight, not colour alone", () => {
    sheet()
    const host = mount(markup())
    const [off, on] = [q(host, '[aria-checked="false"]'), q(host, '[aria-checked="true"]')]
    expect(getComputedStyle(on).fontWeight).not.toBe(getComputedStyle(off).fontWeight)
  })

  it("segments are at least 24x24, even when empty, and transparent above the indicator", () => {
    sheet()
    const host = mount(markup())
    for (const b of host.querySelectorAll('[role="radio"]')) {
      b.textContent = ""
      const r = b.getBoundingClientRect()
      expect(r.width).toBeGreaterThanOrEqual(24)
      expect(r.height).toBeGreaterThanOrEqual(24)
      expect(getComputedStyle(b).backgroundColor).toBe("rgba(0, 0, 0, 0)")
      expect(Number(getComputedStyle(b).zIndex)).toBeGreaterThan(
        Number(getComputedStyle(q(host, '[data-part="indicator"]')).zIndex),
      )
    }
  })

  it("the indicator is placed from the measured variables and transitions", () => {
    sheet()
    const host = mount(markup())
    const ind = q(host, '[data-part="indicator"]')
    const root = q(host, '[data-part="root"]').getBoundingClientRect()
    const r = ind.getBoundingClientRect()
    expect(getComputedStyle(ind).position).toBe("absolute")
    expect(r.width).toBeCloseTo(60, 0)
    expect(r.height).toBeCloseTo(30, 0)
    expect(Math.round(r.left - root.left)).toBeGreaterThanOrEqual(40)
    expect(getComputedStyle(ind).transitionProperty).toMatch(/translate/)
  })

  // The measured offsets are physical, so is the anchoring (add-tabs r1).
  it.each(["ltr", "rtl"])("the indicator sits under the selected segment (%s)", (dir) => {
    sheet()
    const host = mount(`<div dir="${dir}" style="inline-size: 600px">${markup()}</div>`)
    const on = q(host, '[aria-checked="true"]')
    const ind = q(host, '[data-part="indicator"]')
    ind.style.setProperty("--rind-indicator-left", `${on.offsetLeft}px`)
    ind.style.setProperty("--rind-indicator-top", `${on.offsetTop}px`)
    ind.style.setProperty("--rind-indicator-width", `${on.offsetWidth}px`)
    ind.style.setProperty("--rind-indicator-height", `${on.offsetHeight}px`)
    ind.setAttribute("data-resizing", "")
    const [r, t] = [ind.getBoundingClientRect(), on.getBoundingClientRect()]
    expect(Math.abs(r.left - t.left)).toBeLessThan(1)
    expect(Math.abs(r.top - t.top)).toBeLessThan(1)
    expect(Math.abs(r.width - t.width)).toBeLessThan(1)
    expect(Math.abs(r.height - t.height)).toBeLessThan(1)
  })

  it("data-resizing disables the transition", () => {
    sheet()
    const ind = q(mount(markup("data-resizing")), '[data-part="indicator"]')
    expect(getComputedStyle(ind).transitionProperty).toBe("none")
    expect(Number.parseFloat(getComputedStyle(ind).transitionDuration)).toBe(0)
  })

  it("reduced motion removes the indicator transition (rule present)", () => {
    expect(mediaRules("prefers-reduced-motion")).toMatch(
      /transition: none|transition-property: none/,
    )
  })

  it("disabled changes the cursor", () => {
    sheet()
    const b = q(mount(markup()), '[role="radio"]')
    const enabled = getComputedStyle(b).cursor
    b.setAttribute("data-disabled", "")
    expect(getComputedStyle(b).cursor).not.toBe(enabled)
  })

  // Forced colors cannot be emulated from Vitest browser mode: the rendered check is in
  // segmented-control.pw.test.ts. Here the system-colour mapping must exist.
  it("forced colors: a Highlight border on the selected segment, GrayText when disabled", () => {
    const rules = mediaRules("forced-colors")
    expect(rules).toMatch(/border-color: highlight/i)
    expect(rules).toMatch(/graytext/i)
  })

  // Logical properties everywhere except the indicator, whose measured offsets are physical.
  it("has no [hidden] override and uses logical properties outside the indicator", () => {
    const css = segmented.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).not.toMatch(/\[hidden\]/)
    const rest = css.replace(
      /:where\(\[data-scope="segmented-control"\]\[data-part="indicator"\][^{]*\{[^}]*\}/g,
      "",
    )
    expect(rest).not.toMatch(/\b(left|right|margin-left|margin-right):/)
  })
})
