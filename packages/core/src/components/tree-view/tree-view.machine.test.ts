// The Tree View machine in Node (task 1.5): expansion moves, activation, selection over
// visible items, checking, lazy children (once, abort, failure and retry, announcements),
// keys "0" and "". No DOM.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createTreeCollection } from "../../collection/tree"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { type TreeViewProps, type TreeViewValue, treeViewMachine } from "./tree-view.machine"

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

const FILES: readonly Row[] = [
  { id: "src", kids: [{ id: "a.ts" }, { id: "index.ts" }, { id: "server.ts" }] },
  { id: "docs", kids: [{ id: "readme.md" }] },
]

const announce = vi.fn()
const env = {
  dom: { getRootNode: () => document, getById: () => null, activeElement: () => null },
  clock: { now: () => 0 },
  layout: { pageTarget: () => null },
  locale: { locale: () => "en", dir: () => "ltr" },
  platform: platforms.linux,
  announcer: { announce, prepare: () => () => {}, cancel: () => {} },
  modality: {
    modality: () => "keyboard",
    subscribe: () => () => {},
    focusCause: () => "other",
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}

function make(over: Partial<TreeViewProps> = {}) {
  const onValueChange = vi.fn()
  const onExpandedValueChange = vi.fn()
  const onCheckedValueChange = vi.fn()
  const props: TreeViewProps = {
    tree: treeOf(FILES),
    ids: { list: "tree", item: (k) => `item-${k}` },
    onValueChange,
    onExpandedValueChange,
    onCheckedValueChange,
    ...over,
  }
  const s = createService(treeViewMachine, props as never, env as never)
  s.start()
  const send = (e: Parameters<typeof s.send>[0]) => s.send(e)
  return {
    s,
    props,
    send,
    onValueChange,
    onExpandedValueChange,
    onCheckedValueChange,
    value: () => s.view().values.value as TreeViewValue,
    expanded: () => [...(s.view().values.expandedValue as readonly string[])].sort(),
    checked: () => [...(s.view().values.checkedValue as readonly string[])].sort(),
    highlighted: () => s.getSnapshot().context.highlightedKey,
    focus: () => send({ type: "FOCUS", modality: "keyboard" }),
    key: (move: "next" | "previous" | "expand" | "collapse" | "first" | "last") =>
      send({ type: "NAVIGATE", move }),
    highlight: (key: string) => send({ type: "HIGHLIGHT", key: toKey(key), source: "keyboard" }),
  }
}

describe("expansion moves", () => {
  it("Right then Right: expand keeping the highlight, then the first child", () => {
    const t = make()
    t.focus()
    expect(t.highlighted()).toBe("src")
    t.key("expand")
    expect(t.expanded()).toEqual(["src"])
    expect(t.highlighted()).toBe("src")
    t.key("expand")
    expect(t.highlighted()).toBe("a.ts")
  })

  it("Left climbs to the parent, then collapses it (react-spectrum#9546)", () => {
    const t = make({ defaultExpandedValue: ["src"] })
    t.focus()
    t.highlight("a.ts")
    t.key("collapse")
    expect(t.highlighted()).toBe("src")
    t.key("collapse")
    expect(t.expanded()).toEqual([])
  })

  it("expanding yields navigable children (react-spectrum#1525)", () => {
    const t = make()
    t.focus()
    t.key("expand")
    t.key("next")
    expect(t.highlighted()).toBe("a.ts")
  })

  it("* expands every sibling branch and keeps the highlight", () => {
    const t = make()
    t.focus()
    t.send({ type: "EXPAND_SIBLINGS", key: toKey("src") })
    expect(t.expanded()).toEqual(["docs", "src"])
    expect(t.highlighted()).toBe("src")
  })

  it("collapsing the highlighted node's parent highlights the parent", () => {
    const t = make({ defaultExpandedValue: ["src"] })
    t.focus()
    t.highlight("index.ts")
    t.send({ type: "COLLAPSE", key: toKey("src") })
    expect(t.highlighted()).toBe("src")
  })

  it("expandAll and collapseAll; unknown expanded keys are ignored", () => {
    const t = make({ defaultExpandedValue: ["nope"] })
    t.focus()
    t.send({ type: "EXPAND_ALL" })
    expect(t.expanded()).toContain("src")
    expect(t.expanded()).toContain("docs")
    t.send({ type: "COLLAPSE_ALL" })
    expect(t.expanded()).toEqual([])
  })

  it("onExpandedValueChange is called once per user change", () => {
    const t = make()
    t.focus()
    t.key("expand")
    expect(t.onExpandedValueChange).toHaveBeenCalledTimes(1)
    expect(t.onExpandedValueChange.mock.calls[0]?.[0]).toEqual(["src"])
  })

  it("a disabled branch is not expanded by the user; its children stay navigable", () => {
    const t = make({
      tree: treeOf([{ id: "src", disabled: true, kids: [{ id: "a.ts" }] }, { id: "docs" }]),
      focusableWhenDisabled: true,
      defaultExpandedValue: ["src"],
    })
    t.focus()
    t.highlight("src")
    t.key("collapse")
    expect(t.expanded()).toEqual(["src"])
    t.key("next")
    expect(t.highlighted()).toBe("a.ts")
  })
})

describe("navigation and typeahead over visible nodes", () => {
  it("typeahead skips hidden nodes", () => {
    const t = make()
    t.focus()
    t.send({
      type: "TYPEAHEAD",
      char: "s",
      composing: false,
      modifiers: { ctrl: false, meta: false, alt: false },
    })
    // "server.ts" is hidden under the collapsed "src": "src" is the match.
    expect(t.highlighted()).toBe("src")
  })

  it("no wrap: next on the last visible item stays (zag#2028)", () => {
    const t = make({ selectionMode: "multiple" })
    t.focus()
    t.key("last")
    expect(t.highlighted()).toBe("docs")
    t.send({ type: "NAVIGATE", move: "next", extend: true })
    expect(t.highlighted()).toBe("docs")
  })

  it('keys "0" and "" are kept (react-spectrum#9991)', () => {
    const t = make({ tree: treeOf([{ id: "0" }, { id: "" }]) })
    t.focus()
    expect(t.highlighted()).toBe("0")
    t.key("next")
    expect(t.highlighted()).toBe("")
    t.send({ type: "SELECT", key: toKey(""), modality: "keyboard", shift: false, mod: false })
    expect(t.value()).toBe("")
  })
})

describe("focus entry", () => {
  it("a selected node under a collapsed parent: its visible ancestor (zag#1751)", () => {
    const t = make({ defaultValue: "index.ts" })
    t.focus()
    expect(t.highlighted()).toBe("src")
  })
})

describe("activation", () => {
  it("Enter on a branch with no action expands it (non-selectable)", () => {
    const t = make({ selectionMode: "none" })
    t.focus()
    t.send({ type: "ACTION", key: toKey("src"), modality: "keyboard" })
    expect(t.expanded()).toEqual(["src"])
  })

  it("Enter selects in a selectable tree, onAction first", () => {
    const calls: string[] = []
    const t = make({
      onAction: () => calls.push("action"),
      onValueChange: () => calls.push("select"),
    })
    t.focus()
    t.send({ type: "ACTION", key: toKey("docs"), modality: "keyboard" })
    expect(calls).toEqual(["action", "select"])
    expect(t.value()).toBe("docs")
  })

  it("a branch press selects and toggles once (ark#2976)", () => {
    const t = make()
    t.focus()
    t.send({
      type: "PRESS",
      key: toKey("src"),
      modality: "pointer",
      shift: false,
      mod: false,
      link: false,
    })
    expect(t.value()).toBe("src")
    expect(t.expanded()).toEqual(["src"])
  })

  it("a link press only runs onAction", () => {
    const onAction = vi.fn()
    const t = make({ onAction })
    t.focus()
    t.send({
      type: "PRESS",
      key: toKey("docs"),
      modality: "pointer",
      shift: false,
      mod: false,
      link: true,
    })
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(t.value()).toBe(null)
  })

  it("the indicator toggles without selecting", () => {
    const t = make()
    t.focus()
    t.send({ type: "INDICATOR", key: toKey("src") })
    expect(t.expanded()).toEqual(["src"])
    expect(t.value()).toBe(null)
  })

  it("a disabled item is never activated", () => {
    const onAction = vi.fn()
    const t = make({
      selectionMode: "none",
      onAction,
      tree: treeOf([{ id: "src", disabled: true, kids: [{ id: "a" }] }]),
      focusableWhenDisabled: true,
    })
    t.focus()
    t.send({ type: "ACTION", key: toKey("src"), modality: "keyboard" })
    expect(onAction).not.toHaveBeenCalled()
    expect(t.expanded()).toEqual([])
  })
})

describe("selection", () => {
  it("collapse keeps the selection", () => {
    const t = make({ defaultExpandedValue: ["src"], defaultValue: "a.ts" })
    t.focus()
    t.send({ type: "COLLAPSE", key: toKey("src") })
    expect(t.value()).toBe("a.ts")
  })

  it("single mode never holds two keys (zag#1787)", () => {
    const t = make({ defaultValue: "src" })
    t.focus()
    t.send({ type: "SELECT", key: toKey("docs"), modality: "keyboard", shift: false, mod: false })
    expect(t.value()).toBe("docs")
  })

  it("select all is the visible items, as a key list", () => {
    const t = make({ selectionMode: "multiple" })
    t.focus()
    t.send({ type: "SELECT_ALL" })
    expect(t.value()).toEqual(["src", "docs"])
  })

  it("replace: Ctrl+press toggles (react-arborist#303)", () => {
    const t = make({ selectionMode: "multiple", selectionBehavior: "replace" })
    t.focus()
    const press = (key: string, mod: boolean) =>
      t.send({
        type: "PRESS",
        key: toKey(key),
        modality: "pointer",
        shift: false,
        mod,
        link: false,
      })
    press("docs", false)
    press("src", true)
    expect(t.value()).toEqual(["src", "docs"])
  })
})

describe("checkable", () => {
  it("Space checks; Enter never checks", () => {
    const t = make({ checkable: true, defaultExpandedValue: ["src"] })
    t.focus()
    t.send({ type: "SELECT", key: toKey("src"), modality: "keyboard", shift: false, mod: false })
    expect(t.checked()).toEqual(["a.ts", "index.ts", "server.ts"])
    expect(t.onCheckedValueChange).toHaveBeenCalledTimes(1)
    t.send({ type: "ACTION", key: toKey("a.ts"), modality: "keyboard" })
    expect(t.checked()).toEqual(["a.ts", "index.ts", "server.ts"])
    expect(t.value()).toBe(null)
  })
})

describe("lazy children", () => {
  const lazyTree = treeOf([{ id: "src", lazy: true }, { id: "docs" }])

  it("expanded twice before children arrive: loaded once", () => {
    const onLoadChildren = vi.fn(() => new Promise<void>(() => {}))
    const t = make({ tree: lazyTree, onLoadChildren })
    t.focus()
    t.key("expand")
    t.key("expand")
    expect(onLoadChildren).toHaveBeenCalledTimes(1)
    expect(t.s.getSnapshot().context.loading.has(toKey("src"))).toBe(true)
  })

  it("collapse aborts the pending load", () => {
    let signal: AbortSignal | undefined
    const onLoadChildren = vi.fn((_k: string, o: { signal: AbortSignal }) => {
      signal = o.signal
      return new Promise<void>(() => {})
    })
    const t = make({ tree: lazyTree, onLoadChildren })
    t.focus()
    t.key("expand")
    t.key("collapse")
    expect(signal?.aborted).toBe(true)
    expect(t.s.getSnapshot().context.loading.size).toBe(0)
  })

  it("failure then retry; the announcements", async () => {
    announce.mockClear()
    let fail = true
    const onLoadChildren = vi.fn(() => (fail ? Promise.reject(new Error("x")) : undefined))
    const t = make({ tree: lazyTree, onLoadChildren })
    t.focus()
    t.key("expand")
    await vi.waitFor(() => expect(t.s.getSnapshot().context.failed.has(toKey("src"))).toBe(true))
    expect(announce.mock.calls.map((c) => c[0].message)).toEqual([
      "Loading src",
      "src could not be loaded",
    ])
    fail = false
    t.key("expand")
    expect(onLoadChildren).toHaveBeenCalledTimes(2)
  })

  it("children arriving in a new tree settle the load: '3 items loaded in src'", () => {
    announce.mockClear()
    const onLoadChildren = vi.fn(() => undefined)
    const t = make({ tree: lazyTree, onLoadChildren })
    t.focus()
    t.key("expand")
    const loaded = treeOf([
      { id: "src", lazy: true, kids: [{ id: "a" }, { id: "b" }, { id: "c" }] },
      { id: "docs" },
    ])
    t.s.setProps({ ...t.props, tree: loaded } as never)
    expect(announce.mock.calls.map((c) => c[0].message)).toEqual([
      "Loading src",
      "3 items loaded in src",
    ])
    expect(t.s.getSnapshot().context.loading.size).toBe(0)
  })

  it("a loaded branch with no children stays a branch and is not reloaded", async () => {
    const onLoadChildren = vi.fn(() => Promise.resolve())
    const t = make({ tree: lazyTree, onLoadChildren })
    t.focus()
    t.key("expand")
    await vi.waitFor(() => expect(t.s.getSnapshot().context.loaded.has(toKey("src"))).toBe(true))
    t.key("collapse")
    t.key("expand")
    expect(onLoadChildren).toHaveBeenCalledTimes(1)
  })
})
