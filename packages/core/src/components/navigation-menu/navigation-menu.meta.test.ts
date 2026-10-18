import { describe, expect, it } from "vitest"
import { navigationMenuContract } from "./navigation-menu.contract"
import { navigationMenuMachine } from "./navigation-menu.machine"
import { navigationMenuMeta } from "./navigation-menu.meta"

describe("navigation-menu meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(navigationMenuContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(navigationMenuMeta.contract.actions).toEqual(actions)
    expect(navigationMenuMeta.contract.queries).toEqual(Object.keys(navigationMenuContract.queries))
    expect(navigationMenuMeta.contract.traits).toEqual(navigationMenuContract.traits)
    expect(Object.keys(navigationMenuMeta.states)).toEqual(Object.keys(navigationMenuMachine.def.states))
  })
})
