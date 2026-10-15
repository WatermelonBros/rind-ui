import { describe, expect, it } from "vitest"
import { fieldConnect } from "./field.connect"
import { fieldContract } from "./field.contract"
import { fieldMachine } from "./field.machine"
import { fieldMeta } from "./field.meta"

describe("field meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(fieldContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(fieldMeta.contract.actions).toEqual(actions)
    expect(fieldMeta.contract.queries).toEqual(Object.keys(fieldContract.queries))
    expect(Object.keys(fieldMeta.states)).toEqual(Object.keys(fieldMachine.def.states))
  })
  it("data attributes", () => {
    const context = fieldMachine.def.context({} as never)
    const api = fieldConnect({
      instance: "i",
      state: "idle",
      context,
      props: {},
      control: null,
      initial: null,
      modality: "pointer",
    })
    const keys = (p: object) =>
      Object.keys(p)
        .filter((k) => k.startsWith("data-"))
        .sort()
    expect(Object.keys(fieldMeta.dataAttributes.root).sort()).toEqual(keys(api.root()))
    expect(Object.keys(fieldMeta.dataAttributes.label).sort()).toEqual(keys(api.label("x")))
  })
})
