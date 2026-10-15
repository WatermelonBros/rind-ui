import { describe, expect, it } from "vitest"
import { separatorConnect } from "./separator.connect"
import { separatorContract } from "./separator.contract"
import { separatorMeta } from "./separator.meta"

describe("separator meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(separatorMeta.contract.actions)).toEqual(
      Object.keys(separatorContract.actions),
    )
    expect(separatorMeta.contract.queries).toEqual(Object.keys(separatorContract.queries))
    expect(separatorMeta.contract.traits).toEqual(separatorContract.traits)
  })
  it("data attributes (decorative included)", () => {
    const keys = Object.keys(
      separatorConnect({ tag: "div", instance: "i", decorative: true }).root(),
    ).filter((k) => k.startsWith("data-"))
    expect(Object.keys(separatorMeta.dataAttributes.root).sort()).toEqual(keys.sort())
  })
  it("is stateless", () => {
    expect(separatorMeta.stateless).toBe(true)
  })
})
