// Number Input connect in Node: the insertion plan per locale, the key mapping, inputMode,
// the spinbutton attributes and the triggers.
import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { createNumberParser } from "../../i18n/number-parser"
import { mergeFieldProps } from "../shared/field-control"
import {
  inputModeOf,
  type NumberInputConnectInput,
  numberInputConnect,
  numberInputKey,
  planInsertion,
} from "./number-input.connect"
import { numberInputMessages } from "./number-input.messages"

const env = { router: undefined, origin: () => undefined } as never
const ins = (text: string, at: number, data: string, end = at) => ({
  text,
  selectionStart: at,
  selectionEnd: end,
  data,
  inputType: "insertText",
})
const key = (
  k: string,
  mods: Partial<Record<"shift" | "alt" | "ctrl" | "meta" | "composing", boolean>> = {},
) => ({
  key: k,
  code: "",
  shift: false,
  alt: false,
  ctrl: false,
  meta: false,
  repeat: false,
  composing: false,
  ...mods,
})

function input(over: Partial<NumberInputConnectInput> = {}): NumberInputConnectInput {
  return {
    instance: "n",
    value: 5,
    text: "5",
    defaultValue: null,
    focused: false,
    modality: "keyboard",
    composing: false,
    spinning: false,
    field: mergeFieldProps({ role: "spinbutton", labelable: true }, null),
    ids: { input: "in", increment: "inc", decrement: "dec", hiddenInput: "hid" },
    labelId: "lab",
    canIncrement: true,
    canDecrement: true,
    pressed: { increment: false, decrement: false },
    parser: createNumberParser("en-US"),
    messages: numberInputMessages,
    plainTextbox: false,
    inputMode: "decimal",
    ...over,
  }
}

describe("planInsertion", () => {
  const en = createNumberParser("en-US")
  it("accepts partial numbers and rejects letters; deletions always pass", () => {
    expect(planInsertion(ins("12", 2, "3"), en, { allowNegative: true }).kind).toBe("accept")
    expect(planInsertion(ins("12", 2, "a"), en, { allowNegative: true }).kind).toBe("reject")
    expect(
      planInsertion({ ...ins("1a", 2, ""), data: null, inputType: "deleteContentBackward" }, en, {
        allowNegative: true,
      }).kind,
    ).toBe("accept")
    expect(
      planInsertion({ ...ins("x", 1, ""), data: null, inputType: "historyUndo" }, en, {
        allowNegative: true,
      }).kind,
    ).toBe("accept")
  })

  it("Caret stays while editing (zag#2712): an insertion in the middle is just accepted", () => {
    expect(planInsertion(ins("1,234", 3, "5"), en, { allowNegative: true }).kind).toBe("accept")
  })

  it("rejects a minus when negatives are not allowed", () => {
    expect(planInsertion(ins("", 0, "-"), en, { allowNegative: false }).kind).toBe("reject")
    expect(planInsertion(ins("", 0, "-"), en, { allowNegative: true }).kind).toBe("accept")
  })

  it("Italian iPhone, English field: the keypad comma becomes the field's decimal", () => {
    expect(
      planInsertion(ins("1", 1, ","), en, { allowNegative: true, keypadLocale: "it-IT" }),
    ).toEqual({
      kind: "replace",
      text: "1.",
      caret: 2,
    })
  })

  it("German currency and Arabic digits", () => {
    const de = createNumberParser("de-DE", { style: "currency", currency: "EUR" })
    expect(planInsertion(ins("1.234", 5, ","), de, { allowNegative: true }).kind).toBe("accept")
    const ar = createNumberParser("ar-EG")
    expect(planInsertion(ins("١", 1, "٢"), ar, { allowNegative: true }).kind).toBe("accept")
  })
})

describe("numberInputKey", () => {
  it("maps arrows, Shift, pages; Home/End only with that bound; Enter commits", () => {
    const o = { hasMin: false, hasMax: true }
    expect(numberInputKey(key("ArrowUp"), o)).toEqual({
      type: "INCREASE",
      large: false,
      modality: "keyboard",
    })
    expect(numberInputKey(key("ArrowDown", { shift: true }), o)).toEqual({
      type: "DECREASE",
      large: true,
      modality: "keyboard",
    })
    expect(numberInputKey(key("PageUp"), o)?.type).toBe("PAGE_PREV")
    expect(numberInputKey(key("Home"), o)).toBeNull()
    expect(numberInputKey(key("End"), o)?.type).toBe("LAST")
    expect(numberInputKey(key("Enter"), o)).toEqual({ type: "COMMIT", source: "enter" })
    expect(numberInputKey(key("ArrowLeft"), o)).toBeNull()
  })
  it("never handles composition or browser shortcuts", () => {
    const o = { hasMin: true, hasMax: true }
    expect(numberInputKey(key("ArrowUp", { composing: true }), o)).toBeNull()
    for (const m of ["alt", "ctrl", "meta"] as const)
      expect(numberInputKey(key("ArrowUp", { [m]: true }), o)).toBeNull()
  })
})

describe("inputModeOf", () => {
  it("server and hydration: decimal or numeric; after mount iPhone text, Android numeric", () => {
    expect(
      inputModeOf({ fractions: true, allowNegative: true, mounted: false }, platforms.ios),
    ).toBe("decimal")
    expect(
      inputModeOf({ fractions: false, allowNegative: false, mounted: true }, platforms.ios),
    ).toBe("numeric")
    expect(
      inputModeOf({ fractions: true, allowNegative: true, mounted: true }, platforms.ios),
    ).toBe("text")
    expect(
      inputModeOf({ fractions: true, allowNegative: true, mounted: true }, platforms.android),
    ).toBe("numeric")
    expect(
      inputModeOf({ fractions: true, allowNegative: true, mounted: true }, platforms.linux),
    ).toBe("decimal")
  })
})

describe("parts", () => {
  it("the input is a spinbutton with value attributes, no invented bounds, no name", () => {
    const p = numberInputConnect(input(), env).input()
    expect(p).toMatchObject({
      role: "spinbutton",
      type: "text",
      "aria-valuenow": 5,
      "aria-valuetext": "5",
      autocomplete: "off",
      spellcheck: "false",
    })
    expect(p["aria-valuemin"]).toBeUndefined()
    expect(p["aria-valuemax"]).toBeUndefined()
    expect(p["name"]).toBeUndefined()
    expect(p["aria-roledescription"]).toBeUndefined()
  })

  it("Empty: no aria-valuenow, valuetext 'Empty'", () => {
    const p = numberInputConnect(input({ value: null, text: "" }), env).input()
    expect(p["aria-valuenow"]).toBeUndefined()
    expect(p["aria-valuetext"]).toBe("Empty")
  })

  it("the iOS quirk drops the role and value attributes", () => {
    const p = numberInputConnect(input({ plainTextbox: true }), env).input()
    expect(p["role"]).toBeUndefined()
    expect(p["aria-valuenow"]).toBeUndefined()
  })

  it("triggers: out of the tab order, named after the Label, aria-disabled at the bound", () => {
    const api = numberInputConnect(input({ canIncrement: false }), env)
    expect(api.incrementTrigger()).toMatchObject({
      type: "button",
      tabindex: -1,
      "aria-controls": "in",
      "aria-label": "Increase",
      "aria-labelledby": "inc lab",
      "aria-disabled": "true",
      "data-disabled": "",
    })
    expect(api.incrementTrigger()["disabled"]).toBeUndefined()
    expect(api.decrementTrigger()["aria-disabled"]).toBeUndefined()
  })

  it("hidden input: number, constraints, step any without min", () => {
    const api = numberInputConnect(input({ min: 0, max: 10, step: 2 }), env)
    expect(api.hiddenInput()).toMatchObject({
      type: "number",
      min: 0,
      max: 10,
      step: 2,
      "aria-hidden": "true",
      tabindex: -1,
    })
    expect(numberInputConnect(input(), env).hiddenInput()["step"]).toBe("any")
    // min without an explicit step: commits do not snap, so no native step constraint.
    expect(numberInputConnect(input({ min: 0 }), env).hiddenInput()["step"]).toBe("any")
  })

  it("Value attributes for a German currency (cause G)", () => {
    const p = numberInputConnect(
      input({
        value: 10,
        parser: createNumberParser("de-DE", { style: "currency", currency: "EUR" }),
      }),
      env,
    ).input()
    expect(p["aria-valuetext"]).toBe(
      new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(10),
    )
  })
})
