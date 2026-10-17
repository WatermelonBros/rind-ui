import { describe, expect, it } from "vitest"
import { tagsInputContract } from "./tags-input.contract"
import { tagsInputMachine } from "./tags-input.machine"
import { tagsInputMeta } from "./tags-input.meta"

describe("tags-input meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(tagsInputContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(tagsInputMeta.contract.actions).toEqual(actions)
    expect(tagsInputMeta.contract.queries).toEqual(Object.keys(tagsInputContract.queries))
    expect(tagsInputMeta.contract.traits).toEqual(tagsInputContract.traits)
    expect(Object.keys(tagsInputMeta.states)).toEqual(Object.keys(tagsInputMachine.def.states))
  })
})
