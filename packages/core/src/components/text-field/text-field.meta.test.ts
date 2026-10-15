import { describe, expect, it } from "vitest"
import { textFieldContract } from "./text-field.contract"
import { textFieldMachine } from "./text-field.machine"
import { textFieldMeta } from "./text-field.meta"

describe("text-field meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(textFieldContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(textFieldMeta.contract.actions).toEqual(actions)
    expect(textFieldMeta.contract.queries).toEqual(Object.keys(textFieldContract.queries))
    expect(textFieldMeta.contract.traits).toEqual(textFieldContract.traits)
    expect(Object.keys(textFieldMeta.states)).toEqual(Object.keys(textFieldMachine.def.states))
  })
})
