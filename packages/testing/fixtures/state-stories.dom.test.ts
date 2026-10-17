// missingStateStories reports a contract state without a state example by name. The
// fixtures' coverage is checked against the site export in examples.pw.test.ts.
import { contract, setup, type } from "@rind-ui/core"
import { describe, expect, it } from "vitest"
import { missingStateStories } from "../src/index"

describe("state stories", () => {
  it("a contract state without a story is reported by name", () => {
    const m = setup({
      types: type<{ props: object; events: { type: "X" }; env: object }>(),
    }).machine({
      id: "m",
      initial: "closed",
      states: { closed: { on: { X: "open" } }, open: {} },
    })
    const c = contract("m", {
      machine: m,
      anatomy: ["root"],
      locate: (name: string) => ({ role: "button", name }),
      queries: {},
      actions: {},
      states: { closed: {}, open: {} },
      events: {},
      traits: [],
    })
    expect(missingStateStories(c, { m: { closed: "Closed" } }, { Closed: {} })).toEqual([
      'm: no state story for "open"',
    ])
  })
})
