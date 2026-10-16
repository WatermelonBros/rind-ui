import { describe, expect, it } from "vitest"
import { searchFieldContract } from "./search-field.contract"
import { searchFieldMachine } from "./search-field.machine"
import { searchFieldMeta } from "./search-field.meta"

describe("search-field meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(searchFieldContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(searchFieldMeta.contract.actions).toEqual(actions)
    expect(searchFieldMeta.contract.queries).toEqual(Object.keys(searchFieldContract.queries))
    expect(searchFieldMeta.contract.traits).toEqual(searchFieldContract.traits)
    expect(Object.keys(searchFieldMeta.states)).toEqual(Object.keys(searchFieldMachine.def.states))
  })
})
