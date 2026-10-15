// Tabs part props in Node (openspec tabs "Semantics", "Keyboard And Activation",
// "Tab Stop And Focus", "Disabled Tabs", "Panels", "Data Attributes"; selection-indicator).
import { describe, expect, it, vi } from "vitest"
import { createListCollection } from "../../collection/list"
import { CRITICAL } from "../../connect/props"
import { platforms } from "../../dom/platform"
import { type TabsConnectInput, type TabsTabState, tabsConnect } from "./tabs.connect"
import type { TabsEvent } from "./tabs.machine"

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

const base: TabsConnectInput = {
  instance: "t",
  collection: collectionOf("a", "b", "c"),
  value: null,
  highlightedKey: null,
  pending: false,
  orientation: "horizontal",
  activationMode: "automatic",
  inactivePanels: "hidden",
  disabled: false,
  focusableWhenDisabled: false,
  focusWithin: false,
  renderedPanels: new Set(),
  panelTabbable: {},
  direction: "none",
  indicator: null,
  revealed: null,
}
const state: TabsTabState = {
  tag: "button",
  itemDisabled: false,
  focused: false,
  modality: "keyboard",
  pressed: false,
  hovered: false,
}

// Keys are plain strings in these tests; the brand is type-only (toKey is the identity).
type Api = ReturnType<typeof tabsConnect>
type LooseApi = {
  root: Api["root"]
  list: Api["list"]
  tab: (key: string, s: TabsTabState) => ReturnType<Api["tab"]>
  panel: (key: string) => ReturnType<Api["panel"]>
  panelRendered: (key: string) => boolean
  indicator: Api["indicator"]
}
type Over = Partial<Omit<TabsConnectInput, "highlightedKey" | "value">> & {
  highlightedKey?: string | null
  value?: string | null
}

function make(over: Over = {}, dir: "ltr" | "rtl" = "ltr") {
  const send = vi.fn<(e: TabsEvent) => void>()
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
  const input = { ...base, ...over } as TabsConnectInput // brand: see Api above
  return { c: tabsConnect(input, send, env as never) as unknown as LooseApi, send }
}
const attr = (props: object, name: string) => (props as Record<string, unknown>)[name]

describe("root", () => {
  it("scope, orientation, activation direction; no role", () => {
    const p = make().c.root()
    expect(p).toMatchObject({
      "data-scope": "tabs",
      "data-part": "root",
      "data-orientation": "horizontal",
      "data-activation-direction": "none",
    })
    expect(p["role"]).toBeUndefined()
    expect(make({ orientation: "vertical" }).c.root()["data-orientation"]).toBe("vertical")
    expect(make({ direction: "next" }).c.root()["data-activation-direction"]).toBe("next")
    expect(make({ direction: "previous" }).c.root()["data-activation-direction"]).toBe("previous")
  })
})

describe("list", () => {
  it("role tablist, id, scope, direction on the list too", () => {
    const p = make({ direction: "previous" }).c.list()
    expect(p).toMatchObject({
      role: "tablist",
      id: expect.any(String),
      "data-scope": "tabs",
      "data-part": "list",
      "data-orientation": "horizontal",
      "data-activation-direction": "previous",
    })
  })

  it("aria-orientation only when vertical", () => {
    expect(make().c.list()["aria-orientation"]).toBeUndefined()
    expect(make({ orientation: "vertical" }).c.list()["aria-orientation"]).toBe("vertical")
  })

  it("data-focus while a tab has focus, data-disabled when disabled", () => {
    expect(make().c.list()["data-focus"]).toBeUndefined()
    expect(make({ focusWithin: true }).c.list()["data-focus"]).toBe("")
    expect(make().c.list()["data-disabled"]).toBeUndefined()
    expect(make({ disabled: true }).c.list()["data-disabled"]).toBe("")
  })

  it("tabindex 0 only when no tab can be the stop", () => {
    expect(make().c.list()["tabindex"]).toBeUndefined()
    expect(make({ collection: collectionOf() }).c.list()["tabindex"]).toBe(0)
    expect(make({ collection: collectionOf(["a", true], ["b", true]) }).c.list()["tabindex"]).toBe(
      0,
    )
    // Pending (server render): the stop comes from pendingStop, the list is never it.
    expect(make({ pending: true, collection: collectionOf() }).c.list()["tabindex"]).toBeUndefined()
  })

  it("focus leaving the list sends BLUR; focus moving inside does not", () => {
    const m = make()
    const inside = {}
    const list = { contains: (n: unknown) => n === inside }
    const out = attr(m.c.list(), "onFocusOut") as (e: unknown) => void
    out({ currentTarget: list, relatedTarget: inside })
    expect(m.send).not.toHaveBeenCalled()
    out({ currentTarget: list, relatedTarget: null })
    expect(m.send).toHaveBeenCalledWith({ type: "BLUR" })
  })
})

describe("list keydown", () => {
  const target = (part = "tab", instance = "t") =>
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
    ;(attr(m.c.list(), "onKeyDown") as (e: unknown) => void)(e)
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
      { shiftKey: true },
      { isComposing: true },
      { keyCode: 229 },
    ]) {
      expect(press(m, "ArrowRight", over), JSON.stringify(over)).not.toHaveBeenCalled()
    }
    expect(m.send).not.toHaveBeenCalled()
  })

  it("a foreign target or another instance is ignored", () => {
    const m = make()
    expect(press(m, "ArrowRight", {}, target("list"))).not.toHaveBeenCalled()
    expect(press(m, "ArrowRight", {}, target("panel"))).not.toHaveBeenCalled()
    expect(press(m, "ArrowRight", {}, target("tab", "other"))).not.toHaveBeenCalled()
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
})

describe("tab", () => {
  const tab = (key: string, over: Over = {}, s: Partial<TabsTabState> = {}) =>
    make(over).c.tab(key, { ...state, ...s })

  it("native button: role tab, explicit aria-selected (critical) in both states", () => {
    const on = tab("b", { value: "b" })
    expect(on).toMatchObject({
      role: "tab",
      type: "button",
      "aria-selected": "true",
      "data-scope": "tabs",
      "data-part": "tab",
      "data-key": "b",
      "data-selected": "",
      "data-orientation": "horizontal",
      id: expect.any(String),
    })
    expect(on[CRITICAL]).toEqual(expect.arrayContaining(["aria-selected"]))
    const off = tab("a", { value: "b" })
    expect(off["aria-selected"]).toBe("false")
    expect(off["data-selected"]).toBeUndefined()
    expect(tab("a")["aria-selected"]).toBe("false")
  })

  it("a span gets role tab and a tabindex", () => {
    const p = tab("a", {}, { tag: "span" })
    expect(p["role"]).toBe("tab")
    expect(typeof p["tabindex"]).toBe("number")
  })

  it("aria-controls only when the panel key is rendered", () => {
    expect(tab("a", { renderedPanels: new Set(["b"]) })["aria-controls"]).toBeUndefined()
    const p = tab("b", { renderedPanels: new Set(["b"]) })
    const panel = make().c.panel("b")
    expect(p["aria-controls"]).toBe(panel["id"])
    expect(panel["aria-labelledby"]).toBe(p["id"])
  })

  it("roving tabindex: the first tab, then the selected one", () => {
    const keys = ["a", "b", "c"]
    expect(keys.map((k) => tab(k)["tabindex"])).toEqual([0, -1, -1])
    expect(keys.map((k) => tab(k, { value: "c" })["tabindex"])).toEqual([-1, -1, 0])
  })

  it("a disabled selected tab is never the stop (react-spectrum#10633)", () => {
    const collection = collectionOf(["a", true], "b", "c")
    expect(["a", "b", "c"].map((k) => tab(k, { collection, value: "a" })["tabindex"])).toEqual([
      -1, 0, -1,
    ])
  })

  it("the highlighted tab is the stop while focus is inside", () => {
    expect(
      ["a", "b", "c"].map((k) => tab(k, { value: "a", highlightedKey: "b" })["tabindex"]),
    ).toEqual([-1, 0, -1])
  })

  it("pending (server render): the stop the Root computed from the declared tabs", () => {
    const keys = ["a", "b", "c"]
    expect(keys.map((k) => tab(k, { pending: true, pendingStop: "b" })["tabindex"])).toEqual([
      -1, 0, -1,
    ])
    expect(keys.map((k) => tab(k, { pending: true, pendingStop: null })["tabindex"])).toEqual([
      -1, -1, -1,
    ])
  })

  it("data-highlighted, focus, pressed, hover", () => {
    expect(tab("b")["data-highlighted"]).toBeUndefined()
    expect(tab("b", { highlightedKey: "b" })["data-highlighted"]).toBe("")
    const p = tab("b", {}, { focused: true, pressed: true, hovered: true })
    expect(p).toMatchObject({
      "data-focus": "",
      "data-focus-visible": "",
      "data-pressed": "",
      "data-hover": "",
    })
    // Pressed / highlighted is not selected.
    expect(p["aria-selected"]).toBe("false")
    expect(p["data-selected"]).toBeUndefined()
  })

  it("data-disabled and a native disabled button, always with aria-disabled (own, list, collection)", () => {
    for (const p of [
      tab("b", {}, { itemDisabled: true }),
      tab("b", { disabled: true }),
      tab("b", { collection: collectionOf("a", ["b", true]) }),
    ]) {
      expect(p["data-disabled"]).toBe("")
      expect(p["aria-disabled"]).toBe("true")
      expect(p["disabled"]).toBe(true)
    }
    const ok = tab("b")
    expect(ok["data-disabled"]).toBeUndefined()
    expect(ok["aria-disabled"]).toBeUndefined()
    expect(ok["disabled"]).toBeUndefined()
  })

  it("focusableWhenDisabled keeps the tab focusable: aria-disabled, no native disabled", () => {
    const f = tab("b", { focusableWhenDisabled: true }, { itemDisabled: true })
    expect(f["disabled"]).toBeUndefined()
    expect(f["aria-disabled"]).toBe("true")
    expect(f["data-disabled"]).toBe("")
  })

  it("data-orientation follows the list", () => {
    expect(tab("a", { orientation: "vertical" })["data-orientation"]).toBe("vertical")
  })

  it("focus sends FOCUS with the key and the current modality", () => {
    const m = make()
    ;(attr(m.c.tab("b", state), "onFocus") as () => void)()
    expect(m.send).toHaveBeenCalledWith({ type: "FOCUS", key: "b", modality: "keyboard" })
  })
})

describe("panel", () => {
  it("role tabpanel labelled by its tab; selected: visible, tab stop", () => {
    const p = make({ value: "b" }).c.panel("b")
    expect(p).toMatchObject({
      role: "tabpanel",
      "data-scope": "tabs",
      "data-part": "panel",
      "data-key": "b",
      "data-selected": "",
      tabindex: 0,
    })
    expect(p["hidden"]).toBeUndefined()
  })

  it("not selected: hidden, no tabindex, not selected", () => {
    const p = make({ value: "b" }).c.panel("a")
    expect(p["hidden"]).toBe(true)
    expect(p["tabindex"]).toBeUndefined()
    expect(p["data-selected"]).toBeUndefined()
    // No selection (controlled null): every panel hidden.
    expect(make({ value: null }).c.panel("a")["hidden"]).toBe(true)
  })

  it("tabindex 0 only when selected and nothing inside is tabbable", () => {
    expect(
      make({ value: "b", panelTabbable: { b: true } }).c.panel("b")["tabindex"],
    ).toBeUndefined()
    expect(make({ value: "b", panelTabbable: { b: false } }).c.panel("b")["tabindex"]).toBe(0)
    expect(make({ value: "b", panelTabbable: { a: true } }).c.panel("b")["tabindex"]).toBe(0)
  })

  it("data-reveal only on the selected panel that find-in-page revealed", () => {
    expect(make({ value: "b", revealed: "b" }).c.panel("b")["data-reveal"]).toBe("find-in-page")
    expect(make({ value: "b", revealed: "a" }).c.panel("b")["data-reveal"]).toBeUndefined()
    expect(make({ value: "a", revealed: "b" }).c.panel("b")["data-reveal"]).toBeUndefined()
    expect(make({ value: "b" }).c.panel("b")["data-reveal"]).toBeUndefined()
  })

  it("panelRendered: unmount renders only the selected, other modes all", () => {
    const rendered = (inactivePanels: TabsConnectInput["inactivePanels"]) =>
      ["a", "b"].map((k) => make({ value: "b", inactivePanels }).c.panelRendered(k))
    expect(rendered("unmount")).toEqual([false, true])
    expect(rendered("hidden")).toEqual([true, true])
    expect(rendered("until-found")).toEqual([true, true])
  })
})

describe("indicator", () => {
  const box = { left: 10, right: 20, top: 1, bottom: 2, width: 70.5, height: 30 }

  it("hidden with data-state hidden when there is no measure", () => {
    const p = make({ value: "a", indicator: null }).c.indicator()
    expect(p).toMatchObject({
      "aria-hidden": "true",
      hidden: true,
      "data-state": "hidden",
      "data-scope": "tabs",
      "data-part": "indicator",
    })
    expect(p["style"]).toBeUndefined()
    expect(p["data-resizing"]).toBeUndefined()
  })

  it("hidden when nothing is selected, even with a stale measure", () => {
    const p = make({ value: null, indicator: { box, cause: "layout" } }).c.indicator()
    expect(p["hidden"]).toBe(true)
    expect(p["data-state"]).toBe("hidden")
    expect(p["style"]).toBeUndefined()
    expect(p["data-resizing"]).toBeUndefined()
  })

  it("visible: the six custom properties, no data-resizing for a selection change", () => {
    const p = make({ value: "a", indicator: { box, cause: "selection" } }).c.indicator()
    expect(p["hidden"]).toBeUndefined()
    expect(p["data-state"]).toBe("visible")
    expect(p["data-resizing"]).toBeUndefined()
    expect(p["style"]).toEqual({
      "--rind-indicator-left": "10px",
      "--rind-indicator-right": "20px",
      "--rind-indicator-top": "1px",
      "--rind-indicator-bottom": "2px",
      "--rind-indicator-width": "70.5px",
      "--rind-indicator-height": "30px",
    })
  })

  it("data-resizing only for a layout change", () => {
    const p = make({ value: "a", indicator: { box, cause: "layout" } }).c.indicator()
    expect(p["data-resizing"]).toBe("")
    expect(p["data-state"]).toBe("visible")
  })
})
