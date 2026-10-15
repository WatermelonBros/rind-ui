// collectionPieces: the actions and guards, driven directly with a fake args object whose
// `set` writes into the context (known fields) or the controllable values (everything else).
import { describe, expect, it, vi } from "vitest"
import { platforms, withEngine } from "../dom/platform"
import type { PlatformFlags } from "../env/capabilities"
import { type CollectionKey, toKey } from "./key"
import { type Collection, createListCollection } from "./list"
import {
  type CollectionArgs,
  type CollectionContext,
  type CollectionEnv,
  type CollectionEvent,
  type CollectionProps,
  collectionPieces,
  type ExpansionPort,
  initialCollectionContext,
  type ScrollToIndexDetails,
  type SelectionPort,
} from "./machine"
import type { SelectionValue } from "./selection"
import { createTreeCollection } from "./tree"

interface Row {
  id: string
  disabled?: boolean
  section?: string
}
const row = (id: string, extra: Partial<Row> = {}): Row => ({ id, ...extra })

const listOf = (rows: Row[]): Collection<Row> =>
  createListCollection<Row>({
    items: rows,
    getKey: (r) => r.id,
    getText: (r) => r.id,
    isDisabled: (r) => r.disabled === true,
    getSection: (r) => (r.section ? { key: r.section, label: r.section } : undefined),
  })
const ids = (...names: string[]) => listOf(names.map((n) => row(n)))
const nums = (n: number) => ids(...Array.from({ length: n }, (_, i) => String(i + 1)))
const k = toKey

const selectionPort: SelectionPort = {
  read: (values) => (values["value"] as SelectionValue | undefined) ?? new Set<CollectionKey>(),
  write: (s) => s,
}

interface Options {
  props?: Partial<CollectionProps>
  collection?: Collection<unknown>
  context?: Partial<CollectionContext>
  values?: Record<string, unknown>
  platform?: PlatformFlags
  now?: () => number
  selection?: boolean
  expansion?: ExpansionPort & { tree: () => ReturnType<typeof createTreeCollection<Row>> }
  getById?: (id: string) => HTMLElement | null
  pageTarget?: (listId: string, key: CollectionKey, d: "next" | "previous") => CollectionKey | null
}

function harness(o: Options = {}) {
  let context: CollectionContext = { ...initialCollectionContext(), ...o.context }
  const values: Record<string, unknown> = { ...o.values }
  const announced: { message: string; key?: string | undefined }[] = []
  let now = 0
  const env: CollectionEnv = {
    dom: {
      getRootNode: () => document,
      getById: o.getById ?? (() => null),
      activeElement: () => null,
    },
    clock: { now: o.now ?? (() => now) },
    layout: { pageTarget: o.pageTarget ?? (() => null) },
    locale: { locale: () => "en", dir: () => "ltr" },
    platform: o.platform ?? platforms.linux,
    announcer: {
      announce: (m) => announced.push(m),
      prepare: () => () => {},
      cancel: () => {},
    },
    modality: {
      modality: () => "keyboard",
      subscribe: () => () => {},
      focusCause: () => "other",
      markFocus: () => {},
      unmarkFocus: () => {},
      recentFocus: () => [],
    },
  }
  const state = {
    props: {
      collection: o.collection ?? ids("a", "b", "c"),
      strategy: "roving",
      ids: { list: "list", item: (key: CollectionKey) => `item-${key}` },
      ...o.props,
    } as CollectionProps,
  }
  const pieces = collectionPieces({
    ...(o.selection === false ? {} : { selection: selectionPort }),
    ...(o.expansion ? { expansion: o.expansion } : {}),
  })
  const args = (event: CollectionEvent): CollectionArgs => ({
    props: state.props,
    context,
    values,
    env,
    event,
    set(key, value) {
      if (key in context) context = { ...context, [key]: value }
      else values[key] = value
    },
  })
  return {
    state,
    values,
    announced,
    get context() {
      return context
    },
    setNow: (t: number) => {
      now = t
    },
    run(action: keyof typeof pieces.actions, event: CollectionEvent) {
      pieces.actions[action](args(event))
    },
    guard: (g: keyof typeof pieces.guards, event: CollectionEvent) => pieces.guards[g](args(event)),
  }
}

const NAV = (move: Extract<CollectionEvent, { type: "NAVIGATE" }>["move"], extend = false) =>
  ({ type: "NAVIGATE", move, extend }) satisfies CollectionEvent
const SELECT = (key: string, over: { shift?: boolean; mod?: boolean } = {}) =>
  ({
    type: "SELECT",
    key: k(key),
    modality: "pointer",
    shift: over.shift ?? false,
    mod: over.mod ?? false,
  }) satisfies CollectionEvent

describe("navigate", () => {
  it("moves next/previous/first/last and marks a keyboard highlight that scrolls", () => {
    const h = harness({ context: { highlightedKey: k("a") } })
    h.run("navigate", NAV("next"))
    expect(h.context.highlightedKey).toBe("b")
    expect(h.context.highlightSource).toBe("keyboard")
    expect(h.context.scrollReason).toBe("navigation")
    h.run("navigate", NAV("last"))
    expect(h.context.highlightedKey).toBe("c")
    h.run("navigate", NAV("previous"))
    h.run("navigate", NAV("first"))
    expect(h.context.highlightedKey).toBe("a")
  })

  it("loops only when asked", () => {
    const stay = harness({ context: { highlightedKey: k("c") } })
    stay.run("navigate", NAV("next"))
    expect(stay.context.highlightedKey).toBe("c")
    const loop = harness({ context: { highlightedKey: k("c") }, props: { loop: true } })
    loop.run("navigate", NAV("next"))
    expect(loop.context.highlightedKey).toBe("a")
  })

  it("page moves fall back to 10 items when layout cannot be measured", () => {
    const h = harness({ collection: nums(25), context: { highlightedKey: k("1") } })
    h.run("navigate", NAV("page-next"))
    expect(h.context.highlightedKey).toBe("11")
    h.run("navigate", NAV("page-previous"))
    expect(h.context.highlightedKey).toBe("1")
  })

  it("page moves use the measured layout target", () => {
    const pageTarget = vi.fn(() => k("5"))
    const h = harness({ collection: nums(25), context: { highlightedKey: k("1") }, pageTarget })
    h.run("navigate", NAV("page-next"))
    expect(pageTarget).toHaveBeenCalledWith("list", "1", "next")
    expect(h.context.highlightedKey).toBe("5")
  })

  it("Shift+arrow extends a range from the highlight in multiple mode only", () => {
    const multi = harness({
      props: { selectionMode: "multiple" },
      context: { highlightedKey: k("a") },
    })
    multi.run("navigate", NAV("next", true))
    multi.run("navigate", NAV("next", true))
    expect(multi.values["value"]).toEqual(new Set(["a", "b", "c"]))
    const single = harness({
      props: { selectionMode: "single" },
      context: { highlightedKey: k("a") },
    })
    single.run("navigate", NAV("next", true))
    expect(single.values["value"]).toBeUndefined()
  })
})

describe("highlight and pointerMove", () => {
  it("HIGHLIGHT ignores disabled and unknown keys; null clears", () => {
    const c = listOf([row("a"), row("b", { disabled: true })])
    const h = harness({ collection: c, context: { highlightedKey: k("a") } })
    h.run("highlight", { type: "HIGHLIGHT", key: k("b"), source: "keyboard" })
    h.run("highlight", { type: "HIGHLIGHT", key: k("zzz"), source: "keyboard" })
    expect(h.context.highlightedKey).toBe("a")
    h.run("highlight", { type: "HIGHLIGHT", key: null, source: "programmatic" })
    expect(h.context.highlightedKey).toBeNull()
  })

  it("HIGHLIGHT is navigable when focusableWhenDisabled", () => {
    const c = listOf([row("a"), row("b", { disabled: true })])
    const h = harness({ collection: c, props: { focusableWhenDisabled: true } })
    h.run("highlight", { type: "HIGHLIGHT", key: k("b"), source: "keyboard" })
    expect(h.context.highlightedKey).toBe("b")
  })

  it("scroll reason: pointer none, open 'open', other 'navigation'", () => {
    const h = harness()
    h.run("highlight", { type: "HIGHLIGHT", key: k("a"), source: "pointer" })
    expect(h.context.scrollReason).toBeNull()
    h.run("highlight", { type: "HIGHLIGHT", key: k("b"), source: "keyboard", open: true })
    expect(h.context.scrollReason).toBe("open")
    h.run("highlight", { type: "HIGHLIGHT", key: k("c"), source: "programmatic" })
    expect(h.context.scrollReason).toBe("navigation")
  })

  it("a pointer move over a disabled item ends the keyboard session without moving the key", () => {
    const c = listOf([row("a"), row("b", { disabled: true })])
    const h = harness({
      collection: c,
      context: { highlightedKey: k("a"), highlightSource: "keyboard" },
    })
    h.run("pointerMove", { type: "POINTER_MOVE", key: k("b") })
    expect(h.context.highlightSource).toBe("pointer")
    expect(h.context.highlightedKey).toBe("a")
  })

  it("a pointer move over the highlighted item also ends the keyboard session", () => {
    const h = harness({ context: { highlightedKey: k("a"), highlightSource: "keyboard" } })
    h.run("pointerMove", { type: "POINTER_MOVE", key: k("a") })
    expect(h.context.highlightSource).toBe("pointer")
  })

  it("a pointer move over another item highlights it without scrolling", () => {
    const h = harness({
      context: { highlightedKey: k("a"), highlightSource: "keyboard", scrollReason: "navigation" },
    })
    h.run("pointerMove", { type: "POINTER_MOVE", key: k("c") })
    expect(h.context.highlightedKey).toBe("c")
    expect(h.context.highlightSource).toBe("pointer")
    expect(h.context.scrollReason).toBeNull()
  })
})

describe("typeahead", () => {
  const fruit = listOf([row("Apple"), row("Banana"), row("Cherry"), row("Cranberry")])
  const type = (char: string, over: Partial<{ ctrl: boolean; meta: boolean; alt: boolean }> = {}) =>
    ({
      type: "TYPEAHEAD",
      char,
      composing: false,
      modifiers: { ctrl: false, meta: false, alt: false, ...over },
    }) satisfies CollectionEvent

  it("uses the clock: a search extends within the timeout and restarts after it", () => {
    const h = harness({ collection: fruit })
    h.setNow(0)
    h.run("typeahead", type("c"))
    expect(h.context.highlightedKey).toBe("Cherry")
    expect(h.context.highlightSource).toBe("typeahead")
    h.setNow(500)
    h.run("typeahead", type("r"))
    expect(h.context.highlightedKey).toBe("Cranberry")
    h.setNow(2000)
    h.run("typeahead", type("b"))
    expect(h.context.highlightedKey).toBe("Banana")
  })

  it("honours typeaheadTimeout", () => {
    const h = harness({ collection: fruit, props: { typeaheadTimeout: 100 } })
    h.setNow(0)
    h.run("typeahead", type("c"))
    h.setNow(500)
    h.run("typeahead", type("r")) // the search restarted: "r" matches nothing
    expect(h.context.highlightedKey).toBe("Cherry")
    expect(h.context.typeahead.buffer).toBe("")
  })

  it("ignores modifier chords and composition", () => {
    const h = harness({ collection: fruit })
    h.run("typeahead", type("c", { ctrl: true }))
    h.run("typeahead", type("c", { meta: true }))
    h.run("typeahead", type("c", { alt: true }))
    h.run("typeahead", { ...type("c"), composing: true })
    expect(h.context.highlightedKey).toBeNull()
    expect(h.context.typeahead.buffer).toBe("")
  })

  it("resetTypeahead clears the search", () => {
    const h = harness({ collection: fruit })
    h.run("typeahead", type("c"))
    h.run("resetTypeahead", { type: "COMPOSITE.BLUR" })
    expect(h.context.typeahead.buffer).toBe("")
  })
})

describe("isTypingAhead guard", () => {
  const g = (buffer: string, at: number, now: number, timeout?: number) => {
    const h = harness({
      context: { typeahead: { buffer, at } },
      ...(timeout === undefined ? {} : { props: { typeaheadTimeout: timeout } }),
    })
    h.setNow(now)
    return h.guard("isTypingAhead", { type: "COMPOSITE.BLUR" })
  }
  it("is true only within the timeout of a non-empty search", () => {
    expect(g("c", 0, 500)).toBe(true)
    expect(g("c", 0, 1000)).toBe(true)
    expect(g("c", 0, 1001)).toBe(false)
    expect(g("", 0, 10)).toBe(false)
    expect(g("c", 0, 500, 100)).toBe(false)
  })
})

describe("selection actions through the SelectionPort", () => {
  it("select: single replaces, multiple toggles", () => {
    const single = harness({ props: { selectionMode: "single" } })
    single.run("select", SELECT("b"))
    expect(single.values["value"]).toEqual(new Set(["b"]))
    single.run("select", SELECT("c"))
    expect(single.values["value"]).toEqual(new Set(["c"]))
    const multi = harness({ props: { selectionMode: "multiple" } })
    multi.run("select", SELECT("a"))
    multi.run("select", SELECT("b"))
    multi.run("select", SELECT("a"))
    expect(multi.values["value"]).toEqual(new Set(["b"]))
    expect(multi.context.anchor?.key).toBe("a")
  })

  it("select ignores disabled items and mode none", () => {
    const c = listOf([row("a", { disabled: true }), row("b")])
    const h = harness({ collection: c, props: { selectionMode: "single" } })
    h.run("select", SELECT("a"))
    expect(h.values["value"] ?? new Set()).toEqual(new Set())
    const none = harness({ collection: c })
    none.run("select", SELECT("b"))
    expect(none.values["value"] ?? new Set()).toEqual(new Set())
  })

  it("remembers the text of selected keys", () => {
    const h = harness({ props: { selectionMode: "single" } })
    h.run("select", SELECT("b"))
    expect(h.context.texts.get(k("b"))).toBe("b")
  })

  it("selectAll / clearSelection / deselect", () => {
    const h = harness({ props: { selectionMode: "multiple" } })
    h.run("selectAll", { type: "SELECT_ALL" })
    expect(h.values["value"]).toBe("all")
    h.run("clearSelection", { type: "CLEAR_SELECTION" })
    expect(h.values["value"]).toEqual(new Set())
    h.run("select", SELECT("a"))
    h.run("select", SELECT("b"))
    h.run("deselect", { type: "DESELECT", key: k("a") })
    expect(h.values["value"]).toEqual(new Set(["b"]))
  })

  it("disallowEmptySelection keeps the last item on clear", () => {
    const h = harness({
      props: { selectionMode: "multiple", disallowEmptySelection: true },
      values: { value: new Set([k("a")]) },
    })
    h.run("clearSelection", { type: "CLEAR_SELECTION" })
    expect(h.values["value"]).toEqual(new Set(["a"]))
  })

  it("canSelect guard", () => {
    const c = listOf([row("a", { disabled: true }), row("b")])
    const h = harness({ collection: c, props: { selectionMode: "single" } })
    expect(h.guard("canSelect", SELECT("a"))).toBe(false)
    expect(h.guard("canSelect", SELECT("b"))).toBe(true)
    expect(harness({ collection: c }).guard("canSelect", SELECT("b"))).toBe(false)
  })

  it("hasHighlight and isEmpty guards", () => {
    const e = { type: "COMPOSITE.BLUR" } as const
    expect(harness().guard("hasHighlight", e)).toBe(false)
    expect(harness({ context: { highlightedKey: k("a") } }).guard("hasHighlight", e)).toBe(true)
    expect(harness({ collection: ids() }).guard("isEmpty", e)).toBe(true)
    expect(harness().guard("isEmpty", e)).toBe(false)
  })
})

describe("repairCollection", () => {
  const change = { type: "COLLECTION.CHANGE" } as const

  it("an insertion before the highlight keeps it", () => {
    const prev = ids("a", "b", "c")
    const h = harness({
      collection: prev.insert(0, row("z")),
      context: { highlightedKey: k("b"), lastCollection: prev },
    })
    h.run("repairCollection", change)
    expect(h.context.highlightedKey).toBe("b")
  })

  it("removing the highlighted item moves to the next one, without scrolling", () => {
    const prev = ids("a", "b", "c")
    const h = harness({
      collection: prev.remove(k("b")),
      context: { highlightedKey: k("b"), lastCollection: prev, scrollReason: "navigation" },
    })
    h.run("repairCollection", change)
    expect(h.context.highlightedKey).toBe("c")
    expect(h.context.scrollReason).toBeNull()
    expect(h.context.lastCollection).toBe(h.state.props.collection)
  })

  it("removing the last item moves to the previous; removing all clears", () => {
    const prev = ids("a", "b")
    const h = harness({
      collection: prev.remove(k("b")),
      context: { highlightedKey: k("b"), lastCollection: prev },
    })
    h.run("repairCollection", change)
    expect(h.context.highlightedKey).toBe("a")
    const all = harness({
      collection: ids(),
      context: { highlightedKey: k("a"), lastCollection: prev },
    })
    all.run("repairCollection", change)
    expect(all.context.highlightedKey).toBeNull()
  })

  it("the same collection instance is a no-op", () => {
    const c = ids("a")
    const h = harness({ collection: c, context: { highlightedKey: k("a"), lastCollection: c } })
    h.run("repairCollection", change)
    expect(h.context.highlightedKey).toBe("a")
  })

  it("tree: an ancestor collapsing under the highlight highlights that ancestor", () => {
    const tree = createTreeCollection<{ id: string; kids?: { id: string }[] }>({
      roots: [{ id: "a", kids: [{ id: "a1" }] }, { id: "b" }],
      getKey: (n) => n.id,
      getText: (n) => n.id,
      getChildren: (n) => n.kids,
    })
    const expanded = new Set<CollectionKey>()
    const prev = tree.visible(new Set([k("a")]))
    const h = harness({
      collection: tree.visible(expanded),
      context: { highlightedKey: k("a1"), lastCollection: prev },
      values: { expanded },
      expansion: {
        read: (v) => v["expanded"] as ReadonlySet<CollectionKey>,
        write: (e) => e,
        key: "expanded",
        tree: () => tree as never,
      },
    })
    h.run("repairCollection", change)
    // Plain repair would pick "b" (the next survivor); the visible ancestor wins.
    expect(h.context.highlightedKey).toBe("a")
  })
})

describe("repairCollection: tree highlight that stays present", () => {
  const change = { type: "COLLECTION.CHANGE" } as const
  const treeOf = (disabled: boolean, extra: Row[] = []) =>
    createTreeCollection<Row>({
      roots: [...extra, row("a"), row("b", { disabled }), row("c")],
      getKey: (n) => n.id,
      getText: (n) => n.id,
      getChildren: () => undefined,
      isDisabled: (n) => n.disabled === true,
    })
  const expansionOf = (tree: ReturnType<typeof treeOf>) => ({
    read: () => new Set<CollectionKey>(),
    write: (e: ReadonlySet<CollectionKey>) => e,
    key: "expanded",
    tree: () => tree,
  })

  it("a highlighted key that becomes disabled moves to the next navigable key, not kept", () => {
    const prev = treeOf(false)
    const next = treeOf(true)
    const h = harness({
      collection: next,
      context: { highlightedKey: k("b"), lastCollection: prev },
      expansion: expansionOf(next),
    })
    h.run("repairCollection", change)
    expect(h.context.highlightedKey).toBe("c")
  })

  it("a present, enabled highlight is kept", () => {
    const prev = treeOf(false)
    const next = treeOf(false, [row("z")])
    const h = harness({
      collection: next,
      context: { highlightedKey: k("b"), lastCollection: prev },
      expansion: expansionOf(next),
    })
    h.run("repairCollection", change)
    expect(h.context.highlightedKey).toBe("b")
  })
})

describe('disabledBehavior: "selection"', () => {
  const c = listOf([row("a"), row("b", { disabled: true }), row("c")])
  const mode = { selectionMode: "multiple" } as const
  const sel = { ...mode, disabledBehavior: "selection" } as const

  it("navigation reaches disabled items", () => {
    const h = harness({ collection: c, props: sel, context: { highlightedKey: k("a") } })
    h.run("navigate", NAV("next"))
    expect(h.context.highlightedKey).toBe("b")
  })

  it('"all" (default) skips them', () => {
    const h = harness({ collection: c, props: mode, context: { highlightedKey: k("a") } })
    h.run("navigate", NAV("next"))
    expect(h.context.highlightedKey).toBe("c")
  })

  it("HIGHLIGHT accepts a disabled item; with the default it is ignored", () => {
    const h = harness({ collection: c, props: sel })
    h.run("highlight", { type: "HIGHLIGHT", key: k("b"), source: "keyboard" })
    expect(h.context.highlightedKey).toBe("b")
    const all = harness({ collection: c, props: mode })
    all.run("highlight", { type: "HIGHLIGHT", key: k("b"), source: "keyboard" })
    expect(all.context.highlightedKey).toBeNull()
  })

  it("never selects them: select, range and select-all skip", () => {
    const h = harness({ collection: c, props: sel })
    h.run("select", SELECT("b"))
    expect(h.values["value"] ?? new Set()).toEqual(new Set())
    expect(h.guard("canSelect", SELECT("b"))).toBe(false)
    h.run("select", SELECT("a"))
    h.run("select", SELECT("c", { shift: true }))
    expect(h.values["value"]).toEqual(new Set(["a", "c"]))
    const all = harness({ collection: c, props: sel })
    all.run("selectAll", { type: "SELECT_ALL" })
    const v = all.values["value"]
    expect(v === "all" || (v instanceof Set && !v.has(k("b")))).toBe(true)
  })

  it("Shift+arrows extending through a disabled item does not select it", () => {
    const h = harness({ collection: c, props: sel, context: { highlightedKey: k("a") } })
    h.run("navigate", NAV("next", true))
    h.run("navigate", NAV("next", true))
    expect(h.values["value"]).toEqual(new Set(["a", "c"]))
  })
})

describe("load more", () => {
  it("is requested once per collection instance (End twice -> one call)", () => {
    const onLoadMore = vi.fn()
    const first = ids("a", "b", "c")
    const h = harness({ collection: first, props: { onLoadMore } })
    h.run("navigate", NAV("last"))
    h.run("navigate", NAV("last"))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    // A new collection (the page arrived) re-arms it.
    h.state.props = { ...h.state.props, collection: first.insert(3, row("d")) }
    h.run("navigate", NAV("last"))
    h.run("navigate", NAV("last"))
    expect(onLoadMore).toHaveBeenCalledTimes(2)
  })

  it("is not requested while loading, or before the last item", () => {
    const onLoadMore = vi.fn()
    const loading = harness({ props: { onLoadMore, loading: "loading-more" } })
    loading.run("navigate", NAV("last"))
    const early = harness({ props: { onLoadMore } })
    early.run("navigate", NAV("first"))
    expect(onLoadMore).not.toHaveBeenCalled()
  })
})

describe("scrollToHighlighted", () => {
  const scroll = { type: "COMPOSITE.BLUR" } as const

  it("does nothing without a scroll reason (pointer highlight, collection change)", () => {
    const scrollToIndex = vi.fn()
    const h = harness({
      props: { virtualized: true, scrollToIndex },
      context: { highlightedKey: k("b"), scrollReason: null },
    })
    h.run("scrollToHighlighted", scroll)
    expect(scrollToIndex).not.toHaveBeenCalled()
  })

  it("a pointer highlight and a collection change leave no reason to scroll", () => {
    const h = harness({ context: { highlightedKey: k("b") } })
    h.run("highlight", { type: "HIGHLIGHT", key: k("c"), source: "pointer" })
    expect(h.context.scrollReason).toBeNull()
    const prev = ids("a", "b", "c")
    const r = harness({
      collection: prev.remove(k("c")),
      context: { highlightedKey: k("c"), lastCollection: prev, scrollReason: "navigation" },
    })
    r.run("repairCollection", { type: "COLLECTION.CHANGE" })
    expect(r.context.scrollReason).toBeNull()
  })

  it("virtualized: scrollToIndex gets index, key, reason and nearest alignment", () => {
    const calls: ScrollToIndexDetails[] = []
    const h = harness({
      props: { virtualized: true, scrollToIndex: (d) => calls.push(d) },
      context: { highlightedKey: k("c"), scrollReason: "navigation" },
    })
    h.run("scrollToHighlighted", scroll)
    expect(calls).toEqual([{ index: 2, key: "c", reason: "navigation", align: "nearest" }])
  })

  it("HIGHLIGHT with open: true centres; typeahead is nearest", () => {
    const calls: ScrollToIndexDetails[] = []
    const h = harness({ props: { virtualized: true, scrollToIndex: (d) => calls.push(d) } })
    h.run("highlight", { type: "HIGHLIGHT", key: k("b"), source: "programmatic", open: true })
    h.run("scrollToHighlighted", scroll)
    expect(calls.at(-1)).toMatchObject({ key: "b", reason: "open", align: "center" })
    h.run("typeahead", {
      type: "TYPEAHEAD",
      char: "c",
      composing: false,
      modifiers: { ctrl: false, meta: false, alt: false },
    })
    h.run("scrollToHighlighted", scroll)
    expect(calls.at(-1)).toMatchObject({ key: "c", reason: "typeahead", align: "nearest" })
  })

  it("not virtualized: scrollIntoView, never smooth", () => {
    const scrollIntoView = vi.fn()
    // Only scrollIntoView is read; the node environment has no DOM to build a real element.
    const el = { scrollIntoView } as unknown as HTMLElement
    const h = harness({
      getById: (id) => (id === "item-b" ? el : null),
      context: { highlightedKey: k("b"), scrollReason: "navigation" },
    })
    h.run("scrollToHighlighted", scroll)
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    })
  })
})

describe("announceHighlighted", () => {
  const veg = listOf([
    row("Carrot", { section: "Vegetables" }),
    row("Celery", { section: "Vegetables" }),
    row("Kale", { section: "Vegetables" }),
    row("Apple", { section: "Fruit" }),
  ])
  const announce = (h: ReturnType<typeof harness>) =>
    h.run("announceHighlighted", { type: "COMPOSITE.BLUR" })
  const ad = (over: Options = {}) =>
    harness({
      collection: veg,
      platform: platforms.apple,
      props: { strategy: "active-descendant", selectionMode: "single" },
      context: { highlightSource: "keyboard", highlightedKey: k("Carrot") },
      ...over,
    })

  it("VoiceOver on macOS: section entered, text and selected state", () => {
    const h = ad()
    announce(h)
    expect(h.announced[0]?.message).toBe("Vegetables, 3 options, Carrot, not selected")
    expect(h.announced[0]?.key).toBe("list:highlight")
    // Same section: no repeat of the section.
    h.run("highlight", { type: "HIGHLIGHT", key: k("Celery"), source: "keyboard" })
    announce(h)
    expect(h.announced[1]?.message).toBe("Celery, not selected")
    // A new section is announced again.
    h.run("highlight", { type: "HIGHLIGHT", key: k("Apple"), source: "keyboard" })
    announce(h)
    expect(h.announced[2]?.message).toBe("Fruit, 1 option, Apple, not selected")
  })

  it("says 'selected' for a selected item", () => {
    const h = ad({ values: { value: new Set([k("Carrot")]) } })
    announce(h)
    expect(h.announced[0]?.message).toBe("Vegetables, 3 options, Carrot, selected")
  })

  it("omits the selected state when selection is off", () => {
    const h = ad({ props: { strategy: "active-descendant" } })
    announce(h)
    expect(h.announced[0]?.message).toBe("Vegetables, 3 options, Carrot")
  })

  it("highlight that follows typing is not announced", () => {
    const h = ad({ context: { highlightSource: "typing", highlightedKey: k("Carrot") } })
    announce(h)
    expect(h.announced).toEqual([])
  })

  it("pointer and typeahead highlights are not announced", () => {
    for (const source of ["pointer", "typeahead", "programmatic"] as const) {
      const h = ad({ context: { highlightSource: source, highlightedKey: k("Carrot") } })
      announce(h)
      expect(h.announced).toEqual([])
    }
  })

  it("Windows (no vo-activedescendant quirk): nothing", () => {
    const h = ad({ platform: platforms.windows })
    announce(h)
    expect(h.announced).toEqual([])
  })

  it("VoiceOver with Chrome (blink engine): nothing", () => {
    const h = ad({ platform: withEngine(platforms.apple, "blink") })
    announce(h)
    expect(h.announced).toEqual([])
  })

  it("roving strategy: nothing", () => {
    const h = ad({ props: { strategy: "roving", selectionMode: "single" } })
    announce(h)
    expect(h.announced).toEqual([])
  })
})
