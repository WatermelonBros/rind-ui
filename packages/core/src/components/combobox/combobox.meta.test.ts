import { describe, expect, it } from "vitest"
import { comboboxContract } from "./combobox.contract"
import { comboboxMachine } from "./combobox.machine"
import { comboboxMeta } from "./combobox.meta"

describe("combobox meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(comboboxContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(comboboxMeta.contract.actions).toEqual(actions)
    expect(comboboxMeta.contract.queries).toEqual(Object.keys(comboboxContract.queries))
    expect(comboboxMeta.contract.traits).toEqual(comboboxContract.traits)
    expect(Object.keys(comboboxMeta.states)).toEqual(Object.keys(comboboxMachine.def.states))
  })
})
