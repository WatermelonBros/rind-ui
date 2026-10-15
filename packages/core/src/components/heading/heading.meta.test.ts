import { describe, expect, it } from "vitest"
import { headingConnect } from "./heading.connect"
import { headingContract } from "./heading.contract"
import { headingMeta } from "./heading.meta"

describe("heading meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(headingMeta.contract.actions)).toEqual(Object.keys(headingContract.actions))
    expect(headingMeta.contract.queries).toEqual(Object.keys(headingContract.queries))
    expect(headingMeta.contract.traits).toEqual(headingContract.traits)
  })
  it("data attributes", () => {
    const keys = Object.keys(headingConnect({ level: 3, tag: "div", instance: "i" })).filter((k) =>
      k.startsWith("data-"),
    )
    expect(Object.keys(headingMeta.dataAttributes.root).sort()).toEqual(keys.sort())
  })
})
