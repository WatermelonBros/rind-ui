// Virtualization (tree-view-virtualization 1.3): navigation over every visible node while only a
// window is rendered, scroll-to-index with the visible-list index, ids that survive expand and
// collapse, and a highlight move that re-renders only the two rows involved.
import type { ScrollToIndexDetails } from "@rind-ui/core"
import { TreeView, type TreeViewItemData, type TreeViewNodeState } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { Profiler, useState } from "react"
import { describe, expect, it, vi } from "vitest"

// 100 folders of 99 files, all expanded: 10,000 visible nodes.
const FOLDERS = 100
const FILES = 99
const BIG: readonly TreeViewItemData[] = Array.from({ length: FOLDERS }, (_, i) => ({
  key: `f${i}`,
  label: `Folder ${i}`,
  children: Array.from({ length: FILES }, (_, j) => ({
    key: `f${i}-${j}`,
    label: `File ${i}.${j}`,
  })),
}))
const EXPANDED = BIG.map((f) => f.key)
const N = FOLDERS * (FILES + 1)
const WINDOW = 20

const renders = new Map<string, number>()
/** Module-level, so its identity is stable: rows whose state did not change skip rendering. */
const row = (node: TreeViewNodeState) => (
  <Profiler id={node.key} onRender={(id) => renders.set(id, (renders.get(id) ?? 0) + 1)}>
    <TreeView.Item value={node.key}>
      <TreeView.ItemText>{node.label}</TreeView.ItemText>
    </TreeView.Item>
  </Profiler>
)

/** The window around `start`, plus the rows the tree needs kept (the highlighted one). */
function Window({ start }: { readonly start: number }) {
  const { count, persistedIndexes } = TreeView.useVisibleRows()
  const from = Math.max(0, Math.min(count - WINDOW, start))
  const indexes = [
    ...new Set([...Array.from({ length: WINDOW }, (_, i) => from + i), ...persistedIndexes]),
  ].sort((a, b) => a - b)
  return (
    <TreeView.Tree aria-label="Big" indexes={indexes}>
      {row}
    </TreeView.Tree>
  )
}

function Windowed({ onScroll }: { readonly onScroll?: (d: ScrollToIndexDetails) => void }) {
  const [start, setStart] = useState(0)
  return (
    <TreeView.Root
      items={BIG}
      defaultExpandedValue={EXPANDED}
      virtualized
      scrollToIndex={(d) => {
        onScroll?.(d)
        setStart(d.index - WINDOW / 2)
      }}
    >
      <Window start={start} />
    </TreeView.Root>
  )
}

const press = (key: string) =>
  act(() => {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
  })
const item = (name: string) => screen.getByRole("treeitem", { name })

describe("virtualized TreeView", () => {
  it("End in a 10,000-node tree: scrollToIndex gets 9999; the last node is rendered, focused, with its metadata", async () => {
    const onScroll = vi.fn()
    render(<Windowed onScroll={onScroll} />)
    act(() => item("Folder 0").focus())
    press("End")
    expect(onScroll).toHaveBeenLastCalledWith(expect.objectContaining({ index: N - 1 }))
    const last = `File ${FOLDERS - 1}.${FILES - 1}`
    await waitFor(() => expect(document.activeElement?.textContent).toBe(last))
    const el = item(last)
    expect(el.getAttribute("data-highlighted")).not.toBeNull()
    expect(el.getAttribute("aria-level")).toBe("2")
    expect(el.getAttribute("aria-posinset")).toBe(String(FILES))
    expect(el.getAttribute("aria-setsize")).toBe(String(FILES))
    expect(screen.getAllByRole("treeitem").length).toBeLessThan(200)
  })

  it("a branch collapsed and expanded again: every row keeps its id", () => {
    render(<Windowed />)
    const ids = () =>
      new Map(screen.getAllByRole("treeitem").map((el) => [el.textContent ?? "", el.id]))
    const before = ids()
    act(() => item("Folder 0").focus())
    press("ArrowLeft")
    expect(item("Folder 0").getAttribute("aria-expanded")).toBe("false")
    const collapsed = ids()
    for (const [name, id] of collapsed) if (before.has(name)) expect(id).toBe(before.get(name))
    press("ArrowRight")
    expect(item("Folder 0").getAttribute("aria-expanded")).toBe("true")
    for (const [name, id] of ids()) {
      const earlier = before.get(name) ?? collapsed.get(name)
      if (earlier !== undefined) expect(id).toBe(earlier)
    }
  })

  it("a highlight move re-renders exactly two rows", () => {
    render(<Windowed />)
    act(() => item("Folder 0").focus())
    press("ArrowDown")
    for (let i = 0; i < 5; i++) {
      renders.clear()
      press("ArrowDown")
      expect([...renders.keys()].sort(), `move ${i}`).toHaveLength(2)
    }
  })
})
