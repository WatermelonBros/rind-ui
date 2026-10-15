import { describe, expect, it } from "vitest"
import { formConnect } from "./form.connect"
import { formContract } from "./form.contract"
import { formMachine } from "./form.machine"
import { formMeta } from "./form.meta"

describe("form meta matches the code", () => {
  it("contract and states", () => {
    expect(formMeta.contract.queries).toEqual(Object.keys(formContract.queries))
    expect(Object.keys(formMeta.contract.actions)).toEqual(Object.keys(formContract.actions))
    expect(Object.keys(formMeta.states)).toEqual(Object.keys(formMachine.def.states))
  })
  it("data attributes", () => {
    const part = formConnect({
      instance: "i",
      state: "idle",
      failed: true,
      validationBehavior: "native",
    })
    const keys = Object.keys(part)
      .filter((k) => k.startsWith("data-"))
      .sort()
    expect(Object.keys(formMeta.dataAttributes.root).sort()).toEqual(keys)
  })
})
