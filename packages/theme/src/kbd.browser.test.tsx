// add-kbd 3.1: the Kbd stylesheet alone: caps on the keys (border, thicker bottom), none on
// the outer kbd, a cap on a kbd written as text, no colour literals.
import { afterEach, describe, expect, it } from "vitest"
import kbd from "./kbd.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${kbd}`,
  )

const keys = `
<kbd data-scope="kbd" data-part="root" dir="ltr">
  <kbd data-scope="kbd" data-part="key" data-key="ctrl">Ctrl</kbd>
  <span data-scope="kbd" data-part="separator" data-kind="chord">+</span>
  <kbd data-scope="kbd" data-part="key" data-key="k">K</kbd>
</kbd>`

describe("Kbd stylesheet", () => {
  it("keys are caps; the outer kbd has none", () => {
    sheet()
    const host = mount(keys)
    const key = getComputedStyle(q(host, '[data-part="key"]'))
    expect(key.borderTopStyle).toBe("solid")
    expect(Number.parseFloat(key.borderBottomWidth)).toBeGreaterThan(
      Number.parseFloat(key.borderTopWidth),
    )
    expect(getComputedStyle(q(host, '[data-part="root"]')).borderTopStyle).toBe("none")
  })

  it("a kbd written as text is one cap", () => {
    sheet()
    const host = mount('<kbd data-scope="kbd" data-part="root">Esc</kbd>')
    expect(getComputedStyle(q(host, "kbd")).borderTopStyle).toBe("solid")
  })

  it("no colour literals", () => {
    expect(kbd).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i)
  })
})
