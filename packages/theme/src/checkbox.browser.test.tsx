// add-checkbox 8.1: the Checkbox stylesheet alone: box, hidden glyph, filled states, target size.
import { afterEach, describe, expect, it } from "vitest"
import checkbox from "./checkbox.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const markup = (
  state = "unchecked",
) => `<div data-scope="checkbox" data-part="root" data-state="${state}">
  <button type="button" role="checkbox" data-scope="checkbox" data-part="control" data-rind-pressable data-state="${state}"><span data-scope="checkbox" data-part="indicator" data-state="${state}"><svg width="12" height="12" aria-hidden="true"><path d="M1 6l4 4 6-8" stroke="currentColor" fill="none"/></svg></span></button>
  <label data-scope="checkbox" data-part="label">Accept</label>
</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${checkbox}`,
  )

const parts = (html: string) => {
  const host = mount(html)
  return {
    control: q(host, '[data-part="control"]'),
    indicator: q(host, '[data-part="indicator"]'),
  }
}

describe("Checkbox stylesheet", () => {
  it("the control has a visible border and the target is at least 24x24", () => {
    sheet()
    const { control } = parts(markup())
    const s = getComputedStyle(control)
    expect(s.borderTopStyle).toBe("solid")
    expect(Number.parseFloat(s.borderTopWidth)).toBeGreaterThan(0)
    const hit = getComputedStyle(control, "::before")
    expect(Number.parseFloat(hit.width)).toBeGreaterThanOrEqual(24)
    expect(Number.parseFloat(hit.height)).toBeGreaterThanOrEqual(24)
  })

  it("unchecked hides the glyph without taking it out of layout", () => {
    sheet()
    const { indicator } = parts(markup())
    const before = indicator.getBoundingClientRect()
    expect(getComputedStyle(indicator).visibility).toBe("hidden")
    indicator.setAttribute("data-state", "checked")
    expect(getComputedStyle(indicator).visibility).toBe("visible")
    const after = indicator.getBoundingClientRect()
    expect([after.width, after.height]).toEqual([before.width, before.height])
  })

  it("checked and indeterminate fill the box, not colour of the glyph alone", () => {
    sheet()
    const { control } = parts(markup())
    const bg = getComputedStyle(control).backgroundColor
    for (const state of ["checked", "indeterminate"]) {
      control.setAttribute("data-state", state)
      expect(getComputedStyle(control).backgroundColor, state).not.toBe(bg)
    }
  })

  it("the label is part of the target", () => {
    sheet()
    const host = mount(markup())
    expect(q(host, "label").getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("disabled changes the cursor", () => {
    sheet()
    const { control } = parts(markup())
    const enabled = getComputedStyle(control).cursor
    control.setAttribute("data-disabled", "")
    expect(getComputedStyle(control).cursor).not.toBe(enabled)
  })

  it("has no [hidden] override and uses duration tokens", () => {
    const css = checkbox.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).not.toMatch(/\[hidden\]/)
    expect(css).toMatch(/--rind-duration-fast/)
  })
})
