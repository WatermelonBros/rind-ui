import { describe, expect, it } from "vitest"
import { colorFieldConnect } from "./color-field.connect"
import { colorFieldContract } from "./color-field.contract"
import { colorFieldMeta } from "./color-field.meta"

describe("color field meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(colorFieldMeta.contract.actions)).toEqual(
      Object.keys(colorFieldContract.actions),
    )
    expect(colorFieldMeta.contract.queries).toEqual(Object.keys(colorFieldContract.queries))
    expect(colorFieldMeta.contract.traits).toEqual(colorFieldContract.traits)
    expect(Object.keys(colorFieldMeta.states)).toEqual(Object.keys(colorFieldContract.states))
  })
  it("data attributes", () => {
    const api = colorFieldConnect({
      instance: "f",
      value: null,
      draft: "x",
      invalidDraft: true,
      format: "hex",
      alpha: false,
      field: {
        disabled: true,
        readOnly: true,
        required: false,
        invalid: false,
        name: undefined,
        "aria-required": undefined,
        "aria-invalid": undefined,
        "aria-describedby": undefined,
        "aria-labelledby": undefined,
        "aria-errormessage": undefined,
      },
      focused: true,
      modality: "keyboard",
      ids: { input: "i", hiddenInput: "h" },
      defaultValue: null,
    })
    const keys = Object.keys(api.input())
      .filter((k) => k.startsWith("data-"))
      .sort()
    expect(Object.keys(colorFieldMeta.dataAttributes.input).sort()).toEqual(keys)
  })
})
