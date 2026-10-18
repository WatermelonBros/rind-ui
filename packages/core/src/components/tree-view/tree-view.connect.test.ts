// Tree View connect (task 2.3): every attribute for leaves, branches, lazy, checkable, link,
// disabled and empty trees, and the keyboard additions (Enter, `*`, the editable guard).
import { describe, expect, it, vi } from "vitest"
import { type CollectionKey, toKey } from "../../collection/key"
import { createTreeCollection } from "../../collection/tree"
import { platforms } from "../../dom/platform"
import { type TreeViewConnectView, treeViewConnect } from "./tree-view.connect"
import { visibleOf } from "./tree-view.machine"

interface Row {
  readonly id: string
  readonly kids?: readonly Row[]
  readonly lazy?: boolean
  readonly disabled?: boolean
}
const treeOf = (roots: readonly Row[]) =>
  createTreeCollection<Row>({
    roots,
    getKey: (r) => r.id,
    getText: (r) => r.id,
    getChildren: (r) => r.kids,
    isDisabled: (r) => r.disabled === true,
    hasUnloadedChildren: (r) => r.lazy === true,
  })
const k = toKey
const env = {
  platform: platforms.linux,
  locale: { dir: () => "ltr" as const },
  modality: {
    modality: () => "keyboard" as const,
    subscribe: () => () => {},
    focusCause: () => "other" as const,
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}

const FILES = treeOf([
  { id: "src", kids: [{ id: "a.ts" }, { id: "index.ts" }, { id: "x.ts", disabled: true }] },
  { id: "docs" },
  { id: "lazy", lazy: true },
])

function view(over: Partial<TreeViewConnectView> & { expandedKeys?: string[] } = {}) {
  const send = vi.fn()
  const { expandedKeys = [], ...rest } = over
  const tree = over.tree ?? FILES
  const v: TreeViewConnectView = {
    instance: "t",
    tree,
    visible: visibleOf(tree, expandedKeys),
    expanded: new Set(expandedKeys.map(k)),
    context: {
      highlightedKey: null,
      highlightSource: null,
      loading: new Set(),
      failed: new Set(),
    },
    selection: new Set(),
    selectionMode: "single",
    checkable: false,
    checked: new Set(),
    checkPropagation: "both",
    disabled: false,
    typingAhead: () => false,
    focused: false,
    modality: "keyboard",
    hovered: null,
    pressed: null,
    mounted: { label: true, empty: false, itemText: () => true },
    send,
    ...rest,
  }
  return { api: treeViewConnect(v, env as never), send }
}

describe("tree", () => {
  it("role tree, named by the label, multiselectable only in multiple mode", () => {
    const one = view().api.tree()
    expect(one["role"]).toBe("tree")
    expect(one["aria-labelledby"]).toBe("tree-view-t-label")
    expect(one["aria-multiselectable"]).toBeUndefined()
    expect(view({ selectionMode: "multiple" }).api.tree()["aria-multiselectable"]).toBe("true")
    expect(view().api.tree({ "aria-label": "Files" })["aria-labelledby"]).toBeUndefined()
  })

  it("data attributes", () => {
    const t = view({ checkable: true, selectionMode: "none" }).api.tree()
    expect(t["data-scope"]).toBe("tree-view")
    expect(t["data-part"]).toBe("tree")
    expect(t["data-selection-mode"]).toBe("none")
    expect(t["data-checkable"]).toBe("")
  })

  it("empty: the tree is the tab stop and is described by Empty", () => {
    const empty = treeOf([])
    const { api } = view({
      tree: empty,
      mounted: { label: true, empty: true, itemText: () => true },
    })
    const t = api.tree()
    expect(t["tabindex"]).toBe(0)
    expect(t["data-empty"]).toBe("")
    expect(t["aria-describedby"]).toBe("tree-view-t-empty")
  })
})

describe("items", () => {
  it("set metadata for a nested node", () => {
    const item = view({ expandedKeys: ["src"] }).api.item(k("index.ts"))
    expect(item["role"]).toBe("treeitem")
    expect(item["aria-level"]).toBe(2)
    expect(item["aria-posinset"]).toBe(2)
    expect(item["aria-setsize"]).toBe(3)
    expect(item["data-level"]).toBe("2")
    expect(item["style"]).toEqual({ "--rind-tree-view-level": "2" })
  })

  it("a leaf has no aria-expanded; branches mirror the expansion (headless-tree#171)", () => {
    const { api } = view({ expandedKeys: ["src"] })
    expect(api.item(k("docs"))["aria-expanded"]).toBeUndefined()
    expect(api.item(k("src"))["aria-expanded"]).toBe("true")
    expect(api.item(k("src"))["data-state"]).toBe("open")
    expect(api.item(k("src"))["data-expanded"]).toBe("")
    expect(api.item(k("lazy"))["aria-expanded"]).toBe("false")
    expect(api.item(k("lazy"))["data-state"]).toBe("closed")
    expect(api.item(k("docs"))["data-state"]).toBeUndefined()
  })

  it("selection vs check attributes: never both", () => {
    const selected = view({ selection: new Set([k("docs")]) }).api.item(k("docs"))
    expect(selected["aria-selected"]).toBe("true")
    expect(selected["aria-checked"]).toBeUndefined()
    const checkable = view({
      checkable: true,
      selectionMode: "none",
      expandedKeys: ["src"],
      checked: new Set([k("a.ts")]),
    }).api
    expect(checkable.item(k("src"))["aria-checked"]).toBe("mixed")
    expect(checkable.item(k("src"))["data-indeterminate"]).toBe("")
    expect(checkable.item(k("src"))["aria-selected"]).toBeUndefined()
    expect(checkable.item(k("a.ts"))["aria-checked"]).toBe("true")
    expect(checkable.itemCheckbox(k("src"))["data-state"]).toBe("indeterminate")
  })

  it("loading and failed branches", () => {
    const { api } = view({
      expandedKeys: ["lazy"],
      context: {
        highlightedKey: null,
        highlightSource: null,
        loading: new Set([k("lazy")]),
        failed: new Set([k("docs")]),
      },
    })
    expect(api.item(k("lazy"))["aria-busy"]).toBe("true")
    expect(api.item(k("lazy"))["data-loading"]).toBe("")
    expect(api.itemIndicator(k("lazy"))["data-loading"]).toBe("")
    expect(api.item(k("docs"))["data-error"]).toBe("")
    expect(api.loading()["aria-hidden"]).toBe("true")
  })

  it("disabled items", () => {
    const item = view({ expandedKeys: ["src"] }).api.item(k("x.ts"))
    expect(item["aria-disabled"]).toBe("true")
    expect(item["data-disabled"]).toBe("")
  })

  it("indicator and checkbox are presentational", () => {
    const { api } = view()
    for (const part of [api.itemIndicator(k("src")), api.itemCheckbox(k("src"))]) {
      expect(part["aria-hidden"]).toBe("true")
      expect(part["role"]).toBeUndefined()
      expect(part["tabindex"]).toBeUndefined()
    }
  })

  it("named by the item text when it is rendered", () => {
    expect(view().api.item(k("docs"))["aria-labelledby"]).toBe("tree-view-t-item-text-docs")
    const none = view({ mounted: { label: false, empty: false, itemText: () => false } })
    expect(none.api.item(k("docs"))["aria-labelledby"]).toBeUndefined()
  })
})

type Handler = (e: unknown) => void
const keyEvent = (key: string, target: unknown, over: object = {}) => {
  const e = {
    key,
    code: "",
    target,
    currentTarget: { tag: "tree" },
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    repeat: false,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    ...over,
  }
  return e
}
const item = (tag = "DIV", href = false) => ({
  tagName: tag,
  getAttribute: (n: string) => (n === "role" ? "treeitem" : null),
  hasAttribute: (n: string) => n === "href" && href,
  closest: () => null,
})

describe("keyboard additions", () => {
  const highlighted = (key: CollectionKey) => ({
    highlightedKey: key,
    highlightSource: "keyboard" as const,
    loading: new Set<CollectionKey>(),
    failed: new Set<CollectionKey>(),
  })

  it("Enter sends ACTION; on a link it is left to the browser", () => {
    const { api, send } = view({ context: highlighted(k("docs")) })
    const onKeyDown = api.tree()["onKeyDown"] as Handler
    const e = keyEvent("Enter", item())
    onKeyDown(e)
    expect(send).toHaveBeenCalledWith({ type: "ACTION", key: "docs", modality: "keyboard" })
    expect(e.preventDefault).toHaveBeenCalled()
    send.mockClear()
    const link = keyEvent("Enter", item("A", true))
    onKeyDown(link)
    expect(send).not.toHaveBeenCalled()
    expect(link.preventDefault).not.toHaveBeenCalled()
  })

  it("* expands siblings", () => {
    const { api, send } = view({ context: highlighted(k("src")) })
    ;(api.tree()["onKeyDown"] as Handler)(keyEvent("*", item()))
    expect(send).toHaveBeenCalledWith({ type: "EXPAND_SIBLINGS", key: "src" })
  })

  it("keys from an editable element are not the tree's (react-spectrum#7552, zag#1627)", () => {
    const { api, send } = view({ context: highlighted(k("src")) })
    const input = {
      tagName: "INPUT",
      getAttribute: () => null,
      hasAttribute: () => false,
      closest: () => ({}),
    }
    const e = keyEvent(" ", input)
    ;(api.tree()["onKeyDown"] as Handler)(e)
    expect(send).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it("a key the consumer prevented is not handled (zag#2760)", () => {
    const { api, send } = view({ context: highlighted(k("src")) })
    ;(api.tree()["onKeyDown"] as Handler)(keyEvent("ArrowDown", item(), { defaultPrevented: true }))
    expect(send).not.toHaveBeenCalled()
  })

  it("an unmapped key (F2) is neither handled nor prevented", () => {
    const { api, send } = view({ context: highlighted(k("src")) })
    const e = keyEvent("F2", item())
    ;(api.tree()["onKeyDown"] as Handler)(e)
    expect(send).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
