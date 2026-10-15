// Text Field part props (design §5) in Node: no DOM, handlers driven with fake events.
import { describe, expect, it, vi } from "vitest"
import type { FieldControlProps } from "../shared/field-control"
import { type TextFieldConnectInput, textFieldConnect } from "./text-field.connect"

const field: FieldControlProps = {
  disabled: false,
  readOnly: false,
  required: false,
  invalid: false,
  name: undefined,
  "aria-required": undefined,
  "aria-invalid": undefined,
  "aria-describedby": undefined,
  "aria-labelledby": undefined,
  "aria-errormessage": undefined,
}

function make(
  over: Partial<TextFieldConnectInput> = {},
  fieldOver: Partial<FieldControlProps> = {},
) {
  const send = vi.fn()
  const report = vi.fn()
  const input: TextFieldConnectInput = {
    scope: "text-field",
    instance: "i1",
    state: "idle",
    value: "",
    controlled: false,
    defaultValue: undefined,
    focused: false,
    modality: "keyboard",
    focusableWhenDisabled: false,
    field: { ...field, ...fieldOver },
    fieldData: { "data-filled": undefined },
    controlId: "c1",
    countId: undefined,
    limit: undefined,
    count: undefined,
    clearLabel: "Clear",
    ...over,
  }
  const api = textFieldConnect(input, { send, report, takeReason: () => undefined })
  return { api, send, report }
}
/** Calls a handler prop (typed `unknown` on PartProps) with a fake event. */
const call = (props: object, name: string, event: unknown) =>
  (props as Record<string, (e: unknown) => void>)[name]?.(event)
const keydown = (init: {
  key: string
  keyCode?: number
  nativeEvent?: { isComposing?: boolean }
}) => init as never

describe("control attributes", () => {
  it("uncontrolled renders defaultValue, never value", () => {
    const p = make({ defaultValue: "abc" }).api.control("input")
    expect(p).toMatchObject({ defaultValue: "abc" })
    expect("value" in p).toBe(false)
  })

  it("controlled renders value, never defaultValue", () => {
    const p = make({ controlled: true, value: "abc", defaultValue: "zzz" }).api.control("input")
    expect(p).toMatchObject({ value: "abc" })
    expect("defaultValue" in p).toBe(false)
  })

  it("scope, part, instance, id", () => {
    expect(make().api.control("textarea")).toMatchObject({
      "data-scope": "text-field",
      "data-part": "textarea",
      "data-instance": "i1",
      id: "c1",
    })
    expect(make({ scope: "search-field" }).api.root()).toMatchObject({
      "data-scope": "search-field",
      "data-part": "root",
    })
  })

  it("disabled renders the native attribute only", () => {
    const p = make({}, { disabled: true }).api.control("input")
    expect(p["disabled"]).toBe(true)
    expect(p["readonly"]).toBeUndefined()
    expect(p["aria-disabled"]).toBeUndefined()
  })

  it("focusableWhenDisabled renders readonly + aria-disabled instead of disabled", () => {
    const p = make({ focusableWhenDisabled: true }, { disabled: true }).api.control("input")
    expect(p["disabled"]).toBeUndefined()
    expect(p["readonly"]).toBe(true)
    expect(p["aria-disabled"]).toBe("true")
  })

  it("read-only renders readonly without aria-disabled", () => {
    const p = make({}, { readOnly: true }).api.control("input")
    expect(p["readonly"]).toBe(true)
    expect(p["aria-disabled"]).toBeUndefined()
  })

  it("required / invalid pass through", () => {
    const p = make(
      {},
      { required: true, "aria-invalid": "true", "aria-required": "true" },
    ).api.control("input")
    expect(p).toMatchObject({ required: true, "aria-invalid": "true", "aria-required": "true" })
  })

  it("describedby includes the CharacterCount id after the Field's", () => {
    expect(make({ countId: "cnt" }).api.control("input")["aria-describedby"]).toBe("cnt")
    expect(
      make({ countId: "cnt" }, { "aria-describedby": "d e" }).api.control("input")[
        "aria-describedby"
      ],
    ).toBe("d e cnt")
    expect(make().api.control("input")["aria-describedby"]).toBeUndefined()
  })

  it("data-composing on root and control only while composing", () => {
    expect(make({ state: "composing" }).api.root()["data-composing"]).toBe("")
    expect(make({ state: "composing" }).api.control("input")["data-composing"]).toBe("")
    expect(make().api.root()["data-composing"]).toBeUndefined()
  })
})

describe("handlers", () => {
  it("input sends INPUT with composing and reports a change", () => {
    const { api, send, report } = make()
    call(api.control("input"), "onInput", {
      currentTarget: { value: "ab" },
      nativeEvent: { isComposing: true },
    })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INPUT", value: "ab", composing: true, reason: "INPUT" }),
    )
    expect(report).toHaveBeenCalledWith({
      type: "change",
      value: "ab",
      user: true,
      composing: true,
    })
  })

  it("compositionend reports one non-composing change with the committed value", () => {
    const { api, send, report } = make()
    call(api.control("input"), "onCompositionEnd", { currentTarget: { value: "テスト" } })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "COMPOSITION.END", value: "テスト" }),
    )
    expect(report).toHaveBeenCalledExactlyOnceWith({
      type: "change",
      value: "テスト",
      user: true,
      composing: false,
    })
  })

  it("Enter commits, except while composing, keyCode 229 or in a textarea", () => {
    const enter = (part: "input" | "textarea", e: Parameters<typeof keydown>[0]) => {
      const { api, report } = make()
      call(api.control(part), "onKeyDown", keydown(e))
      return report.mock.calls.length
    }
    expect(enter("input", { key: "Enter" })).toBe(1)
    expect(enter("input", { key: "Enter", nativeEvent: { isComposing: true } })).toBe(0)
    expect(enter("input", { key: "Enter", keyCode: 229 })).toBe(0)
    expect(enter("textarea", { key: "Enter" })).toBe(0)
    expect(enter("input", { key: "a" })).toBe(0)
  })
})

describe("derived", () => {
  it("clearable only when enabled, editable and non-empty", () => {
    expect(make({ value: "a" }).api.clearable).toBe(true)
    expect(make({ value: "" }).api.clearable).toBe(false)
    expect(make({ value: "a" }, { readOnly: true }).api.clearable).toBe(false)
    expect(make({ value: "a" }, { disabled: true }).api.clearable).toBe(false)
  })

  it("count text and over-limit", () => {
    const ok = make({ value: "a\nb", limit: 3 }).api
    expect(ok.countText).toBe("3/3")
    expect(ok.overLimit).toBe(false)
    const over = make({ value: "abcd", limit: 3 }).api
    expect(over.overLimit).toBe(true)
    expect(over.characterCount("c")["data-over-limit"]).toBe("")
    expect(make({ value: "ab" }).api.countText).toBe("2")
  })

  it("clear trigger: label and tabindex -1", () => {
    expect(make().api.clearTrigger()).toMatchObject({
      "aria-label": "Clear",
      tabindex: -1,
      "data-part": "clear-trigger",
    })
  })
})
