// Tree View through its driver and real input: runs unchanged in jsdom and real browsers.
import { domEnvironment } from "@rind-ui/core"
import { TreeView, type TreeViewItemData, type TreeViewRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getTreeView, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const tv = (name = "Files") => getTreeView(screen, { name }, { platform })
const row = (name: string) => screen.getByRole("treeitem", { name })

const FILES: readonly TreeViewItemData[] = [
  {
    key: "src",
    label: "src",
    children: [
      { key: "a.ts", label: "a.ts" },
      { key: "index.ts", label: "index.ts" },
      { key: "server.ts", label: "server.ts" },
    ],
  },
  { key: "docs", label: "docs", children: [{ key: "readme.md", label: "readme.md" }] },
]

function Files(
  props: Partial<TreeViewRootProps> & {
    readonly items?: readonly TreeViewItemData[]
    readonly itemExtra?: (key: string) => React.ReactNode
  },
) {
  const { items = FILES, itemExtra, ...root } = props
  return (
    <>
      <button type="button">Before</button>
      <TreeView.Root items={items} {...(root as TreeViewRootProps)}>
        <TreeView.Label>Files</TreeView.Label>
        <TreeView.Tree>
          {(node) => (
            <TreeView.Item value={node.key}>
              {node.isBranch ? <TreeView.ItemIndicator>▸</TreeView.ItemIndicator> : null}
              {(root as TreeViewRootProps).checkable ? (
                <TreeView.ItemCheckbox>☐</TreeView.ItemCheckbox>
              ) : null}
              <TreeView.ItemText>{node.label}</TreeView.ItemText>
              {itemExtra?.(node.key)}
            </TreeView.Item>
          )}
        </TreeView.Tree>
        <TreeView.Empty />
      </TreeView.Root>
      <button type="button">After</button>
    </>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("anatomy and roles", () => {
  it("Minimal tree: a named tree, one treeitem per visible node, one Tab stop", () => {
    render(<Files />)
    expect(screen.getByRole("tree", { name: "Files" })).toBeTruthy()
    expect(screen.getAllByRole("treeitem")).toHaveLength(2)
    expect(screen.getAllByRole("treeitem").filter((i) => i.tabIndex === 0)).toHaveLength(1)
  })

  it("Flat DOM: children are siblings of the expanded branch", async () => {
    render(<Files defaultExpandedValue={["src"]} />)
    expect(row("a.ts").parentElement).toBe(row("src").parentElement)
    expect(row("src").contains(row("a.ts"))).toBe(false)
  })

  it("Set metadata for a nested node", () => {
    render(<Files defaultExpandedValue={["src"]} />)
    const index = row("index.ts")
    expect(index.getAttribute("aria-level")).toBe("2")
    expect(index.getAttribute("aria-posinset")).toBe("2")
    expect(index.getAttribute("aria-setsize")).toBe("3")
  })

  it("Leaf has no aria-expanded (headless-tree#171)", () => {
    render(
      <Files defaultExpandedValue={["src"]} items={[...FILES, { key: "leaf", label: "leaf" }]} />,
    )
    expect(row("leaf").hasAttribute("aria-expanded")).toBe(false)
    expect(row("src").getAttribute("aria-expanded")).toBe("true")
    expect(row("docs").getAttribute("aria-expanded")).toBe("false")
  })

  it("Empty or unloaded branch is still a branch (react-spectrum#10659)", async () => {
    render(<Files items={[{ key: "lazy", label: "lazy", isBranch: true }]} />)
    expect(row("lazy").getAttribute("aria-expanded")).toBe("false")
    await tv().expand("lazy")
    expect(row("lazy").getAttribute("aria-expanded")).toBe("true")
  })

  it("Unnamed tree warns (react-arborist#325)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <TreeView.Root items={FILES}>
        <TreeView.Tree>
          {(n) => <TreeView.Item value={n.key}>{n.label}</TreeView.Item>}
        </TreeView.Tree>
      </TreeView.Root>,
    )
    // the development checks run after the mount re-render (a microtask)
    await vi.waitFor(() => expect(warn.mock.calls.flat().join(" ")).toMatch(/no accessible name/))
  })

  it("A button inside an item warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Files itemExtra={(k) => (k === "docs" ? <button type="button">Open</button> : null)} />)
    // the development checks run after the mount re-render (a microtask)
    await vi.waitFor(() => expect(warn.mock.calls.flat().join(" ")).toMatch(/interactive <button>/))
  })

  it("Keys are strings: '0' renders and can be selected (react-spectrum#9991)", async () => {
    render(
      <Files
        items={[
          { key: "0", label: "zero" },
          { key: "1", label: "one" },
        ]}
      />,
    )
    await tv().check("zero")
    expect(row("zero").getAttribute("aria-selected")).toBe("true")
  })
})

describe("expansion", () => {
  it("Right then Right", async () => {
    render(<Files />)
    await tv().focusIn()
    await userEvent.keyboard("{ArrowRight}")
    expect(row("src").getAttribute("aria-expanded")).toBe("true")
    expect(document.activeElement).toBe(row("src"))
    await userEvent.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(row("a.ts"))
  })

  it("Left climbs to the parent (react-spectrum#9546)", async () => {
    render(<Files defaultExpandedValue={["src"]} />)
    act(() => row("a.ts").focus())
    await userEvent.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(row("src"))
    await userEvent.keyboard("{ArrowLeft}")
    expect(row("src").getAttribute("aria-expanded")).toBe("false")
  })

  it("Siblings (APG): * expands every root branch, the highlight stays", async () => {
    render(<Files />)
    await tv().focusIn()
    await userEvent.keyboard("*")
    expect(await tv().expandedNames()).toEqual(["src", "docs"])
    expect(document.activeElement).toBe(row("src"))
  })

  it("Controlled expansion needs one click (react-spectrum#8263)", async () => {
    const onExpandedChange = vi.fn()
    function Controlled() {
      const [keys, setKeys] = useState<readonly string[]>([])
      return (
        <Files
          selectionMode="none"
          expandedValue={keys}
          onExpandedChange={(k, d) => {
            onExpandedChange(k, d)
            setKeys(k)
          }}
        />
      )
    }
    render(<Controlled />)
    const before = row("src")
    await userEvent.click(before)
    expect(onExpandedChange).toHaveBeenCalledTimes(1)
    expect(onExpandedChange.mock.calls[0]?.[1]).toEqual({ reason: "press" })
    expect(row("src").getAttribute("aria-expanded")).toBe("true")
    expect(row("src")).toBe(before)
  })

  it("Chevron click keeps focus on the row and the selection", async () => {
    render(<Files />)
    await tv().focusIn()
    const indicator = row("src").querySelector('[data-part="item-indicator"]') as Element
    await userEvent.click(indicator)
    expect(row("src").getAttribute("aria-expanded")).toBe("true")
    expect(document.activeElement).toBe(row("src"))
    expect(row("src").getAttribute("aria-selected")).toBe("false")
  })

  it("Branch press selects and expands (ark#2976)", async () => {
    render(<Files />)
    await userEvent.click(row("src"))
    expect(row("src").getAttribute("aria-selected")).toBe("true")
    expect(row("src").getAttribute("aria-expanded")).toBe("true")
  })
})

describe("focus and Tab stop", () => {
  it("Selected node under a collapsed parent (zag#1751, zag#1874)", async () => {
    render(<Files defaultValue="a.ts" />)
    expect(row("src").tabIndex).toBe(0)
    await userEvent.tab()
    await userEvent.tab()
    expect(document.activeElement).toBe(row("src"))
  })

  it("Collapse removes the highlight's row", async () => {
    function Controlled() {
      const [keys, setKeys] = useState<readonly string[]>(["src"])
      return (
        <>
          <Files expandedValue={keys} onExpandedChange={setKeys} />
          <button type="button" onClick={() => setKeys([])}>
            Collapse all
          </button>
        </>
      )
    }
    render(<Controlled />)
    act(() => row("index.ts").focus())
    await act(async () => screen.getByRole("button", { name: "Collapse all" }).click())
    expect(row("src").hasAttribute("data-highlighted")).toBe(true)
  })

  it("No wrap in multiple mode (zag#2028)", async () => {
    render(<Files selectionMode="multiple" />)
    act(() => row("docs").focus())
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}")
    expect(document.activeElement).toBe(row("docs"))
    expect(row("src").getAttribute("aria-selected")).toBe("false")
  })
})

describe("keyboard map", () => {
  it("Consumer key bubbles: F2 runs, is not prevented, navigation still works", async () => {
    const onF2 = vi.fn((e: React.KeyboardEvent) => onF2Prevented(e.defaultPrevented))
    const onF2Prevented = vi.fn()
    render(
      <TreeView.Root items={FILES}>
        <TreeView.Label>Files</TreeView.Label>
        <TreeView.Tree onKeyDown={(e) => e.key === "F2" && onF2(e)}>
          {(n) => <TreeView.Item value={n.key}>{n.label}</TreeView.Item>}
        </TreeView.Tree>
      </TreeView.Root>,
    )
    await tv().focusIn()
    await userEvent.keyboard("{F2}")
    expect(onF2).toHaveBeenCalledTimes(1)
    expect(onF2Prevented).toHaveBeenCalledWith(false)
    await userEvent.keyboard("{ArrowDown}")
    expect(document.activeElement).toBe(row("docs"))
  })

  it("Typing in an inline input (react-spectrum#7552, zag#1627)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Files
        itemExtra={(k) => (k === "docs" ? <input aria-label="Rename" defaultValue="" /> : null)}
      />,
    )
    const input = screen.getByRole("textbox", { name: "Rename" })
    act(() => input.focus())
    await userEvent.keyboard("a b")
    expect((input as HTMLInputElement).value).toBe("a b")
    expect(row("docs").getAttribute("aria-selected")).toBe("false")
  })

  it("Typeahead over visible nodes", async () => {
    render(<Files />)
    await tv().focusIn()
    await userEvent.keyboard("se")
    expect(await tv().highlighted()).not.toBe("server.ts")
  })

  it("End highlights the last visible item; the key is prevented (react-spectrum#10720)", async () => {
    render(<Files />)
    await tv().focusIn()
    const end = new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })
    act(() => {
      row("src").dispatchEvent(end)
    })
    expect(end.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(row("docs"))
  })

  it("Select all is the visible nodes, never 'all'", async () => {
    const onValueChange = vi.fn()
    render(<Files selectionMode="multiple" onValueChange={onValueChange} />)
    await tv().selectAll()
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["src", "docs"])
  })
})

describe("activation", () => {
  it("Enter on a branch with no action expands it", async () => {
    render(<Files selectionMode="none" />)
    await tv().focusIn()
    await userEvent.keyboard("{Enter}")
    expect(row("src").getAttribute("aria-expanded")).toBe("true")
  })

  it("Enter selects in a selectable tree, onAction first", async () => {
    const order: string[] = []
    render(
      <Files onAction={() => order.push("action")} onValueChange={() => order.push("select")} />,
    )
    act(() => row("docs").focus())
    await userEvent.keyboard("{Enter}")
    expect(order).toEqual(["action", "select"])
    expect(row("docs").getAttribute("aria-selected")).toBe("true")
  })

  it("Driver round trip: expand a path, act on a nested item", async () => {
    const onAction = vi.fn()
    render(<Files selectionMode="none" onAction={onAction} />)
    const t = tv()
    await t.expand(["src"])
    await t.act(["src", "index.ts"])
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0]?.[0]).toBe("index.ts")
  })
})

describe("checkable", () => {
  it("Space checks; the branch is mixed; no aria-selected", async () => {
    render(<Files checkable selectionMode="none" defaultExpandedValue={["src"]} />)
    await tv().check(["src", "a.ts"])
    expect(row("a.ts").getAttribute("aria-checked")).toBe("true")
    expect(row("src").getAttribute("aria-checked")).toBe("mixed")
    for (const r of screen.getAllByRole("treeitem"))
      expect(r.hasAttribute("aria-selected")).toBe(false)
  })

  it("A press on the checkbox checks; onCheckedChange once", async () => {
    const onCheckedChange = vi.fn()
    render(<Files checkable selectionMode="none" onCheckedChange={onCheckedChange} />)
    const box = row("docs").querySelector('[data-part="item-checkbox"]') as Element
    await userEvent.click(box)
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange.mock.calls[0]?.[0]).toEqual(["readme.md"])
    expect(row("docs").getAttribute("aria-checked")).toBe("true")
  })
})

describe("lazy children", () => {
  it("Busy is announced: Loading src, 3 items loaded in src", async () => {
    const log = installAnnouncementLog()
    function Lazy() {
      const [items, setItems] = useState<readonly TreeViewItemData[]>([
        { key: "src", label: "src", isBranch: true },
      ])
      return (
        <Files
          items={items}
          onLoadChildren={async () => {
            setItems([
              {
                key: "src",
                label: "src",
                isBranch: true,
                children: ["a", "b", "c"].map((k) => ({ key: k, label: k })),
              },
            ])
          }}
        />
      )
    }
    render(<Lazy />)
    await tv().expand("src")
    await vi.waitFor(() => expect(screen.getAllByRole("treeitem")).toHaveLength(4))
    await vi.waitFor(() => expect(log.map((a) => a.message)).toContain("3 items loaded in src"))
    expect(log.map((a) => a.message)).toContain("Loading src")
  })

  it("While loading: aria-busy, data-loading and the loading row (not an item)", async () => {
    render(
      <Files
        items={[{ key: "src", label: "src", isBranch: true }]}
        onLoadChildren={() => new Promise(() => {})}
      />,
    )
    await tv().expand("src")
    expect(row("src").getAttribute("aria-busy")).toBe("true")
    expect(row("src").hasAttribute("data-loading")).toBe(true)
    expect(document.querySelector('[data-part="loading"]')?.getAttribute("aria-hidden")).toBe(
      "true",
    )
    expect(screen.getAllByRole("treeitem")).toHaveLength(1)
    expect(await tv().isBusy("src")).toBe(true)
  })

  it("Failure then retry", async () => {
    const onLoadChildren = vi.fn(() => Promise.reject(new Error("offline")))
    render(
      <Files
        items={[{ key: "src", label: "src", isBranch: true }]}
        onLoadChildren={onLoadChildren}
      />,
    )
    await tv().expand("src")
    await vi.waitFor(() => expect(row("src").hasAttribute("data-error")).toBe(true))
    act(() => row("src").focus())
    await userEvent.keyboard("{ArrowRight}")
    expect(onLoadChildren).toHaveBeenCalledTimes(2)
  })
})

describe("links", () => {
  it("A link item is an anchor treeitem with aria-current", () => {
    render(
      <TreeView.Root items={FILES} selectionMode="none">
        <TreeView.Label>Files</TreeView.Label>
        <TreeView.Tree>
          {(n) => (
            <TreeView.Item
              value={n.key}
              href={`#${n.key}`}
              current={n.key === "docs" ? "page" : undefined}
            >
              {n.label}
            </TreeView.Item>
          )}
        </TreeView.Tree>
      </TreeView.Root>,
    )
    const docs = row("docs")
    expect(docs.tagName).toBe("A")
    expect(docs.getAttribute("href")).toBe("#docs")
    expect(docs.getAttribute("aria-current")).toBe("page")
    expect(docs.hasAttribute("data-current")).toBe(true)
  })
})

describe("empty", () => {
  it("An empty tree renders Empty and is the one Tab stop", () => {
    render(<Files items={[]} />)
    const tree = screen.getByRole("tree", { name: "Files" })
    expect(tree.tabIndex).toBe(0)
    expect(screen.getByText("No items")).toBeTruthy()
    expect(tree.getAttribute("aria-describedby")).toContain("empty")
  })
})
