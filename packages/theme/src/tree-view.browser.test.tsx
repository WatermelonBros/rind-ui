// add-tree-view 6.1: the Tree View stylesheet alone: indentation from the level, 24px rows
// and indicator hit area, no flex tree, fit-content rows, selected cue beyond colour, the
// indicator rotating open and mirroring in right-to-left. Forced colors are checked on the
// computed style under emulation in fixtures/tree-view/tree-view.pw.test.ts.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q } from "./test-css"
import tree from "./tree-view.css?inline"

afterEach(cleanup)

const a = (part: string, extra = "") => `data-scope="tree-view" data-part="${part}" ${extra}`

const markup = (dir = "ltr") => `<div dir="${dir}" style="inline-size: 200px">
  <div role="tree" aria-label="Files" ${a("tree")}>
    <div role="treeitem" aria-level="1" aria-expanded="true" style="--rind-tree-view-level: 1" ${a("item", 'data-branch data-state="open" data-key="src"')}>
      <span ${a("item-indicator", 'data-state="open"')}>▸</span><span ${a("item-text")}>src</span>
    </div>
    <div role="treeitem" aria-level="2" aria-selected="true" style="--rind-tree-view-level: 2" ${a("item", 'data-selected data-key="a"')}>
      <span ${a("item-text")}>a-file-with-a-very-long-name-that-overflows-the-tree.ts</span>
    </div>
    <div role="treeitem" aria-level="1" aria-expanded="false" style="--rind-tree-view-level: 1" ${a("item", 'data-branch data-state="closed" data-key="docs"')}>
      <span ${a("item-indicator", 'data-state="closed"')}>▸</span><span ${a("item-text")}>docs</span>
    </div>
  </div>
</div>`

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${tree}`,
  )

describe("Tree View stylesheet", () => {
  it("rows are at least 24px, the indicator hit area 24 by 24", () => {
    sheet()
    const host = mount(markup())
    for (const row of host.querySelectorAll('[data-part="item"]')) {
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
    }
    const box = q(host, '[data-part="item-indicator"]').getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  })

  it("indents from --rind-tree-view-level", () => {
    sheet()
    const host = mount(markup())
    const pad = (key: string) =>
      Number.parseFloat(getComputedStyle(q(host, `[data-key="${key}"]`)).paddingInlineStart)
    expect(pad("a")).toBeGreaterThan(pad("src"))
  })

  it("the tree is not a flex container; rows are as wide as their content", () => {
    sheet()
    const host = mount(markup())
    expect(getComputedStyle(q(host, '[data-part="tree"]')).display).toBe("block")
    const long = q(host, '[data-key="a"]')
    expect(long.getBoundingClientRect().width).toBeGreaterThan(200)
  })

  it("selected differs by more than colour", () => {
    sheet()
    const host = mount(markup())
    const on = getComputedStyle(q(host, "[data-selected]"))
    const off = getComputedStyle(q(host, '[data-key="docs"]'))
    expect(Number(on.fontWeight)).toBeGreaterThan(Number(off.fontWeight))
    expect(on.backgroundColor).not.toBe(off.backgroundColor)
  })

  it("the indicator rotates open and mirrors closed in right-to-left", () => {
    sheet()
    const ltr = mount(markup())
    expect(getComputedStyle(q(ltr, '[data-part="item-indicator"][data-state="open"]')).rotate).toBe(
      "90deg",
    )
    const rtl = mount(markup("rtl"))
    expect(
      getComputedStyle(q(rtl, '[data-part="item-indicator"][data-state="closed"]')).scale,
    ).toBe("-1 1")
  })
})

describe("Tree View stylesheet: moving (add-tree-view-dnd)", () => {
  it("the dragged row fades, a drop target is outlined, the line indents by level", () => {
    sheet()
    const host = mount(`
<div style="position:relative">
  <div data-scope="tree-view" data-part="tree" role="tree">
    <div data-scope="tree-view" data-part="item" role="treeitem" data-dragging style="--rind-tree-view-level:1">a</div>
    <div data-scope="tree-view" data-part="item" role="treeitem" data-drop-target style="--rind-tree-view-level:1">b</div>
  </div>
  <div data-scope="tree-view" data-part="drop-indicator" aria-hidden="true" style="position:absolute;--rind-tree-drop-top:20px;--rind-tree-drop-level:1"></div>
  <div data-scope="tree-view" data-part="drop-indicator" aria-hidden="true" style="position:absolute;--rind-tree-drop-top:20px;--rind-tree-drop-level:3"></div>
</div>`)
    expect(Number(getComputedStyle(q(host, "[data-dragging]")).opacity)).toBeLessThan(1)
    expect(getComputedStyle(q(host, "[data-drop-target]")).outlineStyle).toBe("solid")
    const [l1, l3] = [...host.querySelectorAll<HTMLElement>('[data-part="drop-indicator"]')]
    const x = (el: HTMLElement | undefined) => el?.getBoundingClientRect().left ?? 0
    expect(x(l3)).toBeGreaterThan(x(l1))
    expect(Math.round(l1?.getBoundingClientRect().height ?? 0)).toBe(2)
  })
})
