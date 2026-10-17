import { describe, expect, it } from "vitest"
import { selectContract } from "./select.contract"
import { selectMachine } from "./select.machine"
import { selectMeta } from "./select.meta"

describe("select meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(selectContract.actions).map(([name, a]) => [
        name,
        (["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
      ]),
    )
    const sorted = (o: Record<string, readonly string[]>) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v].sort()]))
    expect(sorted(selectMeta.contract.actions)).toEqual(sorted(actions))
    expect([...selectMeta.contract.queries].sort()).toEqual(
      Object.keys(selectContract.queries).sort(),
    )
    expect(selectMeta.contract.traits).toEqual(selectContract.traits)
    expect(Object.keys(selectMeta.states).sort()).toEqual(
      Object.keys(selectMachine.def.states).sort(),
    )
  })
})
