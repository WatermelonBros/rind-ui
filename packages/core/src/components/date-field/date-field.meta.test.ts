import { describe, expect, it } from "vitest"
import { dateFieldContract } from "./date-field.contract"
import { dateFieldMachine } from "./date-field.machine"
import { dateFieldMeta } from "./date-field.meta"

describe("date-field meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(dateFieldContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(dateFieldMeta.contract.actions).toEqual(actions)
    expect(dateFieldMeta.contract.queries).toEqual(Object.keys(dateFieldContract.queries))
    expect(dateFieldMeta.contract.traits).toEqual(dateFieldContract.traits)
    expect(Object.keys(dateFieldMeta.states)).toEqual(Object.keys(dateFieldMachine.def.states))
  })
})
