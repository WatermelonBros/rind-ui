// Angle Slider's value space (add-angle-slider design §1): degrees in [0, 360), on a grid of
// `step` from 0, the announced max the largest reachable value (Zag announces 360, uses 359).

import { gridMax, snap } from "../shared/step-math"

/** The largest value on the grid below 360. */
export function angleMax(step: number): number {
  const top = gridMax(0, 360, step)
  return top >= 360 ? 360 - step : top
}

/** Any number of degrees, normalised to [0, 360) and snapped to the nearest step. */
export function normalizeAngle(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0
  const v = snap(((value % 360) + 360) % 360, step)
  return v > angleMax(step) ? 0 : v
}

/** `value` moved by `k` steps: wrapping around the grid, or clamped to it. */
export function stepAngle(value: number, k: number, step: number, wrap: boolean): number {
  const max = angleMax(step)
  const n = Math.round(max / step) + 1
  const i = Math.round(normalizeAngle(value, step) / step) + k
  const j = wrap ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1)
  return normalizeAngle(j * step, step)
}
