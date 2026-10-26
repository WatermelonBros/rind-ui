// The Listbox machine in Node (tasks 1.3): toggle and replace behaviours, ranges with a
// controlled value, select all, none + action, disabled, the entry highlight. No DOM.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { type ListboxProps, type ListboxValue, listboxMachine } from "./listbox.machine"

const list = (...keys: string[]) =>
  createListCollection({
    items: keys.map((id) => ({ id })),
    getKey: (r) => r.id,
    getText: (r) => r.id,
  })
const env = {
  dom: { getRootNode: () => document, getById: () => null, activeElement: () => null },
  clock: { now: () => 0 },
  layout: { pageTarget: () => null },
  locale: { locale: () => "en", dir: () => "ltr" },
  platform: platforms.linux,
  announcer: { announce: vi.fn(), prepare: () => () => {}, cancel: () => {} },
  modality: {
    modality: () => "keyboard",
    subscribe: () => () => {},
    focusCause: () => "other",
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}

function make(over: Partial<ListboxProps> = {}) {
  const onValueChange = vi.fn()
  const onAction = vi.fn()
  const props: ListboxProps = {
    collection: list("a", "b", "c", "d", "e"),
    strategy: "roving",
    ids: { list: "list", item: (k) => `item-${k}` },
    // The adapter passes the Listbox default (the collection pieces default to "none").
    selectionMode: "single",
    onValueChange,
    ...over,
  }
  if (!("onAction" in over)) (props as { onAction?: unknown }).onAction = onAction
  const s = createService(listboxMachine, props as never, env as never)
  s.start()
  const send = (e: Parameters<typeof s.send>[0]) => s.send(e)
  return {
    s,
    props,
    onValueChange,
    onAction,
    value: () => s.view().values.value as ListboxValue,
    highlighted: () => s.getSnapshot().context.highlightedKey,
    focus: () => send({ type: "FOCUS", modality: "keyboard" }),
    down: (o: { extend?: boolean; mod?: boolean } = {}) =>
      send({ type: "NAVIGATE", move: "next", ...o }),
    space: (
      key = s.getSnapshot().context.highlightedKey,
      o: { shift?: boolean; mod?: boolean } = {},
    ) =>
      send({
        type: "SELECT",
        key: toKey(key ?? ""),
        modality: "keyboard",
        shift: o.shift ?? false,
        mod: o.mod ?? false,
      }),
    press: (
      key: string,
      o: { shift?: boolean; mod?: boolean; modality?: "pointer" | "touch" } = {},
    ) =>
      send({
        type: "SELECT",
        key: toKey(key),
        modality: o.modality ?? "pointer",
        shift: o.shift ?? false,
        mod: o.mod ?? false,
      }),
  }
}

describe("entry", () => {
  it("tabbing in highlights the first selected item, else the first", () => {
    const m = make({ defaultValue: "c" })
    m.focus()
    expect(m.highlighted()).toBe("c")
    const n = make()
    n.focus()
    expect(n.highlighted()).toBe("a")
  })
})

describe("toggle behaviour", () => {
  it("arrows move without selecting (zag#2947); single Space selects", () => {
    const m = make()
    m.focus()
    m.down()
    expect(m.value()).toBe(null)
    m.space()
    expect(m.value()).toBe("b")
  })

  it("multiple: Space toggles, called twice", () => {
    const m = make({ selectionMode: "multiple" })
    m.focus()
    m.space()
    m.down()
    m.down()
    m.space()
    expect(m.value()).toEqual(["a", "c"])
    expect(m.onValueChange).toHaveBeenCalledTimes(2)
  })

  it("Shift+ArrowDown in replace selects once per press", () => {
    const m = make({ selectionMode: "multiple", selectionBehavior: "replace" })
    m.focus()
    m.space()
    m.onValueChange.mockClear()
    m.down({ extend: true })
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.value()).toEqual(["a", "b"])
  })

  it("a disabled item in none mode never acts on a press", () => {
    const m = make({
      selectionMode: "none",
      collection: createListCollection({
        items: [{ id: "a" }, { id: "b", off: true }],
        getKey: (r) => r.id,
        getText: (r) => r.id,
        isDisabled: (r) => "off" in r,
      }),
    })
    m.focus()
    m.press("b")
    expect(m.onAction).not.toHaveBeenCalled()
  })

  it("Shift+ArrowDown extends from the anchor", () => {
    const m = make({ selectionMode: "multiple" })
    m.focus()
    m.down()
    m.space()
    m.down({ extend: true })
    m.down({ extend: true })
    expect(m.value()).toEqual(["b", "c", "d"])
    expect(m.highlighted()).toBe("d")
  })

  it("ranges with a controlled value (react-spectrum#7947, #10147)", () => {
    let value: ListboxValue = []
    const m = make({ selectionMode: "multiple", value })
    m.onValueChange.mockImplementation((v: ListboxValue) => {
      value = Array.isArray(v) ? [...v] : v
      m.s.setProps({ ...m.props, value } as never)
    })
    m.focus()
    m.down()
    m.space()
    m.down({ extend: true })
    m.down({ extend: true })
    expect(value).toEqual(["b", "c", "d"])
  })

  it("select all reports all", () => {
    const m = make({ selectionMode: "multiple" })
    m.focus()
    m.s.send({ type: "SELECT_ALL" })
    expect(m.value()).toBe("all")
  })
})

describe("replace behaviour", () => {
  it("selection follows focus; mod+arrow moves without selecting", () => {
    const m = make({ selectionBehavior: "replace", defaultValue: "a" })
    m.focus()
    m.down()
    expect(m.value()).toBe("b")
    const n = make({ selectionBehavior: "replace", selectionMode: "multiple", defaultValue: ["a"] })
    n.focus()
    n.down({ mod: true })
    expect(n.value()).toEqual(["a"])
    n.space(undefined, { mod: true })
    expect(n.value()).toEqual(["a", "b"])
  })

  it("a focus no key caused does not select (rule 13)", () => {
    const m = make({ selectionBehavior: "replace", defaultValue: "a" })
    m.focus()
    m.s.send({ type: "HIGHLIGHT", key: toKey("c"), source: "programmatic" })
    expect(m.value()).toBe("a")
  })

  it("touch toggles in multiple replace", () => {
    const m = make({ selectionBehavior: "replace", selectionMode: "multiple" })
    m.focus()
    m.press("a", { modality: "touch" })
    m.press("c", { modality: "touch" })
    expect(m.value()).toEqual(["a", "c"])
  })

  it("Shift+click range after mouse moves (zag#3347)", () => {
    const m = make({ selectionBehavior: "replace", selectionMode: "multiple" })
    m.focus()
    m.press("b")
    m.press("e", { shift: true })
    expect(m.value()).toEqual(["b", "c", "d", "e"])
  })

  it("double press and Enter act once", () => {
    const m = make({ selectionBehavior: "replace" })
    m.focus()
    m.press("c")
    m.s.send({ type: "ACTION", key: toKey("c"), modality: "pointer", via: "double-press" })
    expect(m.value()).toBe("c")
    expect(m.onAction).toHaveBeenCalledTimes(1)
    expect(m.onAction).toHaveBeenCalledWith("c", { modality: "pointer", via: "double-press" })
  })
})

describe("none mode", () => {
  it("Enter / press is an action, nothing is selected", () => {
    const m = make({ selectionMode: "none" })
    m.focus()
    m.down()
    m.down()
    m.space()
    expect(m.onAction).toHaveBeenCalledWith("c", { modality: "keyboard", via: "enter" })
    expect(m.value()).toBe(null)
  })

  it("a disabled item never acts", () => {
    const m = make({
      selectionMode: "none",
      collection: createListCollection({
        items: [{ id: "a" }, { id: "b", off: true }],
        getKey: (r) => r.id,
        getText: (r) => r.id,
        isDisabled: (r) => "off" in r,
      }),
    })
    m.focus()
    m.s.send({ type: "ACTION", key: toKey("b"), modality: "pointer", via: "press" })
    expect(m.onAction).not.toHaveBeenCalled()
  })
})

describe("Listbox active-descendant on Apple platforms", () => {
  it("a keyboard move announces the highlighted option (VoiceOver in Safari reads nothing)", () => {
    const announce = vi.fn()
    const props: ListboxProps = {
      collection: list("a", "b", "c"),
      strategy: "active-descendant",
      ids: { list: "list", item: (k) => `item-${k}` },
      selectionMode: "single",
    }
    const s = createService(
      listboxMachine,
      props as never,
      { ...env, platform: platforms.apple, announcer: { ...env.announcer, announce } } as never,
    )
    s.start()
    s.send({ type: "FOCUS", modality: "keyboard" })
    s.send({ type: "NAVIGATE", move: "next" })
    expect(announce).toHaveBeenCalled()
  })
})
