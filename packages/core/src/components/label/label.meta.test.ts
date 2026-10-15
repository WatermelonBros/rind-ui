import { describe, expect, it } from "vitest"
import { labelConnect } from "./label.connect"
import { labelContract } from "./label.contract"
import { labelMeta } from "./label.meta"

describe("label meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(labelMeta.contract.actions)).toEqual(Object.keys(labelContract.actions))
    expect(labelMeta.contract.queries).toEqual(Object.keys(labelContract.queries))
  })
  it("data attributes", () => {
    const part = labelConnect({ instance: "i", id: "i", tag: "label", forwardsFocus: false })
    const keys = Object.keys(part).filter((k) => k.startsWith("data-"))
    expect(Object.keys(labelMeta.dataAttributes.root).sort()).toEqual(keys.sort())
  })
})
