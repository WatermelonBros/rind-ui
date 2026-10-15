// Checkbox Group parts and per-item props in Node (openspec checkbox-group "Group
// Semantics And Labelling", "Disabled And Read-Only Propagation", "Required Group").
import { describe, expect, it } from "vitest"
import { type CheckboxGroupConnectInput, checkboxGroupConnect } from "./checkbox-group.connect"

const base: CheckboxGroupConnectInput = {
  instance: "g",
  value: ["a"],
  allValues: ["a", "b", "c"],
  disabled: false,
  readOnly: false,
  required: false,
  invalid: false,
  rootTag: "div",
  labelTag: "span",
  ids: { label: "l", description: "d", errorMessage: "e" },
  rendered: { label: "l", description: "d", errorMessage: "e" },
  controls: ["ca", "cc"],
}
const connect = (over: Partial<CheckboxGroupConnectInput> = {}) =>
  checkboxGroupConnect({ ...base, ...over })
const own = { disabled: false, readOnly: false, required: false }

describe("root", () => {
  it("role group named by the Label only while it is rendered", () => {
    expect(connect().root()).toMatchObject({ role: "group", "aria-labelledby": "l" })
    const p = connect({ rendered: {} }).root()
    expect(p["aria-labelledby"]).toBeUndefined()
    expect(p["role"]).toBe("group")
  })

  it("a fieldset with a legend has neither role nor aria-labelledby", () => {
    const p = connect({ rootTag: "fieldset", labelTag: "legend" }).root()
    expect(p["role"]).toBeUndefined()
    expect(p["aria-labelledby"]).toBeUndefined()
    // Only the pair counts: a fieldset with a span Label keeps the explicit name.
    expect(connect({ rootTag: "fieldset" }).root()["role"]).toBe("group")
  })

  it("describedby lists the Description, and the error only when invalid and rendered", () => {
    expect(connect().root()["aria-describedby"]).toBe("d")
    expect(connect({ invalid: true }).root()["aria-describedby"]).toBe("d e")
    expect(
      connect({ invalid: true, rendered: { description: "d" } }).root()["aria-describedby"],
    ).toBe("d")
    expect(connect({ rendered: {} }).root()["aria-describedby"]).toBeUndefined()
  })

  it("the Field's ids come first", () => {
    const p = connect({ invalid: true, field: { label: "fl", description: "fd", error: "fe" } })
    expect(p.root()).toMatchObject({
      "aria-labelledby": "fl",
      "aria-describedby": "fd fe d e",
    })
  })

  it("data attributes", () => {
    const p = connect({ disabled: true, readOnly: true, required: true, invalid: true }).root()
    expect(p).toMatchObject({
      "data-scope": "checkbox-group",
      "data-part": "root",
      "data-disabled": "",
      "data-readonly": "",
      "data-required": "",
      "data-invalid": "",
    })
    const q = connect().root()
    for (const a of ["data-disabled", "data-readonly", "data-required", "data-invalid"]) {
      expect(q[a], a).toBeUndefined()
    }
  })

  it("label, description and error message carry id, part and flags", () => {
    const api = connect({ disabled: true, invalid: true })
    expect(api.label()).toMatchObject({
      "data-part": "label",
      id: "l",
      "data-disabled": "",
      "data-invalid": "",
    })
    expect(api.description()).toMatchObject({ "data-part": "description", id: "d" })
    expect(api.errorMessage()).toMatchObject({ "data-part": "error-message", id: "e" })
  })
})

describe("item", () => {
  it("checked is membership in the value", () => {
    expect(connect().item("a", own).checked).toBe(true)
    expect(connect().item("b", own).checked).toBe(false)
  })

  it("disabled and readOnly are group OR item", () => {
    expect(connect({ disabled: true }).item("a", own).disabled).toBe(true)
    expect(connect({ disabled: true }).item("a", { ...own, disabled: false }).disabled).toBe(true)
    expect(connect().item("a", { ...own, disabled: true }).disabled).toBe(true)
    expect(connect().item("a", own).disabled).toBe(false)
    expect(connect({ readOnly: true }).item("a", own).readOnly).toBe(true)
    expect(connect().item("a", { ...own, readOnly: true }).readOnly).toBe(true)
  })

  it("required while the value is empty, only on enabled items", () => {
    const empty = connect({ required: true, value: [] })
    expect(empty.item("a", own).required).toBe(true)
    expect(empty.item("a", { ...own, disabled: true }).required).toBe(false)
    expect(connect({ required: true, value: [], disabled: true }).item("a", own).required).toBe(
      false,
    )
    expect(connect({ required: true }).item("b", own).required).toBe(false)
  })

  it("an item's own required is kept", () => {
    expect(connect().item("a", { ...own, required: true }).required).toBe(true)
    expect(connect({ required: true }).item("a", { ...own, required: true }).required).toBe(true)
  })

  it("name, form, invalid and describedBy come from the group", () => {
    const p = connect({ name: "toppings", form: "f", invalid: true }).item("a", own)
    expect(p).toMatchObject({ name: "toppings", form: "f", invalid: true, describedBy: "d e" })
    expect(connect().item("a", own).describedBy).toBe("d")
  })

  it("data-value on root and control", () => {
    const p = connect().item("a", own)
    expect(p.root).toEqual({ "data-value": "a" })
    expect(p.control).toEqual({ "data-value": "a" })
  })
})

describe("parent", () => {
  it("indeterminate, checked, unchecked", () => {
    expect(connect().parent().checked).toBe("indeterminate")
    expect(connect({ value: ["a", "b", "c"] }).parent().checked).toBe(true)
    expect(connect({ value: [] }).parent().checked).toBe(false)
  })

  it("data-parent, aria-controls from the rendered controls, no name", () => {
    const p = connect({ name: "toppings" }).parent()
    expect(p.name).toBeUndefined()
    expect(p.root).toEqual({ "data-parent": "" })
    expect(p.control).toEqual({ "data-parent": "", "aria-controls": "ca cc" })
    expect(connect({ controls: [] }).parent().control["aria-controls"]).toBeUndefined()
  })

  it("inherits disabled and readOnly, and is never required", () => {
    const p = connect({ disabled: true, readOnly: true, required: true, value: [] }).parent()
    expect(p).toMatchObject({ disabled: true, readOnly: true, required: false })
  })
})
