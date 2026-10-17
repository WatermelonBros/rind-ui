// add-listbox 6.1: the Listbox stylesheet alone: target size, selected cue that is not colour,
// horizontal row, forced-colors rules (rendered captures are in the Playwright suite).
import { afterEach, describe, expect, it } from "vitest"
import listbox from "./listbox.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const a = (part: string, extra = "") => `data-scope="listbox" data-part="${part}" ${extra}`

const markup = (
  orientation = "vertical",
) => `<div role="listbox" aria-label="Fruit" ${a("list", `data-orientation="${orientation}"`)}>
  <div role="option" ${a("item", 'data-state="unselected"')}><span ${a("item-text")}>Apple</span></div>
  <div role="option" aria-selected="true" ${a("item", 'data-selected data-state="selected"')}><span ${a("item-text")}>Pear</span><span ${a("item-indicator", 'data-state="selected"')}></span></div>
  <div role="option" ${a("item", 'data-state="unselected"')}><span ${a("item-text")}>Plum</span></div>
</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${listbox}`,
  )

const items = (host: HTMLElement) => [...host.querySelectorAll('[data-part="item"]')]

describe("Listbox stylesheet", () => {
  it("items are at least 24px tall, even when empty", () => {
    sheet()
    const host = mount(markup())
    for (const i of items(host)) i.textContent = ""
    for (const i of items(host)) expect(i.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
  })

  it("selected differs from unselected by more than colour", () => {
    sheet()
    const host = mount(markup())
    const [off, on] = [q(host, '[data-state="unselected"]'), q(host, "[data-selected]")]
    expect(getComputedStyle(on).backgroundColor).not.toBe(getComputedStyle(off).backgroundColor)
    expect(Number(getComputedStyle(on).fontWeight)).toBeGreaterThan(
      Number(getComputedStyle(off).fontWeight),
    )
    const ind = q(host, '[data-part="item-indicator"]')
    expect(ind.getBoundingClientRect().width).toBeGreaterThan(0)
  })

  it("horizontal lays items in one row", () => {
    sheet()
    const [x, y] = items(mount(markup("horizontal"))).map((i) => i.getBoundingClientRect())
    expect(x?.top).toBe(y?.top)
    expect((x?.left ?? 0) < (y?.left ?? 0)).toBe(true)
  })

  it("vertical lays items in a column", () => {
    sheet()
    const [x, y] = items(mount(markup())).map((i) => i.getBoundingClientRect())
    expect((x?.top ?? 0) < (y?.top ?? 0)).toBe(true)
  })

  it("forced colors: highlight outline, SelectedItem, focus outline, GrayText rules exist", () => {
    const css = listbox.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*outline[\s\S]*SelectedItem[\s\S]*data-focus-visible[\s\S]*GrayText/,
    )
    expect(css).not.toMatch(/\[hidden\]/)
  })
})
