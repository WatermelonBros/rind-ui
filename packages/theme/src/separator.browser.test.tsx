// add-separator 6.1: the Separator stylesheet alone: a border (not a background), a vertical
// one as tall as its flex row, a forced-colors rule (the rendered capture is in
// separator.pw.test.ts), no variant/size/tone rules.
import { afterEach, describe, expect, it } from "vitest"
import separator from "./separator.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${separator}`,
  )

const sep = (orientation: string, tag = "div") =>
  `<${tag} data-scope="separator" data-part="root" data-orientation="${orientation}"></${tag}>`

describe("Separator stylesheet", () => {
  it("horizontal is a border, not a background", () => {
    sheet()
    const el = q(mount(`<div>${sep("horizontal")}</div>`), '[data-part="root"]')
    const s = getComputedStyle(el)
    expect(Number.parseFloat(s.borderTopWidth)).toBe(1)
    expect(s.borderTopStyle).toBe("solid")
    expect(s.backgroundColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("an hr is reset to the same border", () => {
    sheet()
    const el = q(mount(`<div>${sep("horizontal", "hr")}</div>`), "hr")
    const s = getComputedStyle(el)
    expect(Number.parseFloat(s.borderTopWidth)).toBe(1)
    expect(Number.parseFloat(s.borderBottomWidth)).toBe(0)
  })

  it("vertical in a flex row is as tall as the row (radix-ui/primitives#1926)", () => {
    sheet()
    const host = mount(
      `<div style="display:flex;align-items:flex-start"><button style="height:60px">A</button>${sep("vertical")}<button>B</button></div>`,
    )
    const el = q(host, '[data-part="root"]')
    expect(el.getBoundingClientRect().height).toBe(60)
    expect(Number.parseFloat(getComputedStyle(el).borderLeftWidth)).toBe(1)
  })

  it("reads --rind-separator-* tokens", () => {
    sheet()
    const el = q(
      mount(`<div style="--rind-separator-thickness:3px">${sep("horizontal")}</div>`),
      '[data-part="root"]',
    )
    expect(getComputedStyle(el).borderTopWidth).toBe("3px")
  })

  it("has a forced-colors rule and no variant, size or tone rules", () => {
    expect(separator).toMatch(/@media \(forced-colors: active\)[\s\S]*CanvasText/)
    expect(separator).not.toMatch(/data-(variant|size|tone)/)
  })
})
