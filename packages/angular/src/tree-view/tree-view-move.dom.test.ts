// Tree View moves against the Angular parts: Alt+arrows with focus kept and announced, indent
// and outdent, the instructions in the tree's description, and pointer drags (browser).
import { Component, input, signal } from "@angular/core"
import { moveNode } from "@rind-ui/core"
import { getTreeView, recordingAnnouncer } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { TreeView, type TreeViewItemData } from "./tree-view"

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
let rec = recordingAnnouncer()

@Component({
  selector: "rind-f",
  imports: [RindProvider, TreeView],
  template: `<ng-container rindProvider [announcer]="announcer">
    <ng-container
      rindTreeViewRoot
      [items]="items()"
      [defaultExpandedValue]="['docs']"
      [movable]="movable()"
      [onMove]="move"
    >
      <div style="position: relative">
        <div rindTreeViewTree aria-label="Files">
          <ng-template rindTreeViewRow let-node>
            <div rindTreeViewItem [value]="node.key" style="height: 32px; display: flex; align-items: center">
              <span rindTreeViewItemText>{{ node.label }}</span>
            </div>
          </ng-template>
        </div>
        <div rindTreeViewDropIndicator></div>
      </div>
    </ng-container>
  </ng-container>`,
})
class Files {
  readonly movable = input<boolean | ((key: string) => boolean)>(true)
  readonly announcer = rec.announcer
  readonly items = signal<TreeViewItemData[]>(FILES)
  readonly move = (key: string, target: Parameters<typeof moveNode>[2]) =>
    this.items.set(moveNode(this.items(), key, target))
}
async function setup(movable: boolean | ((key: string) => boolean) = true) {
  rec = recordingAnnouncer()
  await mount(Files, { movable })
  return { d: getTreeView(screen, { name: "Files" }), said: () => rec.log.map((a) => a.message) }
}
const rows = async (d: ReturnType<typeof getTreeView>) =>
  (await d.items()).map((r) => `${"  ".repeat(r.level - 1)}${r.name}`)
const row = (name: string) => screen.getByRole("treeitem", { name })

describe("angular tree view moves", () => {
  it("off by default: Alt+Down does nothing", async () => {
    const user = userEvent.setup()
    const { d } = await setup(false)
    row("readme.md").focus()
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    expect((await rows(d))[0]).toBe("readme.md")
  })
  it("the tree describes the Alt+arrow keys when movable", async () => {
    await setup()
    const ids = (
      screen.getByRole("tree", { name: "Files" }).getAttribute("aria-describedby") ?? ""
    ).split(" ")
    expect(ids.map((id) => document.getElementById(id)?.textContent).join(" ")).toMatch(
      /Alt with the arrow keys moves the item/,
    )
  })
  it("Alt+Down reorders the root by one; focus stays on the node", async () => {
    const user = userEvent.setup()
    const { d, said } = await setup()
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
    const { d } = await setup()
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
    const { d } = await setup((k) => k !== "readme")
    row("readme.md").focus()
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    expect((await rows(d))[0]).toBe("readme.md")
  })
  it.runIf(browser)(
    "pointer drags: inside a branch, before and after rows, never into its own subtree",
    async () => {
      const { d } = await setup()
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
