// add-breadcrumbs 6.1: the Breadcrumbs stylesheet alone: a wrapping flex list without
// markers, the last separator hidden, the current item by weight, 24 px targets, RTL mirror,
// a forced-colors rule and no variant or size rules.
import { afterEach, describe, expect, it } from "vitest"
import breadcrumbs from "./breadcrumbs.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${breadcrumbs}`,
  )

const trail = (dir = "ltr") => `
<nav dir="${dir}" data-scope="breadcrumbs" data-part="root">
  <ol data-scope="breadcrumbs" data-part="list">
    <li data-scope="breadcrumbs" data-part="item"><a href="#" data-scope="breadcrumbs" data-part="link">Home</a><span data-scope="breadcrumbs" data-part="separator" aria-hidden="true">›</span></li>
    <li data-scope="breadcrumbs" data-part="item" data-current><span data-scope="breadcrumbs" data-part="link" data-current aria-current="page">Page</span><span data-scope="breadcrumbs" data-part="separator" data-last aria-hidden="true">›</span></li>
  </ol>
</nav>`

describe("Breadcrumbs stylesheet", () => {
  it("the list is a wrapping flex row without markers", () => {
    sheet()
    const s = getComputedStyle(q(mount(trail()), '[data-part="list"]'))
    expect(s.display).toBe("flex")
    expect(s.flexWrap).toBe("wrap")
    expect(s.listStyleType).toBe("none")
  })

  it("the separator in the last visible item is hidden", () => {
    sheet()
    const host = mount(trail())
    expect(getComputedStyle(q(host, "[data-last]")).display).toBe("none")
    expect(getComputedStyle(q(host, '[data-part="separator"]:not([data-last])')).display).not.toBe(
      "none",
    )
  })

  it("the current item stands out by weight; links meet 24 px", () => {
    sheet()
    const host = mount(trail())
    expect(
      Number(getComputedStyle(q(host, "span[data-current]")).fontWeight),
    ).toBeGreaterThanOrEqual(600)
    expect(q(host, "a").getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("a collapsed (hidden) item stays hidden", () => {
    sheet()
    const host = mount(trail())
    const item = q(host, '[data-part="item"]')
    item.hidden = true
    expect(getComputedStyle(item).display).toBe("none")
  })

  it("separators mirror in right-to-left text", () => {
    sheet()
    const sep = q(mount(trail("rtl")), '[data-part="separator"]')
    expect(getComputedStyle(sep).transform).not.toBe("none")
  })

  it("has a forced-colors rule and no variant or size rules", () => {
    expect(breadcrumbs).toMatch(/@media \(forced-colors: active\)[\s\S]*LinkText[\s\S]*CanvasText/)
    expect(breadcrumbs).not.toMatch(/data-(variant|size)/)
  })
})
