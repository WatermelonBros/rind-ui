import { describe, expect, it } from "vitest"
import { fieldsetConnect } from "./fieldset.connect"
import { fieldsetContract } from "./fieldset.contract"
import { fieldsetMeta } from "./fieldset.meta"

describe("fieldset meta matches the code", () => {
  it("contract", () => {
    expect(fieldsetMeta.contract.queries).toEqual(Object.keys(fieldsetContract.queries))
    expect(fieldsetMeta.parts.map((p) => p.part)).toEqual([...fieldsetContract.anatomy])
  })
  it("data attributes", () => {
    const api = fieldsetConnect({
      instance: "i",
      disabled: true,
      invalid: true,
      rootTag: "fieldset",
      nativeLegend: true,
      ids: {},
    })
    const keys = (p: object) =>
      Object.keys(p)
        .filter((k) => k.startsWith("data-"))
        .sort()
    expect(Object.keys(fieldsetMeta.dataAttributes.root).sort()).toEqual(keys(api.root()))
    expect(Object.keys(fieldsetMeta.dataAttributes.legend).sort()).toEqual(keys(api.legend("x")))
  })
})
