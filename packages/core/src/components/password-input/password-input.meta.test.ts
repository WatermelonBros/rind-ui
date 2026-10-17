import { describe, expect, it } from "vitest"
import { passwordInputContract } from "./password-input.contract"
import { passwordInputMachine } from "./password-input.machine"
import { passwordInputMeta } from "./password-input.meta"

describe("password-input meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(passwordInputContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(passwordInputMeta.contract.actions).toEqual(actions)
    expect(passwordInputMeta.contract.queries).toEqual(Object.keys(passwordInputContract.queries))
    expect(passwordInputMeta.contract.traits).toEqual(passwordInputContract.traits)
    expect(Object.keys(passwordInputMeta.states)).toEqual(
      Object.keys(passwordInputMachine.def.states),
    )
  })
})
