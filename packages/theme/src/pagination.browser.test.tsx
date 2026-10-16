// add-pagination 6.1: the Pagination stylesheet alone: a wrapping row, 24x24 targets, the
// current page's fill and 3:1 edge, no hover on unavailable controls, RTL chevrons, a
// forced-colors rule and the tokens.
import { afterEach, describe, expect, it } from "vitest"
import pagination from "./pagination.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${pagination}`,
  )

const markup = (attrs = "", dir = "ltr") => `
<nav data-scope="pagination" data-part="root" ${attrs} dir="${dir}">
  <ul data-scope="pagination" data-part="list">
    <li data-scope="pagination" data-part="item"><button data-scope="pagination" data-part="previous" data-disabled aria-disabled="true" data-hover><svg data-direction="previous" width="16" height="16"></svg></button></li>
    <li data-scope="pagination" data-part="item"><button data-scope="pagination" data-part="page" data-current aria-current="page">1</button></li>
    <li data-scope="pagination" data-part="item"><button data-scope="pagination" data-part="page" data-hover>2</button></li>
    <li data-scope="pagination" data-part="item"><span data-scope="pagination" data-part="ellipsis" aria-hidden="true">…</span></li>
  </ul>
</nav>`

const transparent = "rgba(0, 0, 0, 0)"

describe("Pagination stylesheet", () => {
  it("a row of controls at least 24x24, list bullets removed", () => {
    sheet()
    const host = mount(markup())
    expect(getComputedStyle(q(host, '[data-part="list"]')).display).toBe("flex")
    expect(getComputedStyle(q(host, '[data-part="list"]')).listStyleType).toBe("none")
    for (const el of host.querySelectorAll("button")) {
      const box = el.getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(24)
      expect(box.height).toBeGreaterThanOrEqual(24)
    }
  })

  it("the current page has a fill and an edge, not colour alone", () => {
    sheet()
    const current = getComputedStyle(q(mount(markup()), "[data-current]"))
    expect(current.backgroundColor).not.toBe(transparent)
    expect(current.borderTopColor).not.toBe(transparent)
    expect(Number.parseFloat(current.borderTopWidth)).toBeGreaterThan(0)
  })

  it("hover shows on an available control and not on an unavailable one", () => {
    sheet()
    const host = mount(markup())
    expect(
      getComputedStyle(q(host, '[data-part="page"]:not([data-current])')).backgroundColor,
    ).not.toBe(transparent)
    expect(getComputedStyle(q(host, '[data-part="previous"]')).backgroundColor).toBe(transparent)
  })

  it("chevrons mirror in right-to-left", () => {
    sheet()
    expect(getComputedStyle(q(mount(markup("", "rtl")), "svg")).transform).not.toBe("none")
    expect(getComputedStyle(q(mount(markup()), "svg")).transform).toBe("none")
  })

  it("reads --rind-pagination-* tokens", () => {
    sheet()
    const host = mount(markup('style="--rind-pagination-current-bg: rgb(1, 2, 3)"'))
    expect(getComputedStyle(q(host, "[data-current]")).backgroundColor).toBe("rgb(1, 2, 3)")
  })

  it("has a forced-colors outline for the current page", () => {
    expect(pagination).toMatch(/@media \(forced-colors: active\)[\s\S]*Highlight/)
  })
})
