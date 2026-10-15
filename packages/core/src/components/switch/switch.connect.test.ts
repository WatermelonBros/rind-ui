// Switch parts in Node (openspec switch "ARIA Semantics", "Data Attributes", labels).
import { describe, expect, it } from "vitest"
import { CRITICAL } from "../../connect/props"
import type { LinkEnv } from "../../dom/link"
import { platforms } from "../../dom/platform"
import type { FieldControlProps } from "../shared/field-control"
import { type SwitchConnectInput, switchConnect } from "./switch.connect"

const env: LinkEnv = {
  platform: platforms.linux,
  modality: {
    modality: () => "pointer",
    subscribe: () => () => {},
    focusCause: () => "other",
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}
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
const base: SwitchConnectInput = {
  instance: "i1",
  checked: false,
  tag: "button",
  labelable: true,
  field,
  focusableWhenDisabled: false,
  focused: false,
  modality: "pointer",
  pressed: false,
  hovered: false,
  ids: { control: "c", label: "l", description: "d", hiddenInput: "h" },
  labelRendered: true,
  value: "on",
  defaultChecked: false,
}
const connect = (
  over: Partial<Omit<SwitchConnectInput, "field">> = {},
  f: Partial<FieldControlProps> = {},
) => switchConnect({ ...base, ...over, field: { ...field, ...f } }, env)

describe("control", () => {
  it("role switch; aria-checked is exactly true or false", () => {
    expect(connect().control()["role"]).toBe("switch")
    expect(connect({ checked: true }).control()["aria-checked"]).toBe("true")
    expect(connect({ checked: false }).control()["aria-checked"]).toBe("false")
  })

  it("role, aria-checked and type are critical (HUI#2935)", () => {
    const p = connect().control()
    expect(p[CRITICAL]).toEqual(expect.arrayContaining(["aria-checked", "role", "type"]))
    expect(p["type"]).toBe("button")
  })

  it("aria-required, aria-invalid and aria-readonly", () => {
    const p = connect({}, { "aria-required": "true", "aria-invalid": "true", readOnly: true })
    expect(p.control()).toMatchObject({
      "aria-required": "true",
      "aria-invalid": "true",
      "aria-readonly": "true",
    })
    const q = connect().control()
    expect(q["aria-required"]).toBeUndefined()
    expect(q["aria-invalid"]).toBeUndefined()
    expect(q["aria-readonly"]).toBeUndefined()
  })

  it("never carries the name (the hidden input does)", () => {
    expect(connect({}, { name: "wifi" }).control()).not.toHaveProperty("name")
  })
})

describe("thumb", () => {
  it("is aria-hidden and carries scope, part and state", () => {
    expect(connect({ checked: true }).thumb()).toMatchObject({
      "aria-hidden": "true",
      "data-scope": "switch",
      "data-part": "thumb",
      "data-state": "checked",
    })
  })
})

describe("hidden input", () => {
  it("native checkbox props from the field and the machine props", () => {
    const p = connect(
      { value: "yes", form: "f", defaultChecked: true },
      { name: "wifi", required: true, disabled: true },
    ).hiddenInput()
    expect(p).toMatchObject({
      type: "checkbox",
      "aria-hidden": "true",
      tabIndex: -1,
      name: "wifi",
      value: "yes",
      form: "f",
      required: true,
      disabled: true,
      defaultChecked: true,
      id: "h",
    })
  })
})

describe("data attributes", () => {
  it("state is mirrored on every part", () => {
    const api = connect(
      { checked: true },
      { disabled: true, readOnly: true, required: true, invalid: true },
    )
    const parts = ["root", "control", "thumb", "label", "description"] as const
    for (const part of parts) {
      expect(api[part](), part).toMatchObject({
        "data-scope": "switch",
        "data-part": part,
        "data-state": "checked",
        "data-disabled": "",
        "data-readonly": "",
        "data-required": "",
        "data-invalid": "",
      })
    }
    expect(api.hiddenInput()["data-scope"]).toBe("switch")
  })

  it("flags are absent when off; unchecked state", () => {
    const p = connect().root()
    expect(p["data-state"]).toBe("unchecked")
    for (const k of ["data-disabled", "data-readonly", "data-required", "data-invalid"]) {
      expect(p[k as `data-${string}`]).toBeUndefined()
    }
  })

  it("the control adds pressed and hover", () => {
    expect(connect({ pressed: true, hovered: true }).control()).toMatchObject({
      "data-pressed": "",
      "data-hover": "",
    })
  })
})

describe("label", () => {
  it("htmlFor is the control id when labelable", () => {
    expect(connect({ labelable: true }).label()["htmlFor"]).toBe("c")
  })
})
