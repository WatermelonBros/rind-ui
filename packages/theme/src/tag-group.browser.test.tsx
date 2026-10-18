// add-tag-group 6.1: the Tag Group stylesheet alone: the List is a box (never `display:
// contents`), the tag's cell is `display: contents`, tags are at least 24px, long text ends with
// an ellipsis, the remove button gets a hit area, and a forced-colors rule exists.
import { afterEach, describe, expect, it } from "vitest"
import tagGroup from "./tag-group.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${tagGroup}`,
  )

const group = (text = "Rome", width = "400px") => `
  <div data-scope="tag-group" data-part="root" style="inline-size:${width}">
    <div data-scope="tag-group" data-part="list" role="grid">
      <div data-scope="tag-group" data-part="item" role="row">
        <div data-scope="tag-group" data-part="item-cell" role="gridcell">
          <span data-scope="tag-group" data-part="item-text">${text}</span>
          <button data-scope="tag-group" data-part="item-remove" type="button" aria-label="Remove">x</button>
        </div>
      </div>
    </div>
  </div>`

describe("Tag Group stylesheet", () => {
  it("the List is a box and the cell is display: contents (ariakit#7160)", () => {
    sheet()
    const host = mount(group())
    expect(getComputedStyle(q(host, '[data-part="list"]')).display).toBe("flex")
    expect(getComputedStyle(q(host, '[data-part="item-cell"]')).display).toBe("contents")
  })

  it("a tag is at least 24px tall", () => {
    sheet()
    const host = mount(group())
    expect(q(host, '[data-part="item"]').getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("long text fits the width and ends with an ellipsis (react-spectrum#6962)", () => {
    sheet()
    const host = mount(group("A very long tag text ".repeat(20), "200px"))
    const tag = q(host, '[data-part="item"]').getBoundingClientRect()
    expect(tag.width).toBeLessThanOrEqual(200)
    expect(getComputedStyle(q(host, '[data-part="item-text"]')).textOverflow).toBe("ellipsis")
  })

  it("the remove button's hit area is at least the target size", () => {
    sheet()
    const host = mount(group())
    const before = getComputedStyle(q(host, '[data-part="item-remove"]'), "::before")
    expect(Number.parseFloat(before.width)).toBeGreaterThanOrEqual(24)
  })

  it("selection has a non-colour cue, and forced colors keep focus and selection visible", () => {
    sheet()
    const host = mount(group())
    const item = q(host, '[data-part="item"]')
    const plain = getComputedStyle(item).borderTopWidth
    item.setAttribute("data-selected", "")
    expect(getComputedStyle(item).borderTopWidth).not.toBe(plain)
    expect(tagGroup).toMatch(/@media \(forced-colors: active\)[\s\S]*SelectedItem[\s\S]*Highlight/)
  })
})
