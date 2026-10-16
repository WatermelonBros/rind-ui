// Slider arithmetic (design §2): the range, neighbour bounds, collision policies, the
// nearest thumb and `settle`, the one write path every input shares. Pure: numbers in,
// numbers out; no layout.

import { clamp, gridMax, roundToStepPrecision, snap } from "../shared/step-math"

declare const process: { env: { NODE_ENV?: string } }

export type SliderOrientation = "horizontal" | "vertical"
export type ThumbCollision = "stop" | "push" | "swap"
export type ThumbAlignment = "center" | "contain"

export interface SliderRangeInput {
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly step?: number | undefined
  readonly largeStep?: number | undefined
  readonly minStepsBetweenThumbs?: number | undefined
}

/** The resolved range: `max` is the track's end, `top` the highest value on the grid. */
export interface SliderRange {
  readonly min: number
  readonly max: number
  readonly top: number
  readonly step: number
  readonly largeStep: number
  /** The minimum distance between neighbouring thumbs, in value units. */
  readonly gap: number
}

const warned = new Set<string>()
/** A development warning, once per message. */
export function warnOnce(message: string, error = false): void {
  if (process.env.NODE_ENV === "production" || warned.has(message)) return
  warned.add(message)
  if (error) console.error(`[rind-ui] slider: ${message}`)
  else console.warn(`[rind-ui] slider: ${message}`)
}

const finite = (n: number | undefined, fallback: number) =>
  n !== undefined && Number.isFinite(n) ? n : fallback

export function sliderRange(p: SliderRangeInput): SliderRange {
  const min = finite(p.min, 0)
  const max = finite(p.max, 100)
  const rawStep = finite(p.step, 1)
  const step = rawStep > 0 ? rawStep : 1
  if (rawStep <= 0) warnOnce(`step must be positive, got ${rawStep}`)
  if (min >= max) {
    warnOnce(`min (${min}) must be less than max (${max}); every thumb renders at min`, true)
    return { min, max: min, top: min, step, largeStep: step, gap: 0 }
  }
  const top = gridMax(min, max, step)
  if (top !== max)
    warnOnce(`max ${max} is not reachable with step ${step}; the highest value is ${top}`)
  // One tenth of the range, on the step grid, at least one step.
  const tenth = Math.max(1, Math.round((max - min) / 10 / step)) * step
  const largeStep =
    p.largeStep !== undefined && Number.isFinite(p.largeStep) && p.largeStep > 0
      ? p.largeStep
      : tenth
  const gap = roundToStepPrecision(
    Math.max(0, Math.floor(finite(p.minStepsBetweenThumbs, 0))) * step,
    step,
    min,
  )
  return { min, max, top, step, largeStep: roundToStepPrecision(largeStep, step, min), gap }
}

const round = (v: number, r: SliderRange) => roundToStepPrecision(v, r.step, r.min)

/** Snapped to the grid and clamped to the range. */
export const toGrid = (v: number, r: SliderRange): number =>
  clamp(snap(Number.isFinite(v) ? v : r.min, r.step, r.min), r.min, r.top)

/**
 * Values for rendering: on the grid, in range, sorted and at least the gap apart. Changing
 * anything warns (in development) with `label`, e.g. "defaultValue".
 */
export function normalizeValues(
  values: readonly number[],
  r: SliderRange,
  label?: string,
): number[] {
  const out = values.map((v) => toGrid(v, r)).sort((a, b) => a - b)
  const n = out.length
  for (let i = 1; i < n; i++) out[i] = round(Math.max(out[i] ?? 0, (out[i - 1] ?? 0) + r.gap), r)
  for (let i = n - 1; i >= 0; i--) {
    const ceiling = i === n - 1 ? r.top : (out[i + 1] ?? r.top) - r.gap
    out[i] = round(Math.max(r.min, Math.min(out[i] ?? r.min, ceiling)), r)
  }
  if (label !== undefined && !sameNumbers(out, values)) {
    warnOnce(
      `${label} [${values.join(", ")}] is outside the range, off the step grid, unsorted or closer than the minimum gap; rendered as [${out.join(", ")}]`,
    )
  }
  return out
}

/** A thumb's lower and upper bound: its neighbours (offset by the gap) or the range ends. */
export function thumbBounds(
  values: readonly number[],
  index: number,
  r: SliderRange,
): readonly [number, number] {
  const prev = values[index - 1]
  const next = values[index + 1]
  return [
    prev === undefined ? r.min : round(prev + r.gap, r),
    next === undefined ? r.top : round(next - r.gap, r),
  ]
}

export interface Settled {
  readonly values: readonly number[]
  /** The index that now holds the written value (differs from the input after a swap). */
  readonly index: number
}

/**
 * The one write path (BU#4547, RX#3852): snap with decimal-safe rounding, then the
 * neighbour bounds (keyboard, assistive technology, `stop`) or the collision policy.
 */
export function settle(
  values: readonly number[],
  index: number,
  next: number,
  r: SliderRange,
  policy: ThumbCollision = "stop",
): Settled {
  const v = toGrid(next, r)
  const n = values.length
  const out = [...values]
  if (policy === "push") {
    out[index] = round(clamp(v, r.min + index * r.gap, r.top - (n - 1 - index) * r.gap), r)
    for (let j = index + 1; j < n; j++) {
      out[j] = round(Math.max(out[j] ?? 0, (out[j - 1] ?? 0) + r.gap), r)
    }
    for (let j = index - 1; j >= 0; j--) {
      out[j] = round(Math.min(out[j] ?? 0, (out[j + 1] ?? 0) - r.gap), r)
    }
    return { values: out, index }
  }
  if (policy === "swap") {
    const current = values[index] ?? v
    const rest = values.filter((_, j) => j !== index)
    // Ties: moving up lands after the equal neighbours, moving down before them.
    let k = rest.findIndex((x) => (v >= current ? x > v : x >= v))
    if (k === -1) k = rest.length
    const swapped = [...rest.slice(0, k), v, ...rest.slice(k)]
    const fits = swapped.every((x, j) => j === 0 || x - (swapped[j - 1] ?? x) >= r.gap - 1e-12)
    if (fits) return { values: swapped, index: k }
  }
  const [lo, hi] = thumbBounds(values, index, r)
  out[index] = clamp(v, lo, hi)
  return { values: out, index }
}

/** The step a key moves by (`largeStep` for Shift and the page keys). */
export function keyTarget(
  key: "INCREASE" | "DECREASE" | "PAGE_PREV" | "PAGE_NEXT" | "FIRST" | "LAST",
  values: readonly number[],
  index: number,
  r: SliderRange,
  large: boolean,
): number {
  const current = values[index] ?? r.min
  const [lo, hi] = thumbBounds(values, index, r)
  switch (key) {
    case "INCREASE":
      return current + (large ? r.largeStep : r.step)
    case "DECREASE":
      return current - (large ? r.largeStep : r.step)
    // PageUp increases, PageDown decreases (RX#715).
    case "PAGE_PREV":
      return current + r.largeStep
    case "PAGE_NEXT":
      return current - r.largeStep
    case "FIRST":
      return lo
    case "LAST":
      return hi
  }
}

/** The value at a fraction of the track (snapped, in range). */
export const valueAt = (fraction: number, r: SliderRange): number =>
  toGrid(r.min + clamp(fraction, 0, 1) * (r.max - r.min), r)

/** The fraction of the track a value sits at (0 for an empty range). */
export const fractionOf = (value: number, r: SliderRange): number =>
  r.max > r.min ? clamp((value - r.min) / (r.max - r.min), 0, 1) : 0

/**
 * The thumb a press at `target` moves: the nearest enabled one; between equally near
 * thumbs at different values, the lower one; on a stack, the one that can move toward the
 * press, or `"stack"` when the press is on the stack itself (decided on the first move).
 */
export function pickThumb(
  values: readonly number[],
  target: number,
  enabled: (index: number) => boolean,
): number | "stack" | null {
  let best: number[] = []
  let distance = Number.POSITIVE_INFINITY
  values.forEach((v, i) => {
    if (!enabled(i)) return
    const d = Math.abs(v - target)
    if (d < distance - 1e-12) {
      distance = d
      best = [i]
    } else if (Math.abs(d - distance) <= 1e-12) best.push(i)
  })
  const [first] = best
  if (first === undefined) return null
  const at = values[first] ?? target
  const stack = best.filter((i) => values[i] === at)
  if (stack.length < 2) return first
  return stackPick(stack, at, target)
}

/** On a stack at `at`: the lowest thumb moves down, the highest up; on the stack: undecided. */
export function stackPick(stack: readonly number[], at: number, target: number): number | "stack" {
  if (target < at) return stack[0] ?? "stack"
  if (target > at) return stack[stack.length - 1] ?? "stack"
  return "stack"
}

/** Enabled thumbs sharing thumb `index`'s value (itself included). */
export const stackOf = (
  values: readonly number[],
  index: number,
  enabled: (i: number) => boolean,
): number[] => values.flatMap((v, i) => (v === values[index] && enabled(i) ? [i] : []))

export const sameNumbers = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
