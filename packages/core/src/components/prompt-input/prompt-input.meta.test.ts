import { describe, expect, it } from "vitest"
import { promptInputContract } from "./prompt-input.contract"
import { promptInputMachine } from "./prompt-input.machine"
import { promptInputMeta } from "./prompt-input.meta"

describe("prompt-input meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(promptInputContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(promptInputMeta.contract.actions).toEqual(actions)
    expect(promptInputMeta.contract.queries).toEqual(Object.keys(promptInputContract.queries))
    expect(promptInputMeta.contract.traits).toEqual(promptInputContract.traits)
    expect(Object.keys(promptInputMeta.states)).toEqual(Object.keys(promptInputMachine.def.states))
  })
})
