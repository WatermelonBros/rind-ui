import { describe, expect, it } from "vitest"
import { alertConnect } from "./alert.connect"
import { alertContract } from "./alert.contract"
import { alertMachine } from "./alert.machine"
import { alertMeta } from "./alert.meta"

describe("alert meta matches the code", () => {
  it("contract and states", () => {
    expect(Object.keys(alertMeta.contract.actions)).toEqual(Object.keys(alertContract.actions))
    expect(alertMeta.contract.queries).toEqual(Object.keys(alertContract.queries))
    expect(alertMeta.contract.traits).toEqual(alertContract.traits)
    expect(Object.keys(alertMeta.states)).toEqual(Object.keys(alertMachine.def.states))
  })
  it("data attributes", () => {
    const c = alertConnect({ instance: "i", open: true, dismissLabel: "Dismiss" })
    const keys = (p: object) => Object.keys(p).filter((k) => k.startsWith("data-"))
    const parts = {
      root: c.root(),
      icon: c.icon(),
      title: c.title(),
      description: c.description(),
      "close-trigger": c.closeTrigger({ named: false, focused: false, modality: "pointer" }),
    }
    for (const [part, props] of Object.entries(parts)) {
      expect(Object.keys(alertMeta.dataAttributes[part as keyof typeof parts]).sort()).toEqual(
        keys(props).sort(),
      )
    }
  })
})
