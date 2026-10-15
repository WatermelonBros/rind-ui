// add-toggle 6.1: the Toggle stylesheet alone, the on cue that is not colour, target size.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q } from "./test-css"
import toggle from "./toggle.css?inline"

afterEach(cleanup)

const markup = (state = "off") => `<button type="button" data-scope="toggle" data-part="root"
  aria-pressed="${state === "on"}" data-state="${state}">Bold</button>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${toggle}`,
  )

describe("Toggle stylesheet", () => {
  it("on adds an outline and a background, not colour alone", () => {
    sheet()
    const button = q(mount(markup()), "button")
    const off = getComputedStyle(button)
    const before = { bg: off.backgroundColor, outline: off.outlineStyle }
    expect(before.outline).toBe("none")
    button.setAttribute("data-state", "on")
    const on = getComputedStyle(button)
    expect(on.outlineStyle).toBe("solid")
    expect(Number.parseFloat(on.outlineWidth)).toBeGreaterThan(0)
    expect(on.backgroundColor).not.toBe(before.bg)
  })

  it("the target is at least 24x24, even when empty", () => {
    sheet()
    const button = q(mount(markup()), "button")
    button.textContent = ""
    const rect = button.getBoundingClientRect()
    expect(rect.width).toBeGreaterThanOrEqual(24)
    expect(rect.height).toBeGreaterThanOrEqual(24)
  })

  it("disabled reads the disabled colour", () => {
    sheet()
    const button = q(mount(markup()), "button")
    const enabled = getComputedStyle(button).color
    button.setAttribute("data-disabled", "")
    expect(getComputedStyle(button).color).not.toBe(enabled)
  })

  it("has no [hidden] override (it would defeat until-found)", () => {
    expect(toggle.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\[hidden\]/)
  })
})
