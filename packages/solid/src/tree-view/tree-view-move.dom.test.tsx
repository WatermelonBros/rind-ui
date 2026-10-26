/** @jsxImportSource solid-js */
// Tree View moves against the Solid parts: Alt+arrows with focus kept and announced, indent
// and outdent, the instructions in the tree's description, and pointer drags (browser).
import { moveNode } from "@rind-ui/core"
import { getTreeView, recordingAnnouncer } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { userEvent } from "@testing-library/user-event"
import { createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider, TreeView, type TreeViewItemData, type TreeViewNodeState } from "../index"

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
function Files(props: { movable: boolean | ((key: string) => boolean) }) {
  const [items, setItems] = createSignal<TreeViewItemData[]>(FILES)
  return (
    <TreeView.Root
      items={items()}
      defaultExpandedValue={["docs"]}
      movable={props.movable}
      onMove={(key, target) => setItems(moveNode(items(), key, target))}
    >
      <div style={{ position: "relative" }}>
        <TreeView.Tree aria-label="Files">
          {(node: TreeViewNodeState) => (
            <TreeView.Item
              value={node.key}
              style={{ height: "32px", display: "flex", "align-items": "center" }}
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
function setup(movable: boolean | ((key: string) => boolean) = true) {
  const rec = recordingAnnouncer()
  mount(() => (
    <RindProvider announcer={rec.announcer}>
      <Files movable={movable} />
    </RindProvider>
  ))
  return { d: getTreeView(screen, { name: "Files" }), said: () => rec.log.map((a) => a.message) }
}
const rows = async (d: ReturnType<typeof getTreeView>) =>
  (await d.items()).map((r) => `${"  ".repeat(r.level - 1)}${r.name}`)
const row = (name: string) => screen.getByRole("treeitem", { name })

describe("solid tree view moves", () => {
  it("off by default: Alt+Down does nothing", async () => {
    const user = userEvent.setup()
    const { d } = setup(false)
    row("readme.md").focus()
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    expect((await rows(d))[0]).toBe("readme.md")
  })
  it("the tree describes the Alt+arrow keys when movable", () => {
    setup()
    const ids = (
      screen.getByRole("tree", { name: "Files" }).getAttribute("aria-describedby") ?? ""
    ).split(" ")
    expect(ids.map((id) => document.getElementById(id)?.textContent).join(" ")).toMatch(
      /Alt with the arrow keys moves the item/,
    )
  })
  it("Alt+Down reorders the root by one; focus stays on the node", async () => {
    const user = userEvent.setup()
    const { d, said } = setup()
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
    const { d } = setup()
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
  it("a predicate keeps some nodes in place", async () => {
    const user = userEvent.setup()
    const { d } = setup((k) => k !== "readme")
    row("readme.md").focus()
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    expect((await rows(d))[0]).toBe("readme.md")
  })
  it.runIf(browser)(
    "pointer drags: inside a branch, before and after rows, never into its own subtree",
    async () => {
      const { d } = setup()
      await d.dragNode("docs", ["docs", "api.md"], "before")
      expect(await rows(d)).toEqual([
        "readme.md",
        "docs",
        "  intro.md",
        "  api.md",
        "notes.md",
        "archive",
      ])
      await d.dragNode("notes.md", "readme.md", "before")
      expect((await rows(d))[0]).toBe("notes.md")
      await d.dragNode("notes.md", "archive", "inside")
      expect(await rows(d)).toEqual([
        "readme.md",
        "docs",
        "  intro.md",
        "  api.md",
        "archive",
        "  notes.md",
      ])
    },
  )
})
