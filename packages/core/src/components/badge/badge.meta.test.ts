import { describe, expect, it } from "vitest"
import { badgeConnect } from "./badge.connect"
import { badgeContract } from "./badge.contract"
import { badgeMeta } from "./badge.meta"

describe("badge meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(badgeMeta.contract.actions)).toEqual(Object.keys(badgeContract.actions))
    expect(badgeMeta.contract.queries).toEqual(Object.keys(badgeContract.queries))
    expect(badgeMeta.contract.traits).toEqual(badgeContract.traits)
  })
  it("data attributes", () => {
    const keys = Object.keys(badgeConnect({ instance: "i", label: "x" }).root()).filter((k) =>
      k.startsWith("data-"),
    )
    expect(Object.keys(badgeMeta.dataAttributes.root).sort()).toEqual(keys.sort())
  })
  it("is stateless", () => {
    expect(badgeMeta.stateless).toBe(true)
  })
})
