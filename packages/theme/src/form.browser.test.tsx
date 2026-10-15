// add-form 8.1: the Form stylesheet spaces its Fields by the form gap.
import { afterEach, describe, expect, it } from "vitest"
import field from "./field.css?inline"
import form from "./form.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const markup = `<form data-scope="form" data-part="root" aria-label="Sign up">
  <div data-scope="field" data-part="root"><label data-scope="field" data-part="label">Email</label></div>
  <div data-scope="field" data-part="root"><label data-scope="field" data-part="label">Name</label></div>
</form>`

describe("Form stylesheet", () => {
  it("Stylesheet alone: tokens.css + form.css + field.css → Fields spaced by the form gap", () => {
    inject(
      `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${field}\n${form}`,
    )
    const root = q(mount(markup), "form")
    expect(getComputedStyle(root).display).toBe("grid")
    const [a, b] = [...root.querySelectorAll('[data-scope="field"][data-part="root"]')]
    if (!a || !b) throw new Error("two Field roots expected")
    const gap = b.getBoundingClientRect().top - a.getBoundingClientRect().bottom
    expect(gap).toBeCloseTo(Number.parseFloat(getComputedStyle(root).rowGap), 1)
    expect(gap).toBeGreaterThan(0)
  })
})
