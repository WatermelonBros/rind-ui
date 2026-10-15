import { describe, expect, it } from "vitest"
import { accordionContract } from "./accordion.contract"
import { accordionMachine } from "./accordion.machine"
import { accordionMeta } from "./accordion.meta"

describe("accordion meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(accordionContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(accordionMeta.contract.actions).toEqual(actions)
    expect(accordionMeta.contract.queries).toEqual(Object.keys(accordionContract.queries))
    expect(accordionMeta.contract.traits).toEqual(accordionContract.traits)
    expect(Object.keys(accordionMeta.states)).toEqual(Object.keys(accordionMachine.def.states))
  })
})
