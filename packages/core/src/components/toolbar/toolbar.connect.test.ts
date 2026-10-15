// Toolbar part props in Node (openspec add-toolbar "Roles And Naming", "One Tab Stop",
// "Disabled Controls", "Data Attributes", "Key Ownership" wiring).
import { describe, expect, it, vi } from "vitest"
import type { CollectionKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { type ToolbarConnectInput, toolbarConnect, toolbarIds } from "./toolbar.connect"
import type { ToolbarEvent } from "./toolbar.machine"

interface Item {
  readonly id: string
  readonly skip?: boolean
}
const collectionOf = (...spec: (string | [string, boolean])[]) =>
  createListCollection<Item>({
    items: spec.map((s) => (typeof s === "string" ? { id: s } : { id: s[0], skip: s[1] })),
    getKey: (i) => i.id,
    getText: (i) => i.id,
    isDisabled: (i) => i.skip === true,
  })
const key = (k: string) => k as CollectionKey // keys are plain strings; the brand is type-only

const base: ToolbarConnectInput = {
  instance: "t",
  collection: collectionOf("a", "b", "c"),
  highlightedKey: null,
  focusWithin: false,
  pending: false,
  orientation: "horizontal",
  disabled: false,
  focusableWhenDisabled: false,
}
const env = {
  platform: platforms.linux,
  locale: { dir: () => "ltr" as "ltr" | "rtl" },
  modality: { modality: () => "keyboard" as const },
}
function make(over: Partial<ToolbarConnectInput> = {}, e = env) {
  const send = vi.fn<(event: ToolbarEvent) => void>()
  return { api: toolbarConnect({ ...base, ...over }, send, e as never), send }
}
const ctl = (id: string, over: Partial<{ disabled: boolean; first: boolean }> = {}) => ({
  id,
  disabled: false,
  first: false,
  ...over,
})

describe("root", () => {
  it("role toolbar, scope attributes, id, orientation", () => {
    const p = make().api.root()
    expect(p).toMatchObject({
      role: "toolbar",
      "data-scope": "toolbar",
      "data-part": "root",
      "data-instance": "t",
      "data-orientation": "horizontal",
      id: toolbarIds("t").list,
    })
  })
  it("aria-orientation only when vertical", () => {
    expect(make().api.root()["aria-orientation"]).toBeUndefined()
    const v = make({ orientation: "vertical" }).api.root()
    expect(v["aria-orientation"]).toBe("vertical")
    expect(v["data-orientation"]).toBe("vertical")
  })
  it("data-disabled only when disabled", () => {
    expect(make().api.root()["data-disabled"]).toBeUndefined()
    expect(make({ disabled: true }).api.root()["data-disabled"]).toBe("")
  })
  it("the root is never a tab stop", () => {
    expect(make().api.root()).not.toHaveProperty("tabindex")
  })
})

describe("controls: tab stop", () => {
  it("first control is the stop before any focus; the others are -1", () => {
    const { api } = make()
    expect(api.control(ctl("a"))["tabindex"]).toBe(0)
    expect(api.control(ctl("b"))["tabindex"]).toBe(-1)
    expect(api.control(ctl("c"))["tabindex"]).toBe(-1)
  })
  it("the remembered (highlighted) control is the stop", () => {
    const { api } = make({ highlightedKey: key("b") })
    expect(api.control(ctl("a"))["tabindex"]).toBe(-1)
    expect(api.control(ctl("b"))["tabindex"]).toBe(0)
  })
  it("skipped controls are never the stop: the first navigable one is", () => {
    const { api } = make({ collection: collectionOf(["a", true], "b", "c") })
    expect(api.control(ctl("a", { disabled: true }))["tabindex"]).toBe(-1)
    expect(api.control(ctl("b"))["tabindex"]).toBe(0)
  })
  it("a highlighted control that was skipped falls back to the first navigable", () => {
    const { api } = make({ collection: collectionOf("a", ["b", true]), highlightedKey: key("b") })
    expect(api.control(ctl("a"))["tabindex"]).toBe(0)
  })
  it("pending (server, first paint): only the first rendered control is 0", () => {
    const { api } = make({ pending: true, collection: collectionOf() })
    expect(api.control(ctl("a", { first: true }))["tabindex"]).toBe(0)
    expect(api.control(ctl("b"))["tabindex"]).toBe(-1)
  })
  it("exactly one stop over all controls", () => {
    const { api } = make({ highlightedKey: key("c") })
    const stops = ["a", "b", "c"].filter((id) => api.control(ctl(id))["tabindex"] === 0)
    expect(stops).toEqual(["c"])
  })
})

describe("controls: attributes", () => {
  it("every control (own or hosted) is data-host=toolbar with the orientation", () => {
    const p = make({ orientation: "vertical" }).api.control(ctl("a"))
    expect(p["data-host"]).toBe("toolbar")
    expect(p["data-orientation"]).toBe("vertical")
  })
  it("data-disabled follows the control's state", () => {
    const { api } = make()
    expect(api.control(ctl("a"))["data-disabled"]).toBeUndefined()
    expect(api.control(ctl("a", { disabled: true }))["data-disabled"]).toBe("")
  })
  it("data-highlighted only on the highlighted control while focus is inside", () => {
    const inside = make({ highlightedKey: key("b"), focusWithin: true }).api
    expect(inside.control(ctl("b"))["data-highlighted"]).toBe("")
    expect(inside.control(ctl("a"))["data-highlighted"]).toBeUndefined()
    const outside = make({ highlightedKey: key("b"), focusWithin: false }).api
    expect(outside.control(ctl("b"))["data-highlighted"]).toBeUndefined()
  })
  it("onFocus sends FOCUS with the key and the current modality", () => {
    const { api, send } = make()
    ;(api.control(ctl("b"))["onFocus"] as () => void)()
    expect(send).toHaveBeenCalledWith({ type: "FOCUS", key: "b", modality: "keyboard" })
  })
  it("part() carries the scope attributes and data-key, per part", () => {
    const { api } = make()
    for (const part of ["button", "link", "item"] as const) {
      expect(api.part(part, "x")).toEqual({
        "data-scope": "toolbar",
        "data-part": part,
        "data-instance": "t",
        "data-key": "x",
      })
    }
  })
})

describe("group", () => {
  it("role group, scope attributes, orientation", () => {
    expect(make().api.group(false)).toMatchObject({
      role: "group",
      "data-scope": "toolbar",
      "data-part": "group",
      "data-orientation": "horizontal",
    })
  })
  it("data-disabled only when disabled", () => {
    expect(make().api.group(false)["data-disabled"]).toBeUndefined()
    expect(make().api.group(true)["data-disabled"]).toBe("")
  })
})

describe("separator", () => {
  it("is perpendicular to the toolbar by default", () => {
    const h = make().api.separator({ tag: "div" })
    expect(h["data-orientation"]).toBe("vertical")
    expect(h["aria-orientation"]).toBe("vertical")
    expect(h["role"]).toBe("separator")
    const v = make({ orientation: "vertical" }).api.separator({ tag: "div" })
    expect(v["data-orientation"]).toBe("horizontal")
    expect(v["aria-orientation"]).toBeUndefined()
  })
  it("an explicit orientation wins", () => {
    const p = make().api.separator({ tag: "div", orientation: "horizontal" })
    expect(p["data-orientation"]).toBe("horizontal")
    expect(make().api.separator({ tag: "div", orientation: "vertical" })["data-orientation"]).toBe(
      "vertical",
    )
  })
  it("data-part separator in scope toolbar", () => {
    expect(make().api.separator({ tag: "div" })).toMatchObject({
      "data-scope": "toolbar",
      "data-part": "separator",
      "data-instance": "t",
    })
  })
  it("<hr> keeps its implicit role", () => {
    expect(make().api.separator({ tag: "hr" })["role"]).toBeUndefined()
  })
})

describe("keydown wiring (Key Ownership)", () => {
  const target = (id: string, extra: Record<string, unknown> = {}) =>
    ({
      id,
      tagName: "BUTTON",
      getAttribute: () => null,
      isContentEditable: false,
      ...extra,
    }) as never
  const keydown = (k: string, tgt: unknown, init: Record<string, unknown> = {}) => {
    const preventDefault = vi.fn()
    const e = {
      key: k,
      code: k,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      repeat: false,
      isComposing: false,
      defaultPrevented: false,
      target: tgt,
      preventDefault,
      ...init,
    }
    return { e, preventDefault }
  }
  const run = (over: Partial<ToolbarConnectInput>, k: string, tgt: unknown, init = {}) => {
    const { api, send } = make(over)
    const { e, preventDefault } = keydown(k, tgt, init)
    ;(api.root()["onKeyDown"] as (e: unknown) => void)(e)
    return { send, preventDefault }
  }
  it("an own control: NAVIGATE and preventDefault", () => {
    const r = run({}, "ArrowRight", target("a"))
    expect(r.send).toHaveBeenCalledWith({ type: "NAVIGATE", move: "next" })
    expect(r.preventDefault).toHaveBeenCalled()
  })
  it("rtl mirrors", () => {
    const rtl = { ...env, locale: { dir: () => "rtl" as const } }
    const { api, send } = make({}, rtl)
    ;(api.root()["onKeyDown"] as (e: unknown) => void)(keydown("ArrowLeft", target("a")).e)
    expect(send).toHaveBeenCalledWith({ type: "NAVIGATE", move: "next" })
  })
  it("a target that is not a registered control (popup, portal) is ignored", () => {
    const r = run({}, "ArrowRight", target("menu-item-1"))
    expect(r.send).not.toHaveBeenCalled()
    expect(r.preventDefault).not.toHaveBeenCalled()
  })
  it("a target without an id is ignored", () => {
    expect(run({}, "ArrowRight", target("")).send).not.toHaveBeenCalled()
    expect(run({}, "ArrowRight", null).send).not.toHaveBeenCalled()
  })
  it("a perpendicular arrow and Enter are left alone", () => {
    expect(run({}, "ArrowDown", target("a")).send).not.toHaveBeenCalled()
    expect(run({}, "Enter", target("a")).send).not.toHaveBeenCalled()
  })
  it("a control that called preventDefault keeps the key", () => {
    const r = run({}, "ArrowRight", target("a"), { defaultPrevented: true })
    expect(r.send).not.toHaveBeenCalled()
  })
  it("Alt+Arrow is left alone", () => {
    expect(run({}, "ArrowRight", target("a"), { altKey: true }).send).not.toHaveBeenCalled()
  })
  it("a text field mid-text keeps its arrows; at the end it hands over", () => {
    const input = (pos: number) =>
      target("a", { tagName: "INPUT", value: "hello", selectionStart: pos, selectionEnd: pos })
    expect(run({}, "ArrowRight", input(2)).send).not.toHaveBeenCalled()
    expect(run({}, "ArrowRight", input(5)).send).toHaveBeenCalledWith({
      type: "NAVIGATE",
      move: "next",
    })
  })
  it("Home in a text field is the field's", () => {
    const input = target("a", { tagName: "INPUT", value: "hi", selectionStart: 0, selectionEnd: 0 })
    expect(run({}, "Home", input).send).not.toHaveBeenCalled()
  })
})

describe("focus out", () => {
  const out = (related: unknown) => {
    const { api, send } = make()
    const root = { contains: (n: unknown) => n === inside }
    const inside = {}
    ;(api.root()["onFocusOut"] as (e: unknown) => void)({
      currentTarget: root,
      relatedTarget: related === "inside" ? inside : related,
    })
    return send
  }
  it("BLUR when focus leaves the toolbar (or goes nowhere)", () => {
    expect(out({})).toHaveBeenCalledWith({ type: "BLUR" })
    expect(out(null)).toHaveBeenCalledWith({ type: "BLUR" })
  })
  it("no BLUR while focus moves between controls", () => {
    expect(out("inside")).not.toHaveBeenCalled()
  })
})
