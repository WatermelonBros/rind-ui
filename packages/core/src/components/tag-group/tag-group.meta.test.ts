import { describe, expect, it } from "vitest"
import { tagGroupContract } from "./tag-group.contract"
import { tagGroupMachine } from "./tag-group.machine"
import { tagGroupMeta } from "./tag-group.meta"

describe("tag group meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(tagGroupContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(tagGroupMeta.contract.actions).toEqual(actions)
    expect(tagGroupMeta.contract.queries).toEqual(Object.keys(tagGroupContract.queries))
    expect(tagGroupMeta.contract.traits).toEqual(tagGroupContract.traits)
    expect(Object.keys(tagGroupMeta.states)).toEqual(Object.keys(tagGroupMachine.def.states))
  })
})
