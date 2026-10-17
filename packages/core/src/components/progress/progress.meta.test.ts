import { describe, expect, it } from "vitest"
import { resolveRangeValue } from "../shared/range-value"
import { progressConnect } from "./progress.connect"
import { progressContract } from "./progress.contract"
import { progressMeta } from "./progress.meta"

describe("progress meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(progressMeta.contract.actions)).toEqual(
      Object.keys(progressContract.actions),
    )
    expect(progressMeta.contract.queries).toEqual(Object.keys(progressContract.queries))
    expect(progressMeta.contract.traits).toEqual(progressContract.traits)
  })
  it("data attributes and states", () => {
    const c = progressConnect({
      instance: "i",
      range: resolveRangeValue({ value: 40 }),
      text: "40%",
      orientation: "horizontal",
    })
    const parts = {
      root: c.root(),
      label: c.label("l"),
      "value-text": c.valueText(),
      track: c.track(),
      indicator: c.indicator(),
      circle: c.circle(),
      "circle-track": c.circleTrack(),
      "circle-indicator": c.circleIndicator(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      expect(Object.keys(progressMeta.dataAttributes[part as keyof typeof parts]).sort()).toEqual(
        keys.sort(),
      )
    }
    expect(Object.keys(progressMeta.states)).toEqual(["indeterminate", "loading", "complete"])
  })
})
