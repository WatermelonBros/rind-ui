import { describe, expect, it } from "vitest"
import { menubarContract } from "./menubar.contract"
import { menubarMachine } from "./menubar.machine"
import { menubarMeta } from "./menubar.meta"

describe("menubar meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(menubarContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(menubarMeta.contract.actions).toEqual(actions)
    expect(menubarMeta.contract.queries).toEqual(Object.keys(menubarContract.queries))
    expect(menubarMeta.contract.traits).toEqual(menubarContract.traits)
    expect(Object.keys(menubarMeta.states)).toEqual(Object.keys(menubarMachine.def.states))
  })
})
