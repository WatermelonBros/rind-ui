import { describe, expect, it } from "vitest"
import { resolveRangeValue } from "../shared/range-value"
import { meterConnect } from "./meter.connect"
import { meterContract } from "./meter.contract"
import { meterMeta } from "./meter.meta"

describe("meter meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(meterMeta.contract.actions)).toEqual(Object.keys(meterContract.actions))
    expect(meterMeta.contract.queries).toEqual(Object.keys(meterContract.queries))
    expect(meterMeta.contract.traits).toEqual(meterContract.traits)
  })
  it("data attributes (with a zone)", () => {
    const c = meterConnect({
      instance: "i",
      range: resolveRangeValue({ value: 10 }),
      zone: "optimum",
      text: "10%",
      orientation: "horizontal",
    })
    const parts = {
      root: c.root(),
      label: c.label("l"),
      "value-text": c.valueText(),
      track: c.track(),
      indicator: c.indicator(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      expect(Object.keys(meterMeta.dataAttributes[part as keyof typeof parts]).sort()).toEqual(
        keys.sort(),
      )
    }
  })
})
