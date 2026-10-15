// add-label 7.1: tokens.css + label.css alone give a Label the theme's font and colour.
import { afterEach, describe, expect, it } from "vitest"
import label from "./label.css?inline"
import { cleanup, files, inject, mount, q, resolve } from "./test-css"

afterEach(cleanup)

describe("Label stylesheet", () => {
  it("Stylesheet alone: tokens.css + label.css only", () => {
    inject(
      `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${label}`,
    )
    const el = q(mount(`<label data-scope="label" data-part="root">Email</label>`), "label")
    const style = getComputedStyle(el)
    expect(style.fontSize).toBe(resolve(el, "font-size", "--rind-text-sm"))
    expect(style.color).toBe(resolve(el, "color", "--rind-color-text"))
    expect(style.fontWeight).toBe("500")
  })
})
