// Checkbox parts in Node (openspec checkbox "ARIA Semantics", "Data Attributes", labels).
import { describe, expect, it } from "vitest"
import { CRITICAL } from "../../connect/props"
import type { LinkEnv } from "../../dom/link"
import { platforms } from "../../dom/platform"
import type { FieldControlProps } from "../shared/field-control"
import { type CheckboxConnectInput, checkboxConnect } from "./checkbox.connect"

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
const base: CheckboxConnectInput = {
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
  over: Partial<Omit<CheckboxConnectInput, "field">> = {},
  f: Partial<FieldControlProps> = {},
) => checkboxConnect({ ...base, ...over, field: { ...field, ...f } }, env)

describe("control", () => {
  it("aria-checked is true, false or mixed, never absent", () => {
    expect(connect({ checked: true }).control()["aria-checked"]).toBe("true")
    expect(connect({ checked: false }).control()["aria-checked"]).toBe("false")
    expect(connect({ checked: "indeterminate" }).control()["aria-checked"]).toBe("mixed")
  })

  it("role checkbox is critical and kept on a div tag (ariakit#6336)", () => {
    const p = connect({ tag: "div", labelable: false }).control()
    expect(p["role"]).toBe("checkbox")
    expect(p[CRITICAL]).toEqual(expect.arrayContaining(["aria-checked", "role"]))
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

  it("native required also gives aria-required", () => {
    expect(connect({}, { required: true }).control()["aria-required"]).toBe("true")
  })

  it("never carries the name (the hidden input does)", () => {
    expect(connect({}, { name: "terms" }).control()).not.toHaveProperty("name")
  })

  it("aria-labelledby only for a non-labelable control with a rendered Label", () => {
    expect(connect({ labelable: true }).control()["aria-labelledby"]).toBeUndefined()
    expect(connect({ labelable: false, tag: "div" }).control()["aria-labelledby"]).toBe("l")
    expect(
      connect({ labelable: false, tag: "div", labelRendered: false }).control()["aria-labelledby"],
    ).toBeUndefined()
  })
})

describe("hidden input", () => {
  it("native checkbox props from the field and the machine props", () => {
    const p = connect(
      { value: "yes", form: "f", defaultChecked: true },
      { name: "terms", required: true, disabled: true },
    ).hiddenInput()
    expect(p).toMatchObject({
      type: "checkbox",
      "aria-hidden": "true",
      tabIndex: -1,
      name: "terms",
      value: "yes",
      form: "f",
      required: true,
      disabled: true,
      defaultChecked: true,
      id: "h",
    })
  })

  it("defaultChecked is the default prop, not the current value", () => {
    expect(connect({ checked: true, defaultChecked: false }).hiddenInput()).toMatchObject({
      defaultChecked: false,
    })
    expect(
      connect({ checked: false, defaultChecked: "indeterminate" }).hiddenInput(),
    ).toMatchObject({ defaultChecked: false })
  })
})

describe("uncheckedInput", () => {
  const f = { name: "terms" }
  const u = (over: Partial<CheckboxConnectInput>, ff: Partial<FieldControlProps> = f) =>
    connect({ uncheckedValue: "no", ...over }, ff).uncheckedInput()

  it("rendered while unchecked, enabled and named", () => {
    expect(u({})).toMatchObject({ type: "hidden", name: "terms", value: "no" })
    expect(u({ checked: "indeterminate" })).not.toBeNull()
  })
  it("not rendered when checked, disabled, unnamed or without a value", () => {
    expect(u({ checked: true })).toBeNull()
    expect(u({}, { name: "terms", disabled: true })).toBeNull()
    expect(u({}, {})).toBeNull()
    expect(connect({}, f).uncheckedInput()).toBeNull()
  })
})

describe("data attributes", () => {
  it("state is mirrored on root, control, indicator, label and description", () => {
    const api = connect(
      { checked: "indeterminate" },
      { disabled: true, readOnly: true, required: true, invalid: true },
    )
    for (const part of ["root", "control", "indicator", "label", "description"] as const) {
      expect(api[part](), part).toMatchObject({
        "data-state": "indeterminate",
        "data-disabled": "",
        "data-readonly": "",
        "data-required": "",
        "data-invalid": "",
      })
    }
  })

  it("flags are absent when off", () => {
    const p = connect({ checked: true }).root()
    expect(p["data-state"]).toBe("checked")
    for (const k of ["data-disabled", "data-readonly", "data-required", "data-invalid"]) {
      expect(p[k as `data-${string}`]).toBeUndefined()
    }
  })

  it("the control adds pressed and hover; the indicator is aria-hidden", () => {
    const api = connect({ pressed: true, hovered: true })
    expect(api.control()).toMatchObject({ "data-pressed": "", "data-hover": "" })
    expect(api.indicator()["aria-hidden"]).toBe("true")
  })
})

describe("label", () => {
  it("htmlFor only when the control is labelable", () => {
    expect(connect({ labelable: true }).label()["htmlFor"]).toBe("c")
    expect(connect({ labelable: false, tag: "div" }).label()["htmlFor"]).toBeUndefined()
  })
})
