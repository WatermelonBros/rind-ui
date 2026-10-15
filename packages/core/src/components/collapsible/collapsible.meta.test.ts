import { describe, expect, it } from "vitest"
import { collapsibleContract } from "./collapsible.contract"
import { collapsibleMachine } from "./collapsible.machine"
import { collapsibleMeta } from "./collapsible.meta"

describe("collapsible meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(collapsibleContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(collapsibleMeta.contract.actions).toEqual(actions)
    expect(collapsibleMeta.contract.queries).toEqual(Object.keys(collapsibleContract.queries))
    expect(collapsibleMeta.contract.traits).toEqual(collapsibleContract.traits)
    expect(Object.keys(collapsibleMeta.states)).toEqual(Object.keys(collapsibleMachine.def.states))
  })
})
