import { describe, expect, it } from "vitest"
import { gridListContract } from "./grid-list.contract"
import { gridListMachine } from "./grid-list.machine"
import { gridListMeta } from "./grid-list.meta"

describe("grid list meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(gridListContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(gridListMeta.contract.actions).toEqual(actions)
    expect(gridListMeta.contract.queries).toEqual(Object.keys(gridListContract.queries))
    expect(gridListMeta.contract.traits).toEqual(gridListContract.traits)
    expect(Object.keys(gridListMeta.states)).toEqual(Object.keys(gridListMachine.def.states))
  })
})
