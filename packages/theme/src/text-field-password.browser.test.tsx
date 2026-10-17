// merge-text-field-parts: the Text Field stylesheet with type="password", on the markup core
// renders: trigger inside the field, 24px target, currentColor icon, pressed without colour.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q } from "./test-css"
import textField from "./text-field.css?inline"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${textField}`,
  )

const a = (part: string, extra = "") => `data-scope="text-field" data-part="${part}" ${extra}`

const markup = (
  root = "",
  trigger = 'aria-pressed="false"',
  state = "hidden",
) => `<div ${a("root", root)}>
  <label ${a("label")}>Password</label>
  <input type="password" aria-label="Password" value="secret" data-custom-reveal ${a("input")}>
  <button type="button" aria-label="Show password" ${trigger} ${a("visibility-trigger")}>
    <span aria-hidden="true" data-state="${state}" ${a("visibility-indicator")}></span>
  </button>
</div>`

const parts = (html: string) => {
  const host = mount(html)
  return {
    input: q(host, '[data-part="input"]'),
    trigger: q(host, '[data-part="visibility-trigger"]'),
    indicator: q(host, '[data-part="visibility-indicator"]'),
  }
}

describe("Text Field stylesheet, type=password", () => {
  it("the trigger is at least 24x24 and inside the input's box", () => {
    sheet()
    const { input, trigger } = parts(markup())
    const t = trigger.getBoundingClientRect()
    const i = input.getBoundingClientRect()
    expect(t.width).toBeGreaterThanOrEqual(24)
    expect(t.height).toBeGreaterThanOrEqual(24)
    expect(t.left).toBeGreaterThanOrEqual(i.left)
    expect(t.right).toBeLessThanOrEqual(i.right)
    expect(t.top).toBeGreaterThanOrEqual(i.top)
    expect(t.bottom).toBeLessThanOrEqual(i.bottom)
  })

  it("the input reserves the trigger's space at its inline end", () => {
    sheet()
    const { input, trigger } = parts(markup())
    const pad = Number.parseFloat(getComputedStyle(input).paddingRight)
    const gap = input.getBoundingClientRect().right - trigger.getBoundingClientRect().left
    expect(pad).toBeGreaterThanOrEqual(gap)
  })

  it("the icon is drawn in currentColor, and the state swaps the glyph", () => {
    sheet()
    const { trigger, indicator } = parts(markup())
    const hidden = getComputedStyle(indicator)
    expect(hidden.backgroundColor).toBe(getComputedStyle(trigger).color)
    const hiddenMask = hidden.maskImage || hidden.webkitMaskImage
    expect(hiddenMask).not.toBe("none")
    cleanup()
    sheet()
    const visible = getComputedStyle(parts(markup("", 'aria-pressed="true"', "visible")).indicator)
    expect(visible.maskImage || visible.webkitMaskImage).not.toBe(hiddenMask)
  })

  it("pressed differs by more than colour: an inset underline", () => {
    sheet()
    expect(getComputedStyle(parts(markup()).trigger).boxShadow).toBe("none")
    cleanup()
    sheet()
    expect(getComputedStyle(parts(markup("", 'aria-pressed="true"')).trigger).boxShadow).toContain(
      "inset",
    )
  })

  it("invalid doubles the border; the trigger stays inside", () => {
    sheet()
    const { input, trigger } = parts(markup("data-invalid"))
    expect(getComputedStyle(input).borderTopWidth).toBe("2px")
    expect(trigger.getBoundingClientRect().right).toBeLessThanOrEqual(
      input.getBoundingClientRect().right - 2,
    )
  })

  it("the keyboard ring shows on the trigger", () => {
    sheet()
    const { trigger } = parts(markup("", 'aria-pressed="false" data-focus-visible'))
    expect(getComputedStyle(trigger).outlineStyle).toBe("solid")
  })

  it("forced colors: field boundary, system colours and an unshadowed-colour pressed rule", () => {
    const css = textField.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*FieldText[\s\S]*ButtonText[\s\S]*aria-pressed="true"[\s\S]*GrayText/,
    )
    expect(css).not.toMatch(/\[hidden\]/)
  })
})
