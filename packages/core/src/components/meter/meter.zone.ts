// The HTML <meter> region algorithm (design §3): which of the three regions (below `low`,
// between, above `high`) holds the value, and which holds `optimum`. Pure, no DOM.

import type { RangeValue } from "../shared/range-value"

export type MeterZone = "optimum" | "suboptimum" | "even-less-good"

export interface MeterThresholds {
  readonly low?: number | undefined
  readonly high?: number | undefined
  readonly optimum?: number | undefined
}

type Region = "low" | "middle" | "high"

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

/**
 * The value's zone, or `undefined` when none of `low`, `high`, `optimum` is set. Bounds are
 * clamped as the HTML standard does: `low` to [min, max] (default min), `high` to [low, max]
 * (default max), `optimum` to [min, max] (default the midpoint). A value equal to `low` or
 * `high` is in the middle region.
 */
export function meterZone(r: RangeValue, t: MeterThresholds): MeterZone | undefined {
  if (t.low === undefined && t.high === undefined && t.optimum === undefined) return undefined
  const { min, max } = r
  const value = r.value ?? min
  const low = clamp(t.low ?? min, min, max)
  const high = clamp(t.high ?? max, low, max)
  const optimum = clamp(t.optimum ?? (min + max) / 2, min, max)
  const region = (n: number): Region => (n < low ? "low" : n > high ? "high" : "middle")
  const at = region(value)
  const best = region(optimum)
  if (at === best) return "optimum"
  // The middle region is adjacent to both ends; the two ends are on far sides of each other.
  return at === "middle" || best === "middle" ? "suboptimum" : "even-less-good"
}
