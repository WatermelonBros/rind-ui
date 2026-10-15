// Radio Group part props in Node (openspec radio-group "Anatomy", "Keyboard And Activation",
// "Tab Stop And Focus", "Disabled, Read-Only, Required And Invalid", "Roles And Names",
// "Form Participation", "Data Attributes").
import { describe, expect, it, vi } from "vitest"
import type { CollectionKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { CRITICAL } from "../../connect/props"
import { platforms } from "../../dom/platform"
import {
  type RadioGroupConnectInput,
  type RadioItemState,
  radioGroupConnect,
} from "./radio-group.connect"
import type { RadioGroupEvent } from "./radio-group.machine"

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

const base: RadioGroupConnectInput = {
  instance: "g",
  collection: collectionOf("s", "m", "l"),
  value: null,
  highlightedKey: null,
  highlightSource: null,
  pending: false,
  orientation: "vertical",
  disabled: false,
  focusableWhenDisabled: false,
  readOnly: false,
  required: false,
  invalid: false,
  name: undefined,
  form: undefined,
  rendered: { label: "lbl", description: "desc", errorMessage: "err" },
}
const state: RadioItemState = {
  tag: "button",
  focused: false,
  modality: "keyboard",
  pressed: false,
  hovered: false,
  itemDisabled: false,
  labelable: true,
  labelRendered: true,
  descriptionRendered: true,
}
const own = { disabled: false }

// Keys are plain strings in these tests; the brand is type-only (toKey is the identity).
type Api = ReturnType<typeof radioGroupConnect>
type LooseApi = {
  [K in keyof Api]: Api[K] extends () => unknown
    ? Api[K]
    : Api[K] extends (key: CollectionKey, ...rest: infer R) => infer O
      ? (key: string, ...rest: R) => O
      : Api[K]
}
type Over = Partial<Omit<RadioGroupConnectInput, "highlightedKey">> & {
  highlightedKey?: string | null
}

function make(over: Over = {}, dir: "ltr" | "rtl" = "ltr") {
  const send = vi.fn<(e: RadioGroupEvent) => void>()
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
  const input = { ...base, ...over } as RadioGroupConnectInput // brand: see Api above
  return { c: radioGroupConnect(input, send, env as never) as unknown as LooseApi, send }
}
const attr = (props: object, name: string) => (props as Record<string, unknown>)[name]

describe("root", () => {
  it("role, orientation and scope", () => {
    const p = make().c.root()
    expect(p).toMatchObject({
      role: "radiogroup",
      "aria-orientation": "vertical",
      "data-scope": "radio-group",
      "data-part": "root",
      "data-orientation": "vertical",
    })
    expect(make({ orientation: "horizontal" }).c.root()).toMatchObject({
      "aria-orientation": "horizontal",
      "data-orientation": "horizontal",
    })
  })

  it("aria-labelledby only while the Label is rendered", () => {
    expect(make().c.root()["aria-labelledby"]).toBe("lbl")
    expect(make({ rendered: {} }).c.root()["aria-labelledby"]).toBeUndefined()
  })

  it("aria-describedby: the Description, plus the error message only when invalid", () => {
    expect(make().c.root()["aria-describedby"]).toBe("desc")
    expect(make({ invalid: true }).c.root()["aria-describedby"]).toBe("desc err")
    expect(make({ rendered: { errorMessage: "err" } }).c.root()["aria-describedby"]).toBeUndefined()
    expect(make({ rendered: {} }).c.root()["aria-describedby"]).toBeUndefined()
  })

  it("required, invalid, read-only, disabled", () => {
    const p = make({ required: true, invalid: true, readOnly: true, disabled: true }).c.root()
    expect(p).toMatchObject({
      "aria-required": "true",
      "aria-invalid": "true",
      "aria-readonly": "true",
      "aria-disabled": "true",
      "data-required": "",
      "data-invalid": "",
      "data-readonly": "",
      "data-disabled": "",
    })
    const q = make().c.root()
    for (const a of [
      "aria-required",
      "aria-invalid",
      "aria-readonly",
      "aria-disabled",
      "data-required",
      "data-invalid",
      "data-readonly",
      "data-disabled",
    ]) {
      expect(q[a], a).toBeUndefined()
    }
  })

  it("required alone does not set aria-invalid (react-spectrum#9809)", () => {
    expect(make({ required: true }).c.root()["aria-invalid"]).toBeUndefined()
  })

  it("no tabindex while a radio can be the stop", () => {
    expect(make().c.root()["tabindex"]).toBeUndefined()
    expect(make({ value: "m" }).c.root()["tabindex"]).toBeUndefined()
  })

  it("tabindex 0 only when no radio is enabled", () => {
    const all = collectionOf(["s", true], ["m", true])
    expect(make({ collection: all }).c.root()["tabindex"]).toBe(0)
  })

  it("a disabled group is not a stop; with focusableWhenDisabled the root is", () => {
    expect(make({ disabled: true }).c.root()["tabindex"]).toBeUndefined()
    const p = make({ disabled: true, focusableWhenDisabled: true }).c.root()
    expect(p["tabindex"]).toBe(0)
    expect(p["aria-disabled"]).toBe("true")
  })

  it("no tabindex before the items register (server render)", () => {
    expect(make({ pending: true }).c.root()["tabindex"]).toBeUndefined()
  })

  it("the Field's ids come first", () => {
    const p = make({
      invalid: true,
      field: { label: "fl", description: "fd", error: "fe" },
    }).c.root()
    expect(p["aria-labelledby"]).toBe("fl")
    expect(p["aria-describedby"]).toBe("fd fe desc err")
  })
})

describe("root keydown", () => {
  const target = (part = "item-control", instance = "g") =>
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

  it("all four arrows navigate, whatever the orientation", () => {
    for (const orientation of ["vertical", "horizontal"] as const) {
      const m = make({ orientation })
      for (const [key, move] of [
        ["ArrowDown", "next"],
        ["ArrowRight", "next"],
        ["ArrowUp", "previous"],
        ["ArrowLeft", "previous"],
      ] as const) {
        m.send.mockClear()
        const prevent = press(m, key)
        expect(m.send, `${orientation} ${key}`).toHaveBeenCalledWith({ type: "NAVIGATE", move })
        expect(prevent).toHaveBeenCalled()
      }
    }
  })

  it("RTL mirrors ArrowLeft and ArrowRight, not ArrowUp and ArrowDown", () => {
    const m = make({}, "rtl")
    press(m, "ArrowLeft")
    expect(m.send).toHaveBeenLastCalledWith({ type: "NAVIGATE", move: "next" })
    press(m, "ArrowRight")
    expect(m.send).toHaveBeenLastCalledWith({ type: "NAVIGATE", move: "previous" })
    press(m, "ArrowDown")
    expect(m.send).toHaveBeenLastCalledWith({ type: "NAVIGATE", move: "next" })
    press(m, "ArrowUp")
    expect(m.send).toHaveBeenLastCalledWith({ type: "NAVIGATE", move: "previous" })
  })

  it("modified and composing arrows do nothing and are not prevented", () => {
    const m = make()
    for (const over of [
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
      { isComposing: true },
      { keyCode: 229 },
    ]) {
      const prevent = press(m, "ArrowDown", over)
      expect(prevent, JSON.stringify(over)).not.toHaveBeenCalled()
    }
    expect(m.send).not.toHaveBeenCalled()
  })

  it("a key whose target is not an item control of this instance is ignored", () => {
    const m = make()
    expect(press(m, "ArrowDown", {}, target("item-label"))).not.toHaveBeenCalled()
    expect(press(m, "ArrowDown", {}, target("item-control", "other"))).not.toHaveBeenCalled()
    expect(press(m, "ArrowDown", {}, null as never)).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })

  it("Home, End, letters, Space and Enter do nothing", () => {
    const m = make()
    for (const key of ["Home", "End", "a", "1", " ", "Enter", "PageDown", "Tab"]) {
      expect(press(m, key), key).not.toHaveBeenCalled()
    }
    expect(m.send).not.toHaveBeenCalled()
  })

  it("an inert (disabled, not focusable) group does nothing", () => {
    const m = make({ disabled: true })
    expect(press(m, "ArrowDown")).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
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

describe("item control", () => {
  const control = (key: string, over: Over = {}, s = {}) =>
    make(over).c.itemControl(key, { ...state, ...s })

  it("role radio, explicit aria-checked, scope and ids", () => {
    const p = control("m", { value: "m" })
    expect(p).toMatchObject({
      role: "radio",
      "aria-checked": "true",
      "data-scope": "radio-group",
      "data-part": "item-control",
      "data-key": "m",
      "data-state": "checked",
      type: "button",
    })
    expect(typeof p["id"]).toBe("string")
    expect(control("s", { value: "m" })["aria-checked"]).toBe("false")
    expect(control("s")["aria-checked"]).toBe("false")
    expect(p[CRITICAL]).toEqual(expect.arrayContaining(["aria-checked", "role"]))
  })

  it("roving tabindex: nothing checked, the first enabled radio", () => {
    expect(["s", "m", "l"].map((k) => control(k)["tabindex"])).toEqual([0, -1, -1])
    const c = collectionOf(["s", true], "m", "l")
    expect(["s", "m", "l"].map((k) => control(k, { collection: c })["tabindex"])).toEqual([
      -1, 0, -1,
    ])
  })

  it("roving tabindex: the checked radio", () => {
    expect(["s", "m", "l"].map((k) => control(k, { value: "l" })["tabindex"])).toEqual([-1, -1, 0])
  })

  it("roving tabindex: a disabled checked radio falls back to the first enabled one", () => {
    const c = collectionOf("s", "m", ["l", true])
    expect(
      ["s", "m", "l"].map((k) => control(k, { collection: c, value: "l" })["tabindex"]),
    ).toEqual([0, -1, -1])
  })

  it("roving tabindex: the highlighted radio while focus is inside", () => {
    const keys = ["s", "m", "l"]
    expect(keys.map((k) => control(k, { value: "s", highlightedKey: "m" })["tabindex"])).toEqual([
      -1, 0, -1,
    ])
  })

  it("pending (server render): the item of the value, else none above the root", () => {
    const keys = ["s", "m", "l"]
    expect(keys.map((k) => control(k, { pending: true, value: "m" })["tabindex"])).toEqual([
      -1, 0, -1,
    ])
  })

  it("a disabled group: every control is out of the tab order", () => {
    const keys = ["s", "m", "l"]
    expect(keys.map((k) => control(k, { disabled: true, value: "m" })["tabindex"])).toEqual([
      -1, -1, -1,
    ])
  })

  it("aria-labelledby only for a non-labelable control with a rendered label", () => {
    expect(control("m")["aria-labelledby"]).toBeUndefined()
    const span = control("m", {}, { tag: "span", labelable: false })
    expect(span["aria-labelledby"]).toMatch(/item-label/)
    expect(
      control("m", {}, { tag: "span", labelable: false, labelRendered: false })["aria-labelledby"],
    ).toBeUndefined()
  })

  it("aria-describedby only while the item description is rendered", () => {
    expect(control("m")["aria-describedby"]).toMatch(/item-description/)
    expect(control("m", {}, { descriptionRendered: false })["aria-describedby"]).toBeUndefined()
  })

  it("data-highlighted, focus, pressed, hover", () => {
    expect(control("m")["data-highlighted"]).toBeUndefined()
    expect(control("m", { highlightedKey: "m" })["data-highlighted"]).toBe("")
    const p = control("m", {}, { focused: true, pressed: true, hovered: true })
    expect(p).toMatchObject({
      "data-focus": "",
      "data-focus-visible": "",
      "data-pressed": "",
      "data-hover": "",
    })
    const pointer = control("m", {}, { focused: true, modality: "pointer" })
    expect(pointer["data-focus"]).toBe("")
    expect(pointer["data-focus-visible"]).toBeUndefined()
  })

  it("data-disabled and a disabled control (own, group, collection) -- zag#2675 siblings", () => {
    expect(control("m", {}, { itemDisabled: true })["data-disabled"]).toBe("")
    expect(control("m", { disabled: true })["data-disabled"]).toBe("")
    expect(control("m", { collection: collectionOf("s", ["m", true]) })["data-disabled"]).toBe("")
    expect(control("m")["data-disabled"]).toBeUndefined()
  })

  it("a disabled control is natively disabled; focusableWhenDisabled uses aria-disabled", () => {
    const p = control("m", {}, { itemDisabled: true })
    expect(p["disabled"]).toBe(true)
    const f = control("m", { focusableWhenDisabled: true }, { itemDisabled: true })
    expect(f["disabled"]).toBeUndefined()
    expect(f["aria-disabled"]).toBe("true")
  })

  it("data-readonly and data-invalid", () => {
    const p = control("m", { readOnly: true, invalid: true })
    expect(p["data-readonly"]).toBe("")
    expect(p["data-invalid"]).toBe("")
  })

  it("focus sends FOCUS with the key and the current modality", () => {
    const m = make()
    const p = m.c.itemControl("m", state)
    ;(attr(p, "onFocus") as () => void)()
    expect(m.send).toHaveBeenCalledWith({ type: "FOCUS", key: "m", modality: "keyboard" })
  })
})

describe("item, label, description, indicator", () => {
  it("item: scope and state", () => {
    const p = make({ value: "m", readOnly: true, invalid: true }).c.item("m", own)
    expect(p).toMatchObject({
      "data-scope": "radio-group",
      "data-part": "item",
      "data-key": "m",
      "data-state": "checked",
      "data-readonly": "",
      "data-invalid": "",
    })
    expect(make().c.item("m", own)["data-state"]).toBe("unchecked")
    expect(make().c.item("m", { disabled: true })["data-disabled"]).toBe("")
  })

  it("item label: htmlFor the control only when it is labelable", () => {
    const m = make()
    const yes = m.c.itemLabel("m", { disabled: false, labelable: true })
    expect(yes["htmlFor"]).toBe(m.c.itemControl("m", state)["id"])
    expect(m.c.itemLabel("m", { disabled: false, labelable: false })["htmlFor"]).toBeUndefined()
    expect(yes).toMatchObject({ "data-part": "item-label", "data-state": "unchecked" })
  })

  it("item description", () => {
    const p = make({ value: "m" }).c.itemDescription("m", own)
    expect(p).toMatchObject({ "data-part": "item-description", "data-state": "checked" })
    expect(typeof p["id"]).toBe("string")
  })

  it("item indicator is decorative", () => {
    const p = make({ value: "m" }).c.itemIndicator("m", own)
    expect(p).toMatchObject({
      "aria-hidden": "true",
      "data-part": "item-indicator",
      "data-state": "checked",
    })
  })

  it("label, description and error message carry the group's state", () => {
    const m = make({ disabled: true, invalid: true, readOnly: true })
    for (const p of [m.c.label(), m.c.description(), m.c.errorMessage()]) {
      expect(p).toMatchObject({ "data-disabled": "", "data-invalid": "", "data-readonly": "" })
    }
    expect(m.c.label()["data-part"]).toBe("label")
    expect(m.c.errorMessage()["data-part"]).toBe("error-message")
  })
})

describe("hidden input", () => {
  it("a radio, aria-hidden, out of the tab order, its item's value", () => {
    const p = make({ name: "size" }).c.hiddenInput("m", own)
    expect(p).toMatchObject({
      type: "radio",
      name: "size",
      value: "m",
      "aria-hidden": "true",
      tabIndex: -1,
      "data-part": "hidden-input",
    })
    expect(p["required"]).toBeUndefined()
    expect(p["disabled"]).toBeUndefined()
  })

  it("the default name comes from the root id, shared by every item", () => {
    const a = make().c.hiddenInput("s", own)["name"]
    const b = make().c.hiddenInput("m", own)["name"]
    expect(a).toBe(b)
    expect(a).toMatch(/g/)
    expect(make({ instance: "other" }).c.hiddenInput("s", own)["name"]).not.toBe(a)
  })

  it("form, required and disabled (own, group, collection)", () => {
    expect(make({ form: "f1" }).c.hiddenInput("m", own)["form"]).toBe("f1")
    expect(make({ required: true }).c.hiddenInput("m", own)["required"]).toBe(true)
    expect(make().c.hiddenInput("m", { disabled: true })["disabled"]).toBe(true)
    expect(make({ disabled: true }).c.hiddenInput("m", own)["disabled"]).toBe(true)
    expect(
      make({ collection: collectionOf("s", ["m", true]) }).c.hiddenInput("m", own)["disabled"],
    ).toBe(true)
  })

  it("each item has its own id", () => {
    const m = make()
    expect(new Set(["s", "m", "l"].map((k) => m.c.hiddenInput(k, own)["id"])).size).toBe(3)
  })
})
