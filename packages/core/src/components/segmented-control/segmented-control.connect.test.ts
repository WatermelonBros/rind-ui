// Segmented Control part props in Node (openspec segmented-control "Anatomy", "Data
// Attributes", "Roles And Names", "Selection Indicator"): every ARIA and data-* attribute per
// state, and no `radio-group` scope anywhere (ark#2629).
import { describe, expect, it, vi } from "vitest"
import type { CollectionKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { CRITICAL } from "../../connect/props"
import { platforms } from "../../dom/platform"
import type { MeasuredIndicator } from "../../dom/selection-indicator"
import type { RadioGroupEvent } from "../radio-group/radio-group.machine"
import {
  type SegmentedControlConnectInput,
  type SegmentState,
  segmentedControlConnect,
} from "./segmented-control.connect"

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

const base: SegmentedControlConnectInput = {
  instance: "g",
  collection: collectionOf("day", "week", "month"),
  value: null,
  highlightedKey: null,
  highlightSource: null,
  pending: false,
  orientation: "horizontal",
  disabled: false,
  focusableWhenDisabled: false,
  readOnly: false,
  required: false,
  invalid: false,
  name: undefined,
  form: undefined,
  labelRendered: "lbl",
  indicator: null,
}
const seg: SegmentState = {
  tag: "button",
  focused: false,
  modality: "keyboard",
  pressed: false,
  hovered: false,
  itemDisabled: false,
}

type Api = ReturnType<typeof segmentedControlConnect>
// Keys are plain strings in these tests; the brand is type-only (toKey is the identity).
type LooseApi = {
  [K in keyof Api]: Api[K] extends () => unknown
    ? Api[K]
    : Api[K] extends (key: CollectionKey, ...rest: infer R) => infer O
      ? (key: string, ...rest: R) => O
      : Api[K]
}
type Over = Partial<Omit<SegmentedControlConnectInput, "highlightedKey">> & {
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
  const input = { ...base, ...over } as SegmentedControlConnectInput // brand: see Api above
  return { c: segmentedControlConnect(input, send, env as never) as unknown as LooseApi, send }
}
const item = (key: string, over: Over = {}, s: Partial<SegmentState> = {}) =>
  make(over).c.item(key, { ...seg, ...s })
const MEASURED: MeasuredIndicator = {
  box: { left: 1, right: 2, top: 3, bottom: 4, width: 5, height: 6 },
  cause: "selection",
}

describe("scope (ark#2629)", () => {
  it("no part carries the radio-group scope, in any state", () => {
    for (const over of [
      {},
      { value: "week", indicator: MEASURED },
      { disabled: true, readOnly: true, required: true, invalid: true, name: "range" },
    ] as Over[]) {
      const m = make(over)
      const parts = {
        root: m.c.root(),
        label: m.c.label(),
        item: m.c.item("week", seg),
        hidden: m.c.hiddenInput("week", { disabled: false }),
        indicator: m.c.indicator(),
      }
      for (const [name, p] of Object.entries(parts)) {
        expect((p as Record<string, unknown>)["data-scope"], name).toBe("segmented-control")
      }
    }
  })

  it("part names", () => {
    const m = make()
    expect(m.c.root()["data-part"]).toBe("root")
    expect(m.c.label()["data-part"]).toBe("label")
    expect(m.c.item("week", seg)["data-part"]).toBe("item")
    expect(m.c.hiddenInput("week", { disabled: false })["data-part"]).toBe("hidden-input")
    expect(m.c.indicator()["data-part"]).toBe("indicator")
  })
})

describe("root", () => {
  it("radiogroup, horizontal by default, labelled", () => {
    expect(make().c.root()).toMatchObject({
      role: "radiogroup",
      "aria-orientation": "horizontal",
      "data-orientation": "horizontal",
      "aria-labelledby": "lbl",
    })
    expect(make({ orientation: "vertical" }).c.root()).toMatchObject({
      "aria-orientation": "vertical",
      "data-orientation": "vertical",
    })
  })

  it("aria-labelledby only while the Label is rendered", () => {
    expect(make({ labelRendered: undefined }).c.root()["aria-labelledby"]).toBeUndefined()
  })

  it("disabled, read-only, required, invalid", () => {
    expect(
      make({ disabled: true, readOnly: true, required: true, invalid: true }).c.root(),
    ).toMatchObject({
      "aria-disabled": "true",
      "aria-readonly": "true",
      "aria-required": "true",
      "aria-invalid": "true",
      "data-disabled": "",
      "data-readonly": "",
      "data-required": "",
      "data-invalid": "",
    })
    const q = make().c.root()
    for (const a of [
      "aria-disabled",
      "aria-readonly",
      "aria-required",
      "aria-invalid",
      "data-disabled",
      "data-readonly",
      "data-required",
      "data-invalid",
    ]) {
      expect(q[a], a).toBeUndefined()
    }
  })

  it("required alone does not set aria-invalid (react-spectrum#9809)", () => {
    expect(make({ required: true }).c.root()["aria-invalid"]).toBeUndefined()
  })

  it("has no description: aria-describedby is absent", () => {
    expect(make().c.root()["aria-describedby"]).toBeUndefined()
  })
})

describe("label", () => {
  it("has an id matching the root's aria-labelledby wiring", () => {
    const m = make({ labelRendered: undefined })
    expect(typeof m.c.label()["id"]).toBe("string")
    expect(m.c.label()["id"]).not.toBe("")
  })

  it("carries the group's state", () => {
    expect(make({ disabled: true, invalid: true, readOnly: true }).c.label()).toMatchObject({
      "data-disabled": "",
      "data-invalid": "",
      "data-readonly": "",
    })
  })
})

describe("item", () => {
  it("role radio with explicit aria-checked, data-key, state and orientation", () => {
    const on = item("week", { value: "week" })
    expect(on).toMatchObject({
      role: "radio",
      "aria-checked": "true",
      "data-key": "week",
      "data-state": "checked",
      "data-orientation": "horizontal",
      "data-part": "item",
      type: "button",
    })
    expect(typeof on["id"]).toBe("string")
    expect(on[CRITICAL]).toEqual(expect.arrayContaining(["aria-checked", "role"]))
    const off = item("day", { value: "week" })
    expect(off).toMatchObject({ "aria-checked": "false", "data-state": "unchecked" })
    expect(item("day")["aria-checked"]).toBe("false")
  })

  it("has no aria-pressed and no aria-selected (not a toggle button)", () => {
    const p = item("week", { value: "week" })
    expect(p["aria-pressed"]).toBeUndefined()
    expect(p["aria-selected"]).toBeUndefined()
  })

  it("data-orientation follows the root", () => {
    expect(item("day", { orientation: "vertical" })["data-orientation"]).toBe("vertical")
  })

  it("the segment is named by its content: no aria-labelledby or aria-describedby of its own", () => {
    const p = item("week")
    expect(p["aria-labelledby"]).toBeUndefined()
    expect(p["aria-describedby"]).toBeUndefined()
  })

  it("roving tabindex: nothing selected is the first enabled; the selected otherwise", () => {
    const keys = ["day", "week", "month"]
    expect(keys.map((k) => item(k)["tabindex"])).toEqual([0, -1, -1])
    expect(keys.map((k) => item(k, { value: "month" })["tabindex"])).toEqual([-1, -1, 0])
    const c = collectionOf(["day", true], "week", "month")
    expect(keys.map((k) => item(k, { collection: c })["tabindex"])).toEqual([-1, 0, -1])
    expect(keys.map((k) => item(k, { disabled: true })["tabindex"])).toEqual([-1, -1, -1])
  })

  it("data-highlighted marks the highlighted segment only", () => {
    expect(item("week")["data-highlighted"]).toBeUndefined()
    expect(item("week", { highlightedKey: "week" })["data-highlighted"]).toBe("")
    expect(item("day", { highlightedKey: "week" })["data-highlighted"]).toBeUndefined()
  })

  it("focus, pressed and hover", () => {
    expect(item("week", {}, { focused: true, pressed: true, hovered: true })).toMatchObject({
      "data-focus": "",
      "data-focus-visible": "",
      "data-pressed": "",
      "data-hover": "",
    })
    const pointer = item("week", {}, { focused: true, modality: "pointer" })
    expect(pointer["data-focus"]).toBe("")
    expect(pointer["data-focus-visible"]).toBeUndefined()
  })

  it("disabled: own, group and collection; natively disabled, or aria-disabled when focusable", () => {
    expect(item("week", {}, { itemDisabled: true })["data-disabled"]).toBe("")
    expect(item("week", { disabled: true })["data-disabled"]).toBe("")
    expect(item("week", { collection: collectionOf("day", ["week", true]) })["data-disabled"]).toBe(
      "",
    )
    expect(item("week")["data-disabled"]).toBeUndefined()
    expect(item("week", {}, { itemDisabled: true })["disabled"]).toBe(true)
    const f = item("week", { focusableWhenDisabled: true }, { itemDisabled: true })
    expect(f["disabled"]).toBeUndefined()
    expect(f["aria-disabled"]).toBe("true")
  })

  it("read-only and invalid", () => {
    const p = item("week", { readOnly: true, invalid: true })
    expect(p["data-readonly"]).toBe("")
    expect(p["data-invalid"]).toBe("")
    expect(item("week")["data-readonly"]).toBeUndefined()
    expect(item("week")["data-invalid"]).toBeUndefined()
  })

  it("focus sends FOCUS with the key and the modality; focus never selects", () => {
    const m = make()
    ;(m.c.item("week", seg)["onFocus"] as () => void)()
    expect(m.send).toHaveBeenCalledTimes(1)
    expect(m.send).toHaveBeenCalledWith({ type: "FOCUS", key: "week", modality: "keyboard" })
  })
})

describe("hidden input", () => {
  it("a radio, aria-hidden, out of the tab order, named, with its segment's value", () => {
    const p = make({ name: "range" }).c.hiddenInput("week", { disabled: false })
    expect(p).toMatchObject({
      type: "radio",
      name: "range",
      value: "week",
      "aria-hidden": "true",
      tabIndex: -1,
    })
    expect(p["required"]).toBeUndefined()
    expect(p["disabled"]).toBeUndefined()
  })

  it("the default name comes from the instance, shared by every segment", () => {
    const m = make()
    const names = ["day", "week"].map((k) => m.c.hiddenInput(k, { disabled: false })["name"])
    expect(names[0]).toBe(names[1])
    expect(names[0]).toBeTruthy()
  })

  it("form, required and disabled (own, group, collection)", () => {
    const own = { disabled: false }
    expect(make({ form: "f1" }).c.hiddenInput("week", own)["form"]).toBe("f1")
    expect(make({ required: true }).c.hiddenInput("week", own)["required"]).toBe(true)
    expect(make().c.hiddenInput("week", { disabled: true })["disabled"]).toBe(true)
    expect(make({ disabled: true }).c.hiddenInput("week", own)["disabled"]).toBe(true)
    expect(
      make({ collection: collectionOf("day", ["week", true]) }).c.hiddenInput("week", own)[
        "disabled"
      ],
    ).toBe(true)
  })
})

describe("indicator", () => {
  const vars = [
    "--rind-indicator-left",
    "--rind-indicator-right",
    "--rind-indicator-top",
    "--rind-indicator-bottom",
    "--rind-indicator-width",
    "--rind-indicator-height",
  ]

  it("hidden, decorative and without properties while nothing is selected", () => {
    const p = make({ value: null, indicator: MEASURED }).c.indicator()
    expect(p).toMatchObject({ "aria-hidden": "true", hidden: true, "data-state": "hidden" })
    expect(p["style"]).toBeUndefined()
    expect(p["data-resizing"]).toBeUndefined()
  })

  it("hidden until measured, even with a selection", () => {
    const p = make({ value: "week", indicator: null }).c.indicator()
    expect(p).toMatchObject({ hidden: true, "data-state": "hidden" })
    expect(p["style"]).toBeUndefined()
  })

  it("measured: visible with the six custom properties and the orientation", () => {
    const p = make({ value: "week", indicator: MEASURED }).c.indicator()
    expect(p).toMatchObject({
      "aria-hidden": "true",
      "data-state": "visible",
      "data-orientation": "horizontal",
      "data-scope": "segmented-control",
      "data-part": "indicator",
    })
    expect(p["hidden"]).toBeUndefined()
    expect(p["style"]).toEqual({
      "--rind-indicator-left": "1px",
      "--rind-indicator-right": "2px",
      "--rind-indicator-top": "3px",
      "--rind-indicator-bottom": "4px",
      "--rind-indicator-width": "5px",
      "--rind-indicator-height": "6px",
    })
    expect(Object.keys(p["style"] as object)).toEqual(vars)
  })

  it("data-resizing only for a layout move, not for a selection change", () => {
    const at = (cause: "selection" | "layout") =>
      make({ value: "week", indicator: { box: MEASURED.box, cause } }).c.indicator()
    expect(at("layout")["data-resizing"]).toBe("")
    expect(at("selection")["data-resizing"]).toBeUndefined()
  })

  it("follows the orientation", () => {
    const p = make({
      value: "week",
      orientation: "vertical",
      indicator: MEASURED,
    }).c.indicator()
    expect(p["data-orientation"]).toBe("vertical")
  })
})
