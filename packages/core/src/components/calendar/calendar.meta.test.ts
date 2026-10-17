import { describe, expect, it } from "vitest"
import { calendarContract } from "./calendar.contract"
import { calendarMachine } from "./calendar.machine"
import { calendarMeta } from "./calendar.meta"

describe("calendar meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(calendarContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(calendarMeta.contract.actions).toEqual(actions)
    expect(calendarMeta.contract.queries).toEqual(Object.keys(calendarContract.queries))
    expect(calendarMeta.contract.traits).toEqual(calendarContract.traits)
    expect(Object.keys(calendarMeta.states)).toEqual(Object.keys(calendarMachine.def.states))
  })
})
