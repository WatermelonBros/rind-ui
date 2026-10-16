// Step arithmetic shared by value controls (Slider, Number Input): decimal counting, snapping
// to a `min + k × step` grid and rounding that never drifts (base-ui#4547, bits-ui#1518,
// radix#3852). Pure.

/** Decimal places of `n`, exponent notation included (`1e-7` → 7, `1.5e-3` → 4). */
export function decimals(n: number): number {
  if (!Number.isFinite(n)) return 0
  const [mantissa = "", exponent] = String(n).toLowerCase().split("e")
  const fraction = mantissa.split(".")[1]?.length ?? 0
  return Math.max(0, fraction - Number(exponent ?? 0))
}

/** Rounds to `places` decimals through the decimal string, so `0.1 + 0.2` becomes `0.3`. */
export function roundTo(value: number, places: number): number {
  if (!Number.isFinite(value)) return value
  return Number(value.toFixed(Math.min(100, Math.max(0, places))))
}

/** Rounds to the precision of `step` and `min` (the grid's own decimals). */
export const roundToStepPrecision = (value: number, step: number, min = 0): number =>
  roundTo(value, Math.max(decimals(step), decimals(min)))

export const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(Math.max(value, lo), hi)

/** The nearest `min + k × step`, rounded to the grid's precision. */
export function snap(value: number, step: number, min = 0): number {
  if (!(step > 0)) return value
  return roundToStepPrecision(min + Math.round((value - min) / step) * step, step, min)
}

/** The highest grid value not above `max` (`max` itself when it is on the grid). */
export function gridMax(min: number, max: number, step: number): number {
  if (!(step > 0) || max <= min) return max
  const top = roundToStepPrecision(min + Math.floor((max - min) / step + 1e-9) * step, step, min)
  return top > max ? max : top
}
