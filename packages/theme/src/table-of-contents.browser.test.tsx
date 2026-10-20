// add-table-of-contents 4.1: the Table of Contents stylesheet alone: a list on a rail without
// markers, nested items indented, the current link by weight, the indicator at the current
// link's box, 24 px targets, no colour literals.
import { afterEach, describe, expect, it } from "vitest"
import toc from "./table-of-contents.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${toc}`,
  )

const item = (id: string, depth: number, attrs = "") =>
  `<li data-scope="table-of-contents" data-part="item" data-depth="${depth}" ${attrs}><a href="#${id}" data-scope="table-of-contents" data-part="link" data-depth="${depth}" ${attrs}>${id}</a></li>`

const nav = (indicator = "") => `
<nav data-scope="table-of-contents" data-part="root" aria-label="On this page">
  <ol data-scope="table-of-contents" data-part="list" style="position: relative">
    ${item("intro", 0)}
    ${item("usage", 1, 'data-current aria-current="location" data-visible')}
    <span data-scope="table-of-contents" data-part="indicator" aria-hidden="true" ${indicator} style="position: absolute; --rind-toc-indicator-top: 24px; --rind-toc-indicator-height: 24px"></span>
  </ol>
</nav>`

describe("Table of Contents stylesheet", () => {
  it("a list on a rail without markers; nested items indent", () => {
    sheet()
    const host = mount(nav())
    const list = getComputedStyle(q(host, '[data-part="list"]'))
    expect(list.listStyleType).toBe("none")
    expect(list.borderInlineStartStyle).toBe("solid")
    const pad = (sel: string) =>
      Number.parseFloat(getComputedStyle(q(host, sel)).paddingInlineStart)
    expect(pad('li[data-depth="1"]')).toBeGreaterThan(pad('li[data-depth="0"]'))
  })

  it("the current link stands out by weight; links meet 24 px", () => {
    sheet()
    const host = mount(nav())
    expect(Number(getComputedStyle(q(host, "a[data-current]")).fontWeight)).toBeGreaterThanOrEqual(
      600,
    )
    expect(Number(getComputedStyle(q(host, "a:not([data-current])")).fontWeight)).toBeLessThan(600)
    expect(q(host, "a").getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("the indicator sits at the current link's box; hidden when none", () => {
    sheet()
    const host = mount(nav())
    const indicator = q(host, '[data-part="indicator"]')
    const list = q(host, '[data-part="list"]').getBoundingClientRect()
    const box = indicator.getBoundingClientRect()
    expect(Math.round(box.top - list.top)).toBe(24)
    expect(Math.round(box.height)).toBe(24)
    cleanup()
    sheet()
    const empty = mount(nav("data-hidden"))
    expect(getComputedStyle(q(empty, '[data-part="indicator"]')).display).toBe("none")
  })

  it("no colour literals", () => {
    expect(toc).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i)
  })
})
