import { describe, expect, it, vi } from "vitest"
import { controlLabel, warnOwnLabelInField } from "./control-label"

const input = {
  scope: "checkbox",
  instance: "i1",
  controlId: "c",
  labelId: "l",
  descriptionId: "d",
  state: { "data-state": "checked", "data-disabled": undefined },
} as const

describe("controlLabel", () => {
  it("a labelable control: the Label points at it with htmlFor", () => {
    const { label } = controlLabel({ ...input, labelable: true })
    expect(label()).toMatchObject({
      "data-scope": "checkbox",
      "data-part": "label",
      id: "l",
      htmlFor: "c",
      "data-state": "checked",
    })
  })

  it("a non-labelable control: no htmlFor", () => {
    expect(controlLabel({ ...input, labelable: false }).label()["htmlFor"]).toBeUndefined()
  })

  it("the Description carries id and the mirrored state, and no htmlFor", () => {
    const d = controlLabel({ ...input, labelable: true }).description()
    expect(d).toMatchObject({ "data-part": "description", id: "d", "data-state": "checked" })
    expect(d).not.toHaveProperty("htmlFor", "c")
  })
})

describe("warnOwnLabelInField", () => {
  it("warns in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    warnOwnLabelInField("checkbox")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("checkbox"))
    warn.mockRestore()
  })
})
