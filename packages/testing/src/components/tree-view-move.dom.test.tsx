// Tree View moves (spec add-tree-view-dnd): off by default, Alt+arrows (the outliner keys) with
// focus kept and announcements, a root reorder by one (React Aria #8561), a predicate, the
// instructions in the tree's description; pointer drags (browser) before / inside / after, never
// into its own subtree (React Aria #9841), the drag ending when its node is hidden (#10599).
import { moveNode } from "@rind-ui/core"
import { RindProvider, TreeView, type TreeViewItemData } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { getTreeView, recordingAnnouncer } from "../index"

const browser = !navigator.userAgent.includes("jsdom")

const FILES: TreeViewItemData[] = [
  { key: "readme", label: "readme.md" },
  {
    key: "docs",
    label: "docs",
    isBranch: true,
    children: [
      { key: "intro", label: "intro.md" },
      { key: "api", label: "api.md" },
    ],
  },
  { key: "notes", label: "notes.md" },
  { key: "archive", label: "archive", isBranch: true, children: [] },
]

function Files({
  movable = true,
  expanded = ["docs"],
}: {
  readonly movable?: boolean | ((key: string) => boolean)
  readonly expanded?: readonly string[]
}) {
  const [items, setItems] = useState<TreeViewItemData[]>(FILES)
  return (
    <TreeView.Root
      items={items}
      defaultExpandedValue={expanded}
      movable={movable}
      onMove={(key, target) => setItems((all) => moveNode(all, key, target))}
    >
      <div style={{ position: "relative" }}>
        <TreeView.Tree aria-label="Files">
          {(node) => (
            <TreeView.Item
              value={node.key}
              style={{ height: 32, display: "flex", alignItems: "center" }}
            >
              <TreeView.ItemText>{node.label}</TreeView.ItemText>
            </TreeView.Item>
          )}
        </TreeView.Tree>
        <TreeView.DropIndicator />
      </div>
    </TreeView.Root>
  )
}

function setup(node: React.ReactNode) {
  const rec = recordingAnnouncer()
  render(<RindProvider announcer={rec.announcer}>{node}</RindProvider>)
  return { d: getTreeView(screen, { name: "Files" }), said: () => rec.log.map((a) => a.message) }
}

const rows = async (d: ReturnType<typeof getTreeView>) =>
  (await d.items()).map((r) => `${"  ".repeat(r.level - 1)}${r.name}`)
const row = (name: string) => screen.getByRole("treeitem", { name })

describe("tree view moves", () => {
  it("off by default: Alt+Down does nothing", async () => {
    const user = userEvent.setup()
    const { d } = setup(<Files movable={false} />)
    row("readme.md").focus()
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    expect((await rows(d))[0]).toBe("readme.md")
  })

  it("the tree describes the Alt+arrow keys when movable", () => {
    setup(<Files />)
    const tree = screen.getByRole("tree", { name: "Files" })
    const ids = (tree.getAttribute("aria-describedby") ?? "").split(" ")
    expect(ids.map((id) => document.getElementById(id)?.textContent).join(" ")).toMatch(
      /Alt with the arrow keys moves the item/,
    )
  })

  it("Alt+Down reorders the root by one (React Aria #8561); focus stays on the node", async () => {
    const user = userEvent.setup()
    const { d, said } = setup(<Files />)
    row("readme.md").focus()
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    expect(await rows(d)).toEqual([
      "docs",
      "  intro.md",
      "  api.md",
      "readme.md",
      "notes.md",
      "archive",
    ])
    expect(document.activeElement).toBe(row("readme.md"))
    expect(said().at(-1)).toBe("readme.md moved to the top level, position 2 of 4")
  })

  it("Alt+Right indents into the branch above; Alt+Left outdents", async () => {
    const { d } = setup(<Files />)
    await d.moveNode("notes.md", "in")
    expect(await rows(d)).toEqual([
      "readme.md",
      "docs",
      "  intro.md",
      "  api.md",
      "  notes.md",
      "archive",
    ])
    await d.moveNode(["docs", "intro.md"], "out")
    expect(await rows(d)).toEqual([
      "readme.md",
      "docs",
      "  api.md",
      "  notes.md",
      "intro.md",
      "archive",
    ])
  })

  it("Alt+Right into a collapsed branch opens it; focus stays on the moved node", async () => {
    const { d } = setup(<Files expanded={[]} />)
    await d.moveNode("notes.md", "in")
    expect(await rows(d)).toEqual([
      "readme.md",
      "docs",
      "  intro.md",
      "  api.md",
      "  notes.md",
      "archive",
    ])
    expect(document.activeElement).toBe(row("notes.md"))
  })

  it("nowhere to go is announced", async () => {
    const user = userEvent.setup()
    const { said } = setup(<Files />)
    row("readme.md").focus()
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}")
    expect(said().at(-1)).toBe("readme.md cannot move that way")
  })

  it("a predicate keeps some nodes in place", async () => {
    const user = userEvent.setup()
    const { d } = setup(<Files movable={(k) => k !== "readme"} />)
    row("readme.md").focus()
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    expect((await rows(d))[0]).toBe("readme.md")
  })

  it.runIf(browser)("a pointer drag drops inside a branch, once", async () => {
    const { d } = setup(<Files />)
    await d.dragNode("notes.md", "archive", "inside")
    await act(async () => {})
    // The collapsed archive opens: notes.md stays visible inside it.
    expect(await rows(d)).toEqual([
      "readme.md",
      "docs",
      "  intro.md",
      "  api.md",
      "archive",
      "  notes.md",
    ])
  })

  it.runIf(browser)("before and after rows", async () => {
    const { d } = setup(<Files />)
    await d.dragNode("notes.md", "readme.md", "before")
    expect((await rows(d))[0]).toBe("notes.md")
    await d.dragNode("notes.md", ["docs", "api.md"], "after")
    expect(await rows(d)).toEqual([
      "readme.md",
      "docs",
      "  intro.md",
      "  api.md",
      "  notes.md",
      "archive",
    ])
  })

  it.runIf(browser)("never into its own subtree (React Aria #9841)", async () => {
    const { d } = setup(<Files />)
    await d.dragNode("docs", ["docs", "api.md"], "before")
    expect(await rows(d)).toEqual([
      "readme.md",
      "docs",
      "  intro.md",
      "  api.md",
      "notes.md",
      "archive",
    ])
  })
})
