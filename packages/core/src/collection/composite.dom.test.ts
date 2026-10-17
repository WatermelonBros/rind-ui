import { describe, expect, it } from "vitest"
import { platforms } from "../dom/platform"
import type { PlatformFlags } from "../env/capabilities"
import {
  type CompositeEnv,
  type CompositeOptions,
  type CompositeState,
  composite,
  tabStop,
} from "./composite"
import { type CollectionKey, toKey } from "./key"
import { type Collection, createListCollection } from "./list"
import type { CollectionEvent, HighlightSource } from "./machine"
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
const k = toKey
const keys = (...names: string[]) => new Set(names.map(k))

function envOf(
  over: { platform?: PlatformFlags; dir?: "ltr" | "rtl"; modality?: "keyboard" | "pointer" } = {},
): CompositeEnv {
  return {
    platform: over.platform ?? platforms.linux,
    locale: { dir: () => over.dir ?? "ltr" },
    modality: {
      modality: () => over.modality ?? "keyboard",
      subscribe: () => () => {},
      focusCause: () => "other",
      markFocus: () => {},
      unmarkFocus: () => {},
      recentFocus: () => [],
    },
  }
}

const state = (over: Partial<CompositeState> = {}): CompositeState => ({
  collection: ids("a", "b", "c"),
  highlightedKey: null,
  highlightSource: null,
  selection: new Set<CollectionKey>(),
  selectionMode: "single",
  ...over,
})
const options = (over: Partial<CompositeOptions> = {}): CompositeOptions => ({
  scope: "listbox",
  instance: "r1",
  ids: { list: "lb", item: (key) => `lb-item-${key}` },
  strategy: "roving",
  orientation: "vertical",
  listRole: "listbox",
  itemRole: "option",
  ...over,
})

function setup(
  s: Partial<CompositeState> = {},
  o: Partial<CompositeOptions> = {},
  env: CompositeEnv = envOf(),
) {
  const sent: CollectionEvent[] = []
  const parts = composite(state(s), (e) => sent.push(e), env, options(o))
  return { sent, parts, list: parts.list(), item: (key: string) => parts.item(k(key)) }
}

type Handler = (event: unknown) => void
const handler = (props: Record<string, unknown>, name: string): Handler => {
  const fn = props[name]
  if (typeof fn !== "function") throw new Error(`no ${name} handler`)
  return fn as Handler
}
function press(
  s: ReturnType<typeof setup>,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key, cancelable: true, ...init })
  handler(s.list, "onKeyDown")(e)
  return e
}

describe("tabStop", () => {
  it("the highlighted navigable item", () => {
    expect(tabStop(state({ highlightedKey: k("b"), selection: keys("c") }))).toBe("b")
  })

  it("else the first selected navigable item", () => {
    expect(tabStop(state({ selection: keys("c", "b") }))).toBe("b")
    const c = listOf([row("a"), row("b", { disabled: true }), row("c")])
    expect(tabStop(state({ collection: c, selection: keys("b", "c") }))).toBe("c")
  })

  it("a disabled highlight does not hold the stop", () => {
    const c = listOf([row("a"), row("b", { disabled: true })])
    expect(tabStop(state({ collection: c, highlightedKey: k("b") }))).toBe("a")
  })

  it("else the first navigable item", () => {
    const c = listOf([row("a", { disabled: true }), row("b")])
    expect(tabStop(state({ collection: c }))).toBe("b")
  })

  it('disabledBehavior "selection" keeps disabled items as tab stops; "all" skips them', () => {
    const c = listOf([row("a", { disabled: true }), row("b")])
    expect(tabStop(state({ collection: c, disabledBehavior: "selection" }))).toBe("a")
    const held = state({ collection: c, highlightedKey: k("a"), disabledBehavior: "selection" })
    expect(tabStop(held)).toBe("a")
    expect(tabStop(state({ collection: c, disabledBehavior: "all" }))).toBe("b")
    expect(tabStop(state({ collection: c }))).toBe("b")
  })

  it('the item parts follow: a disabled item is tabindex 0 only with "selection"', () => {
    const c = listOf([row("a", { disabled: true }), row("b")])
    const sel = setup({ collection: c, disabledBehavior: "selection" })
    expect(sel.item("a")["tabindex"]).toBe(0)
    expect(sel.item("b")["tabindex"]).toBe(-1)
    const all = setup({ collection: c })
    expect(all.item("a")["tabindex"]).toBe(-1)
    expect(all.item("b")["tabindex"]).toBe(0)
  })

  it("focusableWhenDisabled keeps disabled items navigable", () => {
    const c = listOf([row("a", { disabled: true }), row("b")])
    expect(tabStop(state({ collection: c, focusableWhenDisabled: true }))).toBe("a")
  })

  it("selection 'all' resolves to the first enabled item", () => {
    const c = listOf([row("a", { disabled: true }), row("b")])
    expect(tabStop(state({ collection: c, selection: "all" }))).toBe("b")
  })

  it("null when no item is navigable", () => {
    expect(tabStop(state({ collection: listOf([row("a", { disabled: true })]) }))).toBeNull()
    expect(tabStop(state({ collection: ids() }))).toBeNull()
  })
})

describe("roving tab stop on the parts", () => {
  it("exactly one item is the stop and the container is not", () => {
    const s = setup({ selection: keys("b") })
    expect(s.list["tabindex"]).toBe(-1)
    expect([s.item("a")["tabindex"], s.item("b")["tabindex"], s.item("c")["tabindex"]]).toEqual([
      -1, 0, -1,
    ])
  })

  it("the container is the stop when no item is navigable", () => {
    const s = setup({ collection: listOf([row("a", { disabled: true })]) })
    expect(s.list["tabindex"]).toBe(0)
    expect(s.item("a")["tabindex"]).toBe(-1)
  })

  it("an empty collection: the container is the stop", () => {
    expect(setup({ collection: ids() }).list["tabindex"]).toBe(0)
  })

  it("a disabled composite: nothing tabbable, the container has no tabindex", () => {
    const s = setup({ disabled: true, selection: keys("b") })
    expect(s.list["tabindex"]).toBeUndefined()
    expect(s.list["aria-disabled"]).toBe("true")
    expect(s.list["data-disabled"]).toBe("")
    expect(["a", "b", "c"].map((n) => s.item(n)["tabindex"])).toEqual([-1, -1, -1])
  })

  it("a disabled composite ignores keys", () => {
    const s = setup({ disabled: true, highlightedKey: k("a") })
    const e = press(s, "ArrowDown")
    expect(s.sent).toEqual([])
    expect(e.defaultPrevented).toBe(false)
  })

  it("disabled but focusableWhenDisabled keeps the stop", () => {
    const s = setup({ disabled: true, focusableWhenDisabled: true })
    expect(s.item("a")["tabindex"]).toBe(0)
    expect(s.list["tabindex"]).toBe(-1)
  })

  it("pending (server render): the selected key is the stop, else the container", () => {
    const withValue = setup({ pending: true, selection: keys("b") })
    expect(withValue.list["tabindex"]).toBe(-1)
    expect(withValue.item("b")["tabindex"]).toBe(0)
    expect(withValue.item("a")["tabindex"]).toBe(-1)
    const none = setup({ pending: true, collection: ids() })
    expect(none.list["tabindex"]).toBe(0)
    expect(none.item("a")["tabindex"]).toBe(-1)
    // Not empty while pending: the items simply have not registered yet.
    expect(none.list["data-empty"]).toBeUndefined()
  })

  it("pending with 'all' selected has no single selected key: the container", () => {
    expect(setup({ pending: true, selection: "all" }).list["tabindex"]).toBe(0)
  })
})

describe("active descendant", () => {
  it("the container is always tabbable, items are not, and the highlight is referenced", () => {
    const s = setup({ highlightedKey: k("b") }, { strategy: "active-descendant" })
    expect(s.list["tabindex"]).toBe(0)
    expect(s.list["aria-activedescendant"]).toBe("lb-item-b")
    expect(s.item("b")["tabindex"]).toBeUndefined()
    expect(s.item("a")["tabindex"]).toBeUndefined()
  })

  it("no aria-activedescendant without a highlight, or when the key left the collection", () => {
    expect(
      setup({}, { strategy: "active-descendant" }).list["aria-activedescendant"],
    ).toBeUndefined()
    const gone = setup({ highlightedKey: k("zzz") }, { strategy: "active-descendant" })
    expect(gone.list["aria-activedescendant"]).toBeUndefined()
    expect(gone.parts.activeDescendant()["aria-activedescendant"]).toBeUndefined()
  })

  it("roving never sets aria-activedescendant", () => {
    expect(setup({ highlightedKey: k("b") }).list["aria-activedescendant"]).toBeUndefined()
  })
})

describe("list attributes", () => {
  it("role, id, orientation and scope attributes", () => {
    const s = setup()
    expect(s.list).toMatchObject({
      id: "lb",
      role: "listbox",
      "aria-orientation": "vertical",
      "data-orientation": "vertical",
      "data-scope": "listbox",
      "data-part": "list",
      "data-instance": "r1",
    })
    expect(setup({}, { orientation: "both" }).list["aria-orientation"]).toBeUndefined()
    expect(setup({}, { orientation: "both" }).list["data-orientation"]).toBe("both")
  })

  it("aria-multiselectable only in multiple mode", () => {
    expect(setup({ selectionMode: "multiple" }).list["aria-multiselectable"]).toBe("true")
    expect(setup({ selectionMode: "single" }).list["aria-multiselectable"]).toBeUndefined()
  })

  it("data-empty, data-loading and aria-busy", () => {
    expect(setup({ collection: ids() }).list["data-empty"]).toBe("")
    expect(setup().list["data-empty"]).toBeUndefined()
    for (const loading of ["loading", "loading-more"] as const) {
      const l = setup({ loading }).list
      expect(l["data-loading"]).toBe("")
      expect(l["aria-busy"]).toBe("true")
    }
    for (const loading of ["idle", "error", undefined] as const) {
      const l = setup({ loading }).list
      expect(l["data-loading"]).toBeUndefined()
      expect(l["aria-busy"]).toBeUndefined()
    }
  })
})

describe("item attributes", () => {
  it("explicit aria-selected true/false in a selectable list", () => {
    const s = setup({ selection: keys("b") })
    expect(s.item("a")["aria-selected"]).toBe("false")
    expect(s.item("b")["aria-selected"]).toBe("true")
    expect(s.item("b")["data-selected"]).toBe("")
    expect(s.item("a")["data-selected"]).toBeUndefined()
  })

  it("no selection attribute when selection is off; a custom attribute otherwise", () => {
    const none = setup({ selectionMode: "none" })
    expect(none.item("a")["aria-selected"]).toBeUndefined()
    const checked = setup({ selection: keys("a") }, { selectionAttr: "aria-checked" })
    expect(checked.item("a")["aria-checked"]).toBe("true")
    expect(checked.item("a")["aria-selected"]).toBeUndefined()
  })

  it("'all' selects every enabled item", () => {
    const c = listOf([row("a"), row("b", { disabled: true })])
    const s = setup({ collection: c, selection: "all" })
    expect(s.item("a")["aria-selected"]).toBe("true")
    expect(s.item("b")["aria-selected"]).toBe("false")
  })

  it("id, role, data-key, data-disabled and aria-disabled", () => {
    const c = listOf([row("a"), row("b", { disabled: true })])
    const s = setup({ collection: c })
    expect(s.item("a")).toMatchObject({ id: "lb-item-a", role: "option", "data-key": "a" })
    expect(s.item("a")["data-disabled"]).toBeUndefined()
    expect(s.item("b")["data-disabled"]).toBe("")
    expect(s.item("b")["aria-disabled"]).toBe("true")
  })

  it("data-highlighted marks only the highlighted item", () => {
    const s = setup({ highlightedKey: k("b") })
    expect(["a", "b", "c"].map((n) => s.item(n)["data-highlighted"])).toEqual([
      undefined,
      "",
      undefined,
    ])
  })

  it("data-focus-visible only for keyboard and typeahead highlight sources", () => {
    const visible = (source: HighlightSource | null) =>
      setup({ highlightedKey: k("a"), highlightSource: source }).item("a")["data-focus-visible"]
    expect(visible("keyboard")).toBe("")
    expect(visible("typeahead")).toBe("")
    expect(visible("pointer")).toBeUndefined()
    expect(visible("typing")).toBeUndefined()
    expect(visible("programmatic")).toBeUndefined()
    expect(visible(null)).toBeUndefined()
    // Never on an item that is not highlighted.
    expect(
      setup({ highlightedKey: k("a"), highlightSource: "keyboard" }).item("b")[
        "data-focus-visible"
      ],
    ).toBeUndefined()
  })

  it("aria-posinset / aria-setsize, renumbered after filtering", () => {
    const all = ids("a", "b", "c", "d")
    const s = setup({ collection: all })
    expect(s.item("c")["aria-posinset"]).toBe(3)
    expect(s.item("c")["aria-setsize"]).toBe(4)
    const filtered = all.filter((n) => n.key === "b" || n.key === "d")
    const f = setup({ collection: filtered })
    expect(f.item("b")["aria-posinset"]).toBe(1)
    expect(f.item("d")["aria-posinset"]).toBe(2)
    expect(f.item("d")["aria-setsize"]).toBe(2)
    expect(f.item("b")["aria-level"]).toBeUndefined()
  })

  it("an unknown key has no set metadata and is never highlighted", () => {
    const s = setup({ highlightedKey: k("zzz") })
    const p = s.item("zzz")
    expect(p["aria-posinset"]).toBeUndefined()
    expect(p["data-highlighted"]).toBeUndefined()
  })
})

describe("tree", () => {
  const tree = createTreeCollection<{ id: string; kids?: { id: string }[] }>({
    roots: [{ id: "a", kids: [{ id: "a1" }, { id: "a2" }] }, { id: "b" }],
    getKey: (n) => n.id,
    getText: (n) => n.id,
    getChildren: (n) => n.kids,
  })

  it("aria-level, aria-expanded on branches only, sibling position", () => {
    const expanded = keys("a")
    const s = setup(
      { collection: tree.visible(expanded), expanded },
      { itemRole: "treeitem", tree: true },
    )
    expect(s.item("a")["aria-level"]).toBe(1)
    expect(s.item("a")["aria-expanded"]).toBe("true")
    expect(s.item("a1")["aria-level"]).toBe(2)
    expect(s.item("a1")["aria-expanded"]).toBeUndefined()
    expect(s.item("a2")["aria-posinset"]).toBe(2)
    expect(s.item("a2")["aria-setsize"]).toBe(2)
    expect(s.item("b")["aria-posinset"]).toBe(2)
  })

  it("a collapsed branch is aria-expanded=false", () => {
    const expanded = new Set<CollectionKey>()
    const s = setup({ collection: tree.visible(expanded), expanded }, { tree: true })
    expect(s.item("a")["aria-expanded"]).toBe("false")
  })

  it("the cross axis expands and collapses, only in a tree", () => {
    const t = setup({ collection: tree, highlightedKey: k("a") }, { tree: true })
    press(t, "ArrowRight")
    press(t, "ArrowLeft")
    expect(t.sent).toEqual([
      { type: "NAVIGATE", move: "expand" },
      { type: "NAVIGATE", move: "collapse" },
    ])
    const flat = setup({ highlightedKey: k("a") })
    press(flat, "ArrowRight")
    expect(flat.sent).toEqual([])
  })
})

describe("sections", () => {
  const c = listOf([row("x", { section: "Hot Drinks" }), row("y", { section: "Hot Drinks" })])

  it("group labelled by the label part; keys with spaces are encoded", () => {
    const s = setup({ collection: c })
    const section = c.sections()[0]
    if (!section) throw new Error("no section")
    const group = s.parts.section(section)
    const label = s.parts.sectionLabel(section)
    expect(group["role"]).toBe("group")
    expect(label["id"]).toBe("lb-section-Hot_20_Drinks")
    expect(group["aria-labelledby"]).toBe(label["id"])
    expect(/\s/.test(String(group["aria-labelledby"]))).toBe(false)
    expect(group["data-part"]).toBe("section")
    expect(label["data-part"]).toBe("section-label")
    expect(s.parts.separator()).toMatchObject({ role: "separator", "data-part": "separator" })
  })
})

describe("keyboard handler", () => {
  const move = (m: string, extend = false) => [{ type: "NAVIGATE", move: m, extend, mod: false }]

  it("ArrowDown/ArrowUp navigate on a vertical list and prevent default", () => {
    const s = setup()
    const down = press(s, "ArrowDown")
    press(s, "ArrowUp")
    expect(s.sent).toEqual([...move("next"), ...move("previous")])
    expect(down.defaultPrevented).toBe(true)
  })

  it("ignores the cross axis on a flat list", () => {
    const s = setup()
    press(s, "ArrowLeft")
    expect(s.sent).toEqual([])
  })

  it("horizontal: ArrowRight is next in ltr, ArrowLeft is next in rtl", () => {
    const ltr = setup({}, { orientation: "horizontal" })
    press(ltr, "ArrowRight")
    expect(ltr.sent).toEqual(move("next"))
    const rtl = setup({}, { orientation: "horizontal" }, envOf({ dir: "rtl" }))
    press(rtl, "ArrowLeft")
    press(rtl, "ArrowRight")
    expect(rtl.sent).toEqual([...move("next"), ...move("previous")])
  })

  it("Home, End, PageDown, PageUp", () => {
    const s = setup()
    for (const key of ["Home", "End", "PageDown", "PageUp"]) press(s, key)
    expect(s.sent).toEqual([
      ...move("first"),
      ...move("last"),
      ...move("page-next"),
      ...move("page-previous"),
    ])
  })

  it("Shift+ArrowDown extends", () => {
    const s = setup()
    press(s, "ArrowDown", { shiftKey: true })
    expect(s.sent).toEqual(move("next", true))
  })

  it("Space while typing ahead continues the search", () => {
    const s = setup({ highlightedKey: k("b"), typingAhead: () => true })
    const e = press(s, " ")
    expect(s.sent).toMatchObject([{ type: "TYPEAHEAD", char: " " }])
    expect(e.defaultPrevented).toBe(true)
  })

  it("Space otherwise selects the highlighted item", () => {
    const s = setup({ highlightedKey: k("b"), typingAhead: () => false })
    press(s, " ")
    expect(s.sent).toEqual([
      { type: "SELECT", key: "b", modality: "keyboard", shift: false, mod: false },
    ])
  })

  it("Enter selects; nothing without a highlight", () => {
    const s = setup({ highlightedKey: k("c") })
    press(s, "Enter")
    expect(s.sent).toMatchObject([{ type: "SELECT", key: "c" }])
    const none = setup()
    const e = press(none, "Enter")
    expect(none.sent).toEqual([])
    expect(e.defaultPrevented).toBe(false)
  })

  it("selectKeys limits which key selects", () => {
    const space = setup({ highlightedKey: k("a") }, { selectKeys: "space" })
    press(space, "Enter")
    expect(space.sent).toEqual([])
    press(space, " ")
    expect(space.sent).toHaveLength(1)
    const enter = setup({ highlightedKey: k("a") }, { selectKeys: "enter" })
    press(enter, " ")
    expect(enter.sent).toEqual([])
    press(enter, "Enter")
    expect(enter.sent).toHaveLength(1)
  })

  describe("mod+A", () => {
    it("Meta+A on Apple selects all in multiple mode only", () => {
      const multi = setup({ selectionMode: "multiple" }, {}, envOf({ platform: platforms.apple }))
      const e = press(multi, "a", { metaKey: true })
      expect(multi.sent).toEqual([{ type: "SELECT_ALL" }])
      expect(e.defaultPrevented).toBe(true)
      const single = setup({ selectionMode: "single" }, {}, envOf({ platform: platforms.apple }))
      const e2 = press(single, "a", { metaKey: true })
      expect(single.sent).toEqual([])
      expect(e2.defaultPrevented).toBe(false)
    })

    it("Ctrl+A elsewhere; the other modifier does not count", () => {
      const win = setup({ selectionMode: "multiple" }, {}, envOf({ platform: platforms.windows }))
      press(win, "a", { metaKey: true })
      expect(win.sent).toEqual([])
      press(win, "a", { ctrlKey: true })
      expect(win.sent).toEqual([{ type: "SELECT_ALL" }])
      const mac = setup({ selectionMode: "multiple" }, {}, envOf({ platform: platforms.apple }))
      press(mac, "a", { ctrlKey: true })
      expect(mac.sent).toEqual([])
    })

    it("is not typeahead", () => {
      const s = setup({ selectionMode: "single" })
      press(s, "a", { ctrlKey: true })
      expect(s.sent).toEqual([])
    })
  })

  it("a composing key is ignored", () => {
    const s = setup({ highlightedKey: k("a") })
    press(s, "ArrowDown", { isComposing: true })
    press(s, "Enter", { isComposing: true })
    press(s, "x", { isComposing: true })
    expect(s.sent).toEqual([])
  })

  it("a printable character is typeahead; with a modifier it is not", () => {
    const s = setup()
    const e = press(s, "x")
    expect(s.sent).toMatchObject([{ type: "TYPEAHEAD", char: "x", composing: false }])
    expect(e.defaultPrevented).toBe(true)
    const m = setup()
    press(m, "x", { altKey: true })
    press(m, "Tab")
    press(m, "Escape")
    expect(m.sent).toEqual([])
  })

  it("Enter selects with the platform mod and shift flags", () => {
    const s = setup({ highlightedKey: k("a") }, {}, envOf({ platform: platforms.apple }))
    press(s, "Enter", { shiftKey: true, metaKey: true })
    expect(s.sent).toEqual([
      { type: "SELECT", key: "a", modality: "keyboard", shift: true, mod: true },
    ])
  })
})

describe("pointer and focus handlers", () => {
  const move = (s: ReturnType<typeof setup>, key: string, x: number, y: number, type = "mouse") =>
    handler(
      s.item(key),
      "onPointerMove",
    )({
      pointerType: type,
      clientX: x,
      clientY: y,
      currentTarget: document.body,
    })

  it("a zero-delta pointermove is ignored (list scrolls under a resting pointer)", () => {
    const s = setup()
    move(s, "a", 4001, 5001)
    expect(s.sent).toEqual([{ type: "POINTER_MOVE", key: "a" }])
    // Scrolling moves another item under the same position.
    move(s, "b", 4001, 5001)
    expect(s.sent).toHaveLength(1)
    move(s, "b", 4002, 5001)
    expect(s.sent).toEqual([
      { type: "POINTER_MOVE", key: "a" },
      { type: "POINTER_MOVE", key: "b" },
    ])
  })

  it("touch pointers never move the highlight", () => {
    const s = setup()
    move(s, "a", 4101, 5101, "touch")
    expect(s.sent).toEqual([])
  })

  it("click highlights then selects, with ⌘ on Apple and Control elsewhere", () => {
    const apple = setup({}, {}, envOf({ platform: platforms.apple, modality: "pointer" }))
    handler(apple.item("b"), "onClick")({ shiftKey: true, metaKey: true, ctrlKey: false })
    expect(apple.sent).toEqual([
      { type: "HIGHLIGHT", key: "b", source: "pointer" },
      { type: "SELECT", key: "b", modality: "pointer", shift: true, mod: true },
    ])
    const win = setup({}, {}, envOf({ platform: platforms.windows, modality: "pointer" }))
    handler(win.item("b"), "onClick")({ shiftKey: false, metaKey: true, ctrlKey: false })
    expect(win.sent[1]).toMatchObject({ mod: false })
  })

  it("roving focus on an item highlights it (a click or tap is a pointer highlight: no ring, no scroll)", () => {
    const kb = setup({}, {}, envOf({ modality: "keyboard" }))
    handler(kb.item("b"), "onFocus")({})
    expect(kb.sent).toEqual([{ type: "HIGHLIGHT", key: "b", source: "keyboard" }])
    const ptr = setup({}, {}, envOf({ modality: "pointer" }))
    handler(ptr.item("b"), "onFocus")({})
    expect(ptr.sent).toEqual([{ type: "HIGHLIGHT", key: "b", source: "pointer" }])
    const already = setup({ highlightedKey: k("b") })
    handler(already.item("b"), "onFocus")({})
    expect(already.sent).toEqual([])
  })

  it("focus leaving the list sends BLUR; moving inside it does not", () => {
    const s = setup()
    const list = document.createElement("div")
    const inner = document.createElement("button")
    list.append(inner)
    const out = document.createElement("button")
    handler(s.list, "onFocusOut")({ currentTarget: list, relatedTarget: inner })
    expect(s.sent).toEqual([])
    handler(s.list, "onFocusOut")({ currentTarget: list, relatedTarget: out })
    handler(s.list, "onFocusOut")({ currentTarget: list, relatedTarget: null })
    expect(s.sent).toEqual([{ type: "COMPOSITE.BLUR" }, { type: "COMPOSITE.BLUR" }])
  })
})

describe("tab stop in a tree (visible collection)", () => {
  it("Selected node under a collapsed parent", () => {
    const tree = createTreeCollection({
      roots: [{ id: "src", children: [{ id: "a.ts" }, { id: "b.ts" }] }, { id: "README" }] as {
        id: string
        children?: { id: string }[]
      }[],
      getKey: (n) => n.id,
      getText: (n) => n.id,
      getChildren: (n) => n.children,
    })
    const expanded = new Set<CollectionKey>()
    const visible = tree.visible(expanded)
    const stop = tabStop({
      collection: visible,
      highlightedKey: null,
      highlightSource: null,
      selection: new Set([toKey("a.ts")]),
      selectionMode: "single",
      tree,
      expanded,
    })
    expect(stop).toBe("src")
  })
})
