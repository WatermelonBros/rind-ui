// add-meter 1.1: every optimum position × value region, the boundaries, clamped and missing
// thresholds, no thresholds.
import { describe, expect, it } from "vitest"
import { resolveRangeValue } from "../shared/range-value"
import { type MeterThresholds, meterZone } from "./meter.zone"

const zone = (value: number, t: MeterThresholds, min = 0, max = 100) =>
  meterZone(resolveRangeValue({ value, min, max }), t)

describe("meterZone", () => {
  const battery = { low: 20, high: 80, optimum: 100 }
  const disk = { low: 20, high: 80, optimum: 0 }
  const middle = { low: 20, high: 80, optimum: 50 }

  it.each([
    ["higher is better", battery, 10, "even-less-good"],
    ["higher is better", battery, 50, "suboptimum"],
    ["higher is better", battery, 90, "optimum"],
    ["lower is better", disk, 10, "optimum"],
    ["lower is better", disk, 50, "suboptimum"],
    ["lower is better", disk, 90, "even-less-good"],
    ["middle is best", middle, 10, "suboptimum"],
    ["middle is best", middle, 50, "optimum"],
    ["middle is best", middle, 90, "suboptimum"],
  ] as const)("%s: value %d → %s", (_, t, value, expected) => {
    expect(zone(value, t)).toBe(expected)
  })

  it("value === low or high is in the middle region", () => {
    expect(zone(20, battery)).toBe("suboptimum")
    expect(zone(80, battery)).toBe("suboptimum")
    expect(zone(20, middle)).toBe("optimum")
  })

  it("missing thresholds default as HTML: low=min, high=max, optimum=midpoint", () => {
    expect(zone(10, { optimum: 100 })).toBe("optimum")
    expect(zone(10, { low: 30 })).toBe("suboptimum")
    expect(zone(90, { high: 70 })).toBe("suboptimum")
  })

  it("clamped thresholds: high below low becomes low, optimum outside the range is clamped", () => {
    expect(zone(50, { low: 60, high: 40, optimum: 500 })).toBe("even-less-good")
    expect(zone(70, { low: 60, high: 40, optimum: 500 })).toBe("optimum")
  })

  it("no thresholds: no zone", () => {
    expect(zone(50, {})).toBeUndefined()
  })
})
