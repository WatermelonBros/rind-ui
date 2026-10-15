// add-checkbox-group 6.1: the Checkbox Group stylesheet alone: stacked layout, fieldset
// normalisation, invalid/disabled read from data-*.
import { afterEach, describe, expect, it } from "vitest"
import checkboxGroup from "./checkbox-group.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const markup = (
  tag = "div",
  legend = "span",
  attrs = "",
) => `<${tag} data-scope="checkbox-group" data-part="root" ${attrs}>
  <${legend} data-scope="checkbox-group" data-part="label">Toppings</${legend}>
  <p data-scope="checkbox-group" data-part="description">Pick some.</p>
  <div>A</div><div>B</div>
</${tag}>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${checkboxGroup}`,
  )

describe("Checkbox Group stylesheet", () => {
  it("stacks its children with a gap", () => {
    sheet()
    const root = q(mount(markup()), '[data-part="root"]')
    const s = getComputedStyle(root)
    expect(s.display).toBe("grid")
    expect(Number.parseFloat(s.rowGap)).toBeGreaterThan(0)
  })

  it("a native fieldset loses its border and padding", () => {
    sheet()
    const root = q(mount(markup("fieldset", "legend")), '[data-part="root"]')
    const s = getComputedStyle(root)
    expect(Number.parseFloat(s.borderTopWidth)).toBe(0)
    expect(Number.parseFloat(s.paddingTop)).toBe(0)
  })

  it("disabled changes the text colour", () => {
    sheet()
    const root = q(mount(markup()), '[data-part="root"]')
    const enabled = getComputedStyle(root).color
    root.setAttribute("data-disabled", "")
    expect(getComputedStyle(root).color).not.toBe(enabled)
  })

  it("the error message is danger-coloured", () => {
    sheet()
    const host = mount(
      `${markup()}<p data-scope="checkbox-group" data-part="error-message">Pick one.</p>`,
    )
    const err = getComputedStyle(q(host, '[data-part="error-message"]')).color
    expect(err).not.toBe(getComputedStyle(q(host, '[data-part="description"]')).color)
  })

  it("has no [hidden] override", () => {
    expect(checkboxGroup.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\[hidden\]/)
  })
})
