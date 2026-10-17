import { describe, expect, it } from "vitest"
import { listboxContract } from "./listbox.contract"
import { listboxMachine } from "./listbox.machine"
import { listboxMeta } from "./listbox.meta"

describe("listbox meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(listboxContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(listboxMeta.contract.actions).toEqual(actions)
    expect(listboxMeta.contract.queries).toEqual(Object.keys(listboxContract.queries))
    expect(listboxMeta.contract.traits).toEqual(listboxContract.traits)
    expect(Object.keys(listboxMeta.states)).toEqual(Object.keys(listboxMachine.def.states))
  })
})
