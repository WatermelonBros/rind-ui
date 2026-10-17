import { describe, expect, it } from "vitest"
import { pinInputContract } from "./pin-input.contract"
import { pinInputMachine } from "./pin-input.machine"
import { pinInputMeta } from "./pin-input.meta"

describe("pin-input meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(pinInputContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(pinInputMeta.contract.actions).toEqual(actions)
    expect(pinInputMeta.contract.queries).toEqual(Object.keys(pinInputContract.queries))
    expect(pinInputMeta.contract.traits).toEqual(pinInputContract.traits)
    expect(Object.keys(pinInputMeta.states)).toEqual(Object.keys(pinInputMachine.def.states))
  })
})
