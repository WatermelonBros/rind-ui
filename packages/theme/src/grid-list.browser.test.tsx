// add-grid-list 7.1/7.2: the Grid List stylesheet alone: the List and the rows are boxes
// (never `display: contents`), rows are at least 24px, a selected row differs by more than
// colour (weight), the grid layout makes columns, controls keep a 24px target, and a
// forced-colors rule exists.
import { afterEach, describe, expect, it } from "vitest"
import gridList from "./grid-list.css?inline"
import { cleanup, files, inject, mount } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${gridList}`,
  )

const list = (layout = "stack") => `
  <div data-scope="grid-list" data-part="root" style="inline-size:640px">
    <div data-scope="grid-list" data-part="list" role="grid" data-layout="${layout}">
      <div data-scope="grid-list" data-part="item" role="row" data-state="selected">
        <span data-scope="grid-list" data-part="item-text">Ada</span>
        <button data-scope="grid-list" data-part="item-control" type="button">E</button>
      </div>
      <div data-scope="grid-list" data-part="item" role="row" data-state="unselected">
        <span data-scope="grid-list" data-part="item-text">Grace</span>
      </div>
    </div>
  </div>`

const el = (host: Element, sel: string) => host.querySelector(sel) as HTMLElement

describe("Grid List stylesheet", () => {
  it("list and rows are boxes; rows are at least 24px", () => {
    sheet()
    const host = mount(list())
    expect(getComputedStyle(el(host, '[data-part="list"]')).display).not.toBe("contents")
    const row = el(host, '[data-part="item"]')
    expect(getComputedStyle(row).display).not.toBe("contents")
    expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("a selected row differs by weight, not only colour", () => {
    sheet()
    const host = mount(list())
    const [a, b] = host.querySelectorAll<HTMLElement>('[data-part="item-text"]')
    expect(getComputedStyle(a as HTMLElement).fontWeight).not.toBe(
      getComputedStyle(b as HTMLElement).fontWeight,
    )
  })

  it("grid layout: rows sit side by side", () => {
    sheet()
    const host = mount(list("grid"))
    const [a, b] = host.querySelectorAll<HTMLElement>('[data-part="item"]')
    expect((a as HTMLElement).getBoundingClientRect().top).toBe(
      (b as HTMLElement).getBoundingClientRect().top,
    )
  })

  it("a control keeps a 24px target", () => {
    sheet()
    const box = el(mount(list()), '[data-part="item-control"]').getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  })

  it("forced colors: selection and focus cues", () => {
    expect(gridList).toMatch(/@media \(forced-colors: active\)[\s\S]*SelectedItem[\s\S]*Highlight/)
  })
})
