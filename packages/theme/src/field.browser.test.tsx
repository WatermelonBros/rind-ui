// add-field 9.1: the Field stylesheet alone, and the error icon's non-colour cue.
import { afterEach, describe, expect, it } from "vitest"
import field from "./field.css?inline"
import { cleanup, files, inject, mount, q, resolve } from "./test-css"

afterEach(cleanup)

const markup = `<div data-scope="field" data-part="root" data-invalid>
  <label data-scope="field" data-part="label">Email</label>
  <p data-scope="field" data-part="description">We never share it.</p>
  <p data-scope="field" data-part="error-message">Enter a valid email.</p></div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.icons}\n${field}`,
  )

describe("Field stylesheet", () => {
  it("Stylesheet alone: tokens.css + icons.css + field.css only", () => {
    sheet()
    const host = mount(markup)
    const label = q(host, "label")
    const error = q(host, '[data-part="error-message"]')
    expect(getComputedStyle(q(host, '[data-part="root"]')).display).toBe("grid")
    expect(getComputedStyle(label).fontWeight).toBe("580")
    expect(getComputedStyle(label).textTransform).toBe("none")
    expect(getComputedStyle(q(host, '[data-part="description"]')).color).toBe(
      resolve(label, "color", "--rind-color-text-muted"),
    )
    expect(getComputedStyle(error).color).toBe(resolve(error, "color", "--rind-color-danger-text"))
  })

  it("ErrorMessage draws an icon over currentColor, so colour is not the only cue", () => {
    sheet()
    const error = q(mount(markup), '[data-part="error-message"]')
    const icon = getComputedStyle(error, "::before")
    expect(icon.maskImage).toMatch(/^url\("data:image\/svg\+xml,/)
    expect(icon.backgroundColor).toBe(getComputedStyle(error).color)
    expect(Number.parseFloat(icon.width)).toBeGreaterThan(0)
  })

  // Forced colors cannot be emulated from Vitest browser mode; the rendered check is in
  // field.pw.test.ts ("Error visible in forced colors"). Here the rule must at least exist.
  it("Error visible in forced colors: the icon is repainted in CanvasText", () => {
    const css = sheet()
    const rules = [...css.cssRules]
      .flatMap((r) => (r instanceof CSSLayerBlockRule ? [...r.cssRules] : [r]))
      .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
      .filter((r) => r.conditionText.includes("forced-colors"))
      .flatMap((r) => [...r.cssRules])
      .map((r) => r.cssText)
      .join("\n")
    expect(rules).toMatch(/::before[^{]*\{[^}]*CanvasText/i)
  })
})
