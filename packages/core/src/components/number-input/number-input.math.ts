// Number Input step arithmetic (design §3), on the shared step math: the next grid line in
// a direction, the empty start, clamping and no-op detection. Pure.

import { clamp, roundToStepPrecision, snap } from "../shared/step-math"

export interface NumberRange {
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly step?: number | undefined
  readonly largeStep?: number | undefined
}

/** `step` (default 1, or 0.01 for percent) and `largeStep` (default 10 × step). */
export function stepsOf(r: NumberRange, percent: boolean) {
  const step = r.step !== undefined && r.step > 0 ? r.step : percent ? 0.01 : 1
  const large = r.largeStep !== undefined && r.largeStep > 0 ? r.largeStep : step * 10
  return { step, large: roundToStepPrecision(large, step, r.min ?? 0) }
}

export const clampTo = (v: number, r: NumberRange) =>
  clamp(v, r.min ?? Number.NEGATIVE_INFINITY, r.max ?? Number.POSITIVE_INFINITY)

/**
 * The value one step from `base` in `direction`: the next line of the `min + k × step` grid
 * (an off-grid 18.98 steps up to 19, reka-ui#2758), or `size` further and snapped for a
 * large step; empty (`null`) lands on 0 clamped into the range; then clamped.
 */
export function nextStep(
  base: number | null,
  direction: 1 | -1,
  size: "step" | "large",
  r: NumberRange,
  percent = false,
): number {
  const { step, large } = stepsOf(r, percent)
  const origin = r.min ?? 0
  const round = (v: number) => roundToStepPrecision(v, step, origin)
  // Clamped, then rounded to the grid's precision: a bound with more decimals than the grid
  // (max 10.5, step 1) must not be rounded past (11 > max): back one line, inside the range.
  const inRange = (v: number) => {
    let x = round(clampTo(v, r))
    if (r.max !== undefined && x > r.max) x = round(x - step)
    if (r.min !== undefined && x < r.min) x = round(x + step)
    return x
  }
  if (base === null) return inRange(0)
  if (size === "large") return inRange(snap(base + direction * large, step, origin))
  // Grid index, with float noise removed (40.1 / 0.1 is 400.99999…).
  const k = Math.round(((base - origin) / step) * 1e9) / 1e9
  const next = direction > 0 ? Math.floor(k) + 1 : Math.ceil(k) - 1
  return inRange(origin + next * step)
}

/** Whether a step in `direction` can change `value` (false at the bound). */
export function canStep(value: number | null, direction: 1 | -1, r: NumberRange): boolean {
  if (value === null) return true
  return direction > 0 ? r.max === undefined || value < r.max : r.min === undefined || value > r.min
}

/**
 * Commit-time normalisation with `snap`: on the grid of an explicit `step`, then in range.
 * Without a `step` only the range applies (the default step drives keys and steppers, it
 * never rounds what was typed: "1.239" or "$1,234.50" stay).
 */
export function snapValue(v: number, r: NumberRange): number {
  if (r.step === undefined || !(r.step > 0)) return clampTo(v, r)
  const { step } = r
  const origin = r.min ?? 0
  // Clamped, then snapped; a snap past an off-grid max goes back one line.
  let s = snap(clampTo(v, r), step, origin)
  if (r.max !== undefined && s > r.max) s -= step
  if (r.min !== undefined && s < r.min) s += step
  return roundToStepPrecision(s, step, origin)
}
