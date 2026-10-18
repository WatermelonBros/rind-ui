// The Grid List machine in Node (tasks 2.2, 1.4): selection versus action per mode and
// behaviour, the checkbox override, Space vs action, child positions, the spatial fallback and
// the WebKit selection announcement.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { type GridListProps, type GridListValue, gridListMachine } from "./grid-list.machine"

const rows = (...keys: string[]) =>
  createListCollection({
    items: keys.map((id) => ({ id })),
    getKey: (r) => r.id,
    getText: (r) => r.id,
  })

const announce = vi.fn()
function envOf(platform = platforms.linux, row: unknown = null) {
  return {
    dom: { getRootNode: () => document, getById: () => row, activeElement: () => null },
    clock: { now: () => 0 },
    layout: { pageTarget: () => null },
    locale: { locale: () => "en", dir: () => "ltr" },
    platform,
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
}

function make(over: Partial<GridListProps> = {}, env = envOf()) {
  announce.mockClear()
  const onAction = vi.fn()
  const props: GridListProps = {
    collection: rows("a", "b", "c", "d"),
    strategy: "roving",
    ids: { list: "list", item: (k) => `item-${k}` },
    selectionMode: "multiple",
    defaultValue: [],
    ...over,
  }
  if (!("onAction" in over)) (props as { onAction?: unknown }).onAction = onAction
  const s = createService(gridListMachine, props as never, env as never)
  s.start()
  const send = (e: Parameters<typeof s.send>[0]) => s.send(e)
  return {
    s,
    onAction,
    value: () => s.view().values.value as GridListValue,
    ctx: () => s.getSnapshot().context,
    focus: () => send({ type: "FOCUS", modality: "keyboard" }),
    press: (key: string, o: { shift?: boolean; mod?: boolean } = {}) =>
      send({
        type: "PRESS_ROW",
        key: toKey(key),
        modality: "pointer",
        shift: o.shift ?? false,
        mod: o.mod ?? false,
      }),
    space: (key: string) =>
      send({ type: "SELECT", key: toKey(key), modality: "keyboard", shift: false, mod: true }),
    send,
  }
}

describe("selection versus action", () => {
  it("toggle with onAction: a press acts while nothing is selected, then toggles", () => {
    const m = make()
    m.press("a")
    expect(m.onAction).toHaveBeenCalledWith("a", { modality: "pointer", via: "press" })
    expect(m.value()).toEqual([])
    m.space("b")
    m.press("c")
    expect(m.value()).toEqual(["b", "c"])
  })

  it("toggle without action: a press toggles", () => {
    const m = make({ onAction: undefined })
    m.press("a")
    m.press("b")
    m.press("a")
    expect(m.value()).toEqual(["b"])
  })

  it("replace: a press selects only that row", () => {
    const m = make({ selectionBehavior: "replace", onAction: undefined })
    m.press("a")
    m.press("c")
    expect(m.value()).toEqual(["c"])
  })

  it("a checkbox row's press only acts (RS#9610, #7962); its checkbox toggles even in replace", () => {
    const m = make({ selectionBehavior: "replace", checkboxes: new Set([toKey("a"), toKey("b")]) })
    m.space("a")
    m.press("b")
    expect(m.onAction).toHaveBeenCalledWith("b", expect.anything())
    expect(m.value()).toEqual(["a"])
    m.space("b")
    expect(m.value()).toEqual(["a", "b"])
  })

  it("none mode: a press acts; a disabled row never acts", () => {
    const m = make({ selectionMode: "none" })
    m.press("b")
    expect(m.onAction).toHaveBeenCalledTimes(1)
    const d = make({ selectionMode: "none", disabled: true })
    d.press("b")
    expect(d.onAction).not.toHaveBeenCalled()
  })

  it("keys 0 and empty are ordinary keys (RS#7076)", () => {
    const m = make({ collection: rows("0", "", "x"), onAction: undefined })
    m.press("0")
    m.press("")
    expect(m.value()).toEqual(["0", ""])
  })
})

describe("child positions", () => {
  it("NAVIGATE_CHILD next: childIndex 1, focus requested on the first control", () => {
    const first = { focus: vi.fn() }
    const second = { focus: vi.fn() }
    const row = {
      focus: vi.fn(),
      querySelectorAll: () => [first, second].map((c) => ({ ...c, closest: () => row })),
    }
    const m = make({}, envOf(platforms.linux, row))
    m.focus()
    m.send({ type: "NAVIGATE_CHILD", direction: "next", count: 2 })
    expect(m.ctx().childIndex).toBe(1)
    m.send({ type: "NAVIGATE_CHILD", direction: "next", count: 2 })
    m.send({ type: "NAVIGATE_CHILD", direction: "next", count: 2 })
    expect(m.ctx().childIndex).toBe(2)
    m.send({ type: "NAVIGATE_CHILD", direction: "row", count: 2 })
    expect(m.ctx().childIndex).toBe(0)
    expect(row.focus).toHaveBeenCalled()
  })

  it("control focus keeps the row highlighted; a row move resets the child", () => {
    const m = make()
    m.focus()
    m.send({ type: "FOCUS_CHILD", key: toKey("b"), index: 2, pointer: false })
    expect(m.ctx().highlightedKey).toBe("b")
    expect(m.ctx().childIndex).toBe(2)
    m.send({ type: "NAVIGATE", move: "next" })
    expect(m.ctx().highlightedKey).toBe("c")
    expect(m.ctx().childIndex).toBe(0)
  })
})

describe("spatial moves", () => {
  it("a measured target is highlighted; no measurement falls back to collection order", () => {
    const m = make()
    m.focus()
    m.send({ type: "NAVIGATE_SPATIAL", direction: "down", target: toKey("d") })
    expect(m.ctx().highlightedKey).toBe("d")
    m.send({ type: "NAVIGATE_SPATIAL", direction: "up", target: null })
    expect(m.ctx().highlightedKey).toBe("c")
  })
})

describe("selection announcement (webkit-grid-selection-not-announced)", () => {
  it("Apple WebKit: one polite message per change", () => {
    const m = make({}, envOf(platforms.apple))
    m.space("b")
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce.mock.calls[0]?.[0]).toMatchObject({ message: "b selected", priority: "polite" })
    m.space("b")
    expect(announce.mock.calls[1]?.[0]).toMatchObject({ message: "b not selected" })
  })

  it("elsewhere: nothing", () => {
    const m = make()
    m.space("b")
    expect(announce).not.toHaveBeenCalled()
  })
})
