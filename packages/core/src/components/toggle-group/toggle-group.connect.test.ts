// Toggle Group part props in Node (openspec toggle-group "Semantics", "Keyboard And
// Activation", "Tab Stop And Focus", "Disabled Items", "Data Attributes").
import { describe, expect, it, vi } from "vitest"
import { createListCollection } from "../../collection/list"
import { CRITICAL } from "../../connect/props"
import { platforms } from "../../dom/platform"
import {
  type ToggleGroupConnectInput,
  type ToggleGroupItemState,
  toggleGroupConnect,
} from "./toggle-group.connect"
import type { ToggleGroupEvent } from "./toggle-group.machine"

const collectionOf = (...spec: (string | [string, boolean])[]) =>
  createListCollection<{ id: string; disabled: boolean }>({
    items: spec.map((s) => ({
      id: typeof s === "string" ? s : s[0],
      disabled: typeof s === "string" ? false : s[1],
    })),
    getKey: (i) => i.id,
    getText: (i) => i.id,
    isDisabled: (i) => i.disabled,
  })

const base: ToggleGroupConnectInput = {
  instance: "g",
  collection: collectionOf("a", "b", "c"),
  value: [],
  highlightedKey: null,
  pending: false,
  orientation: "horizontal",
  selectionMode: "single",
  disabled: false,
  focusableWhenDisabled: false,
  focusWithin: false,
}
const state: ToggleGroupItemState = {
  tag: "button",
  itemDisabled: false,
  focused: false,
  modality: "keyboard",
  pressed: false,
  hovered: false,
}

// Keys are plain strings in these tests; the brand is type-only (toKey is the identity).
type Api = ReturnType<typeof toggleGroupConnect>
type LooseApi = {
  root: Api["root"]
  item: (key: string, s: ToggleGroupItemState) => ReturnType<Api["item"]>
}
type Over = Partial<Omit<ToggleGroupConnectInput, "highlightedKey" | "value">> & {
  highlightedKey?: string | null
  value?: readonly string[]
}

function make(over: Over = {}, dir: "ltr" | "rtl" = "ltr") {
  const send = vi.fn<(e: ToggleGroupEvent) => void>()
  const env = {
    platform: platforms.linux,
    locale: { dir: () => dir },
    modality: {
      modality: () => "keyboard" as const,
      subscribe: () => () => {},
      focusCause: () => "other" as const,
      markFocus: () => {},
      unmarkFocus: () => {},
      recentFocus: () => [],
    },
  }
  const input = { ...base, ...over } as ToggleGroupConnectInput // brand: see Api above
  return { c: toggleGroupConnect(input, send, env as never) as unknown as LooseApi, send }
}
const attr = (props: object, name: string) => (props as Record<string, unknown>)[name]

describe("root", () => {
  it("role group, scope, no aria-orientation, data attributes", () => {
    const p = make().c.root()
    expect(p).toMatchObject({
      role: "group",
      "data-scope": "toggle-group",
      "data-part": "root",
      "data-orientation": "horizontal",
      "data-selection-mode": "single",
    })
    for (const a of ["aria-orientation", "aria-checked", "data-focus", "data-disabled"]) {
      expect(p[a], a).toBeUndefined()
    }
    for (const orientation of ["horizontal", "vertical"] as const) {
      const q = make({ orientation, selectionMode: "multiple" }).c.root()
      expect(q["aria-orientation"]).toBeUndefined()
      expect(q["data-orientation"]).toBe(orientation)
      expect(q["data-selection-mode"]).toBe("multiple")
    }
  })

  it("data-focus while an item has focus, data-disabled when disabled", () => {
    expect(make({ focusWithin: true }).c.root()["data-focus"]).toBe("")
    expect(make({ disabled: true }).c.root()["data-disabled"]).toBe("")
  })

  it("tabindex only when no item is navigable", () => {
    expect(make().c.root()["tabindex"]).toBeUndefined()
    expect(make({ collection: collectionOf() }).c.root()["tabindex"]).toBe(0)
    expect(make({ collection: collectionOf(["a", true], ["b", true]) }).c.root()["tabindex"]).toBe(
      0,
    )
    // Server render: items are not registered yet, the root is never the stop.
    expect(make({ pending: true, collection: collectionOf() }).c.root()["tabindex"]).toBeUndefined()
    expect(make({ disabled: true }).c.root()["tabindex"]).toBeUndefined()
  })

  it("focus leaving the group sends BLUR; focus moving inside does not", () => {
    const m = make()
    const inside = {}
    const root = { contains: (n: unknown) => n === inside }
    const out = attr(m.c.root(), "onFocusOut") as (e: unknown) => void
    out({ currentTarget: root, relatedTarget: inside })
    expect(m.send).not.toHaveBeenCalled()
    out({ currentTarget: root, relatedTarget: null })
    expect(m.send).toHaveBeenCalledWith({ type: "BLUR" })
  })
})

describe("root keydown", () => {
  const target = (part = "item", instance = "g") =>
    ({
      getAttribute: (n: string) =>
        n === "data-part" ? part : n === "data-instance" ? instance : null,
    }) as unknown as EventTarget
  function press(
    m: ReturnType<typeof make>,
    key: string,
    over: Record<string, unknown> = {},
    tgt: EventTarget = target(),
  ) {
    const preventDefault = vi.fn()
    const e = {
      key,
      code: key,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      repeat: false,
      timeStamp: 0,
      target: tgt,
      preventDefault,
      ...over,
    }
    ;(attr(m.c.root(), "onKeyDown") as (e: unknown) => void)(e)
    return preventDefault
  }

  it("horizontal: only Left/Right (+ Home/End) move; Up/Down do nothing", () => {
    const m = make()
    for (const [key, move] of [
      ["ArrowRight", "next"],
      ["ArrowLeft", "previous"],
      ["Home", "first"],
      ["End", "last"],
    ] as const) {
      m.send.mockClear()
      expect(press(m, key), key).toHaveBeenCalled()
      expect(m.send).toHaveBeenCalledWith({ type: "NAVIGATE", move })
    }
    m.send.mockClear()
    for (const key of ["ArrowUp", "ArrowDown"]) expect(press(m, key), key).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })

  it("vertical: both arrow pairs move", () => {
    const m = make({ orientation: "vertical" })
    for (const [key, move] of [
      ["ArrowDown", "next"],
      ["ArrowRight", "next"],
      ["ArrowUp", "previous"],
      ["ArrowLeft", "previous"],
    ] as const) {
      m.send.mockClear()
      expect(press(m, key), key).toHaveBeenCalled()
      expect(m.send).toHaveBeenCalledWith({ type: "NAVIGATE", move })
    }
  })

  it("RTL mirrors Left and Right", () => {
    const m = make({}, "rtl")
    press(m, "ArrowLeft")
    expect(m.send).toHaveBeenLastCalledWith({ type: "NAVIGATE", move: "next" })
    press(m, "ArrowRight")
    expect(m.send).toHaveBeenLastCalledWith({ type: "NAVIGATE", move: "previous" })
  })

  it("modified and composing keys do nothing and are not prevented", () => {
    const m = make()
    for (const over of [
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
      { isComposing: true },
      { keyCode: 229 },
    ]) {
      expect(press(m, "ArrowRight", over), JSON.stringify(over)).not.toHaveBeenCalled()
    }
    expect(m.send).not.toHaveBeenCalled()
  })

  it("a foreign target or another instance is ignored", () => {
    const m = make()
    expect(press(m, "ArrowRight", {}, target("root"))).not.toHaveBeenCalled()
    expect(press(m, "ArrowRight", {}, target("item", "other"))).not.toHaveBeenCalled()
    expect(press(m, "ArrowRight", {}, null as never)).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })

  it("preventDefault only when handled: letters, Space, Enter, Tab pass", () => {
    const m = make()
    for (const key of ["a", "1", " ", "Enter", "Tab", "PageDown"]) {
      expect(press(m, key), key).not.toHaveBeenCalled()
    }
    expect(m.send).not.toHaveBeenCalled()
  })

  it("an inert (disabled, not focusable) group does nothing", () => {
    const m = make({ disabled: true })
    expect(press(m, "ArrowRight")).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })
})

describe("item", () => {
  const item = (key: string, over: Over = {}, s: Partial<ToggleGroupItemState> = {}) =>
    make(over).c.item(key, { ...state, ...s })

  it("native button (implicit role), explicit aria-pressed in both modes, never radio", () => {
    for (const selectionMode of ["single", "multiple"] as const) {
      const on = item("b", { value: ["b"], selectionMode })
      expect(on).toMatchObject({
        "aria-pressed": "true",
        "data-scope": "toggle-group",
        "data-part": "item",
        "data-key": "b",
        "data-state": "on",
        "data-orientation": "horizontal",
        type: "button",
      })
      expect(on[CRITICAL]).toEqual(expect.arrayContaining(["aria-pressed"]))
      const off = item("a", { value: ["b"], selectionMode })
      expect(off["aria-pressed"]).toBe("false")
      expect(off["data-state"]).toBe("off")
      for (const p of [on, off]) {
        expect(p["role"]).not.toBe("radio")
        expect(p["aria-checked"]).toBeUndefined()
      }
    }
  })

  it("multiple presses show on each pressed item", () => {
    const v = { value: ["a", "c"], selectionMode: "multiple" } as const
    expect(["a", "b", "c"].map((k) => item(k, v)["aria-pressed"])).toEqual([
      "true",
      "false",
      "true",
    ])
  })

  it("a span gets role button and a tabindex", () => {
    const p = item("a", {}, { tag: "span" })
    expect(p["role"]).toBe("button")
    expect(p["tabindex"]).toBe(0)
  })

  it("roving tabindex: the first item, then the pressed one", () => {
    const keys = ["a", "b", "c"]
    expect(keys.map((k) => item(k)["tabindex"])).toEqual([0, -1, -1])
    expect(keys.map((k) => item(k, { value: ["c"] })["tabindex"])).toEqual([-1, -1, 0])
    const c = collectionOf(["a", true], "b", "c")
    expect(keys.map((k) => item(k, { collection: c })["tabindex"])).toEqual([-1, 0, -1])
  })

  it("roving tabindex: the highlighted item while focus is inside", () => {
    expect(
      ["a", "b", "c"].map((k) => item(k, { value: ["a"], highlightedKey: "b" })["tabindex"]),
    ).toEqual([-1, 0, -1])
  })

  it("pending (server render): the stop the Root computed from the declared items", () => {
    const keys = ["a", "b", "c"]
    expect(keys.map((k) => item(k, { pending: true, pendingStop: "b" })["tabindex"])).toEqual([
      -1, 0, -1,
    ])
    expect(keys.map((k) => item(k, { pending: true, pendingStop: null })["tabindex"])).toEqual([
      -1, -1, -1,
    ])
  })

  it("a disabled group: every item is out of the tab order", () => {
    expect(["a", "b", "c"].map((k) => item(k, { disabled: true })["tabindex"])).toEqual([
      -1, -1, -1,
    ])
  })

  it("data-highlighted, focus, pressed, hover", () => {
    expect(item("b")["data-highlighted"]).toBeUndefined()
    expect(item("b", { highlightedKey: "b" })["data-highlighted"]).toBe("")
    const p = item("b", {}, { focused: true, pressed: true, hovered: true })
    expect(p).toMatchObject({
      "data-focus": "",
      "data-focus-visible": "",
      "data-pressed": "",
      "data-hover": "",
    })
    // Being pressed is not being on.
    expect(p["data-state"]).toBe("off")
    const on = item("b", { value: ["b"] })
    expect(on["data-pressed"]).toBeUndefined()
    expect(on["data-state"]).toBe("on")
  })

  it("data-orientation follows the group", () => {
    expect(item("a", { orientation: "vertical" })["data-orientation"]).toBe("vertical")
  })

  it("data-disabled and a native disabled button (own, group, collection)", () => {
    expect(item("b", {}, { itemDisabled: true })["data-disabled"]).toBe("")
    expect(item("b", { disabled: true })["data-disabled"]).toBe("")
    expect(item("b", { collection: collectionOf("a", ["b", true]) })["data-disabled"]).toBe("")
    expect(item("b")["data-disabled"]).toBeUndefined()
    expect(item("b", {}, { itemDisabled: true })["disabled"]).toBe(true)
  })

  it("focusableWhenDisabled uses aria-disabled instead of disabled", () => {
    const f = item("b", { focusableWhenDisabled: true }, { itemDisabled: true })
    expect(f["disabled"]).toBeUndefined()
    expect(f["aria-disabled"]).toBe("true")
  })

  it("focus sends FOCUS with the key and the current modality", () => {
    const m = make()
    ;(attr(m.c.item("b", state), "onFocus") as () => void)()
    expect(m.send).toHaveBeenCalledWith({ type: "FOCUS", key: "b", modality: "keyboard" })
  })
})
