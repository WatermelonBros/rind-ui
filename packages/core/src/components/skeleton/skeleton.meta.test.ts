import { describe, expect, it } from "vitest"
import { skeletonConnect } from "./skeleton.connect"
import { skeletonContract } from "./skeleton.contract"
import { skeletonMachine } from "./skeleton.machine"
import { skeletonMeta } from "./skeleton.meta"

describe("skeleton meta matches the code", () => {
  it("contract and states", () => {
    expect(Object.keys(skeletonMeta.contract.actions)).toEqual(
      Object.keys(skeletonContract.actions),
    )
    expect(skeletonMeta.contract.queries).toEqual(Object.keys(skeletonContract.queries))
    expect(skeletonMeta.contract.traits).toEqual(skeletonContract.traits)
    expect(Object.keys(skeletonMeta.states)).toEqual(Object.keys(skeletonMachine.def.states))
  })
  it("data attributes", () => {
    const c = skeletonConnect({ instance: "i", loading: true, animate: true })
    const keys = (p: object | null) => Object.keys(p ?? {}).filter((k) => k.startsWith("data-"))
    const parts = {
      root: c.root(),
      status: c.status(),
      content: c.content(),
      item: c.item({ hasChildren: false }),
    }
    for (const [part, props] of Object.entries(parts)) {
      expect(Object.keys(skeletonMeta.dataAttributes[part as keyof typeof parts]).sort()).toEqual(
        keys(props).sort(),
      )
    }
  })
})
