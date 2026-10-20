// range-value: the machine-less value model of value displays (Progress, Meter). One pure
// function turns { value, min, max } into one clamped value, a fraction and a percent, and
// every output (ARIA attributes, value text, fill size, data attributes) is computed from it,
// so they cannot drift (RA#6402, BU PR#5095). No output ever contains NaN (RS#10042).

import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { format } from "../../i18n/messages"

declare const process: { env: { NODE_ENV?: string } }

export interface RangeValueInput {
  /** `null` / `undefined`: indeterminate. Any number, 0 included, is determinate. */
  readonly value?: number | null | undefined
  /** Default 0. */
  readonly min?: number | undefined
  /** Default 100. */
  readonly max?: number | undefined
}

export interface RangeValue {
  /** The clamped value in the consumer's units; `null` when indeterminate. */
  readonly value: number | null
  readonly min: number
  readonly max: number
  /** 0–1; 0 when indeterminate or the range is empty. */
  readonly fraction: number
  /** 0–100. */
  readonly percent: number
}

export interface RangeValueTextArgs {
  readonly value: number
  readonly percent: number
  /** The value formatted for the locale and format options. */
  readonly formatted: string
}

/** The default number format: a percent of the range. */
export const percentFormat: Intl.NumberFormatOptions = { style: "percent" }

/**
 * Normalises the value. `scope` names the component in development warnings (an empty or
 * non-finite range: fraction 0; a value outside the range: clamped, never indeterminate);
 * without it the call is silent (a machine guard re-reading the same props).
 */
export function resolveRangeValue(input: RangeValueInput, scope?: string): RangeValue {
  const rawMin = input.min ?? 0
  const rawMax = input.max ?? 100
  const min = Number.isFinite(rawMin) ? rawMin : 0
  const max = Number.isFinite(rawMax) ? rawMax : min
  const empty = !(max > min)
  if (scope !== undefined && process.env.NODE_ENV !== "production" && empty) {
    console.warn(
      `[rind-ui] ${scope}: the range min=${rawMin} max=${rawMax} is empty or not finite; max must be greater than min`,
    )
  }
  const raw = input.value
  if (raw === null || raw === undefined || Number.isNaN(raw)) {
    return { value: null, min, max, fraction: 0, percent: 0 }
  }
  const clamped = Math.min(Math.max(raw, min), Math.max(min, max))
  if (scope !== undefined && process.env.NODE_ENV !== "production" && clamped !== raw) {
    console.warn(`[rind-ui] ${scope}: value ${raw} is outside ${min}–${max}; it is clamped`)
  }
  const fraction = empty ? 0 : (clamped - min) / (max - min)
  return { value: clamped, min, max, fraction, percent: fraction * 100 }
}

/**
 * The value text, the same string for `aria-valuetext` and the visible ValueText. A percent
 * style formats the fraction, any other style the clamped value; then `valueText` (the
 * component's message) gets the result. `undefined` when indeterminate.
 */
export function rangeValueText<A extends RangeValueTextArgs>(
  r: RangeValue,
  options: {
    readonly locale: string
    readonly formatOptions?: Intl.NumberFormatOptions | undefined
  },
  valueText: (args: A) => string,
  extra?: Omit<A, keyof RangeValueTextArgs>,
): string | undefined {
  if (r.value === null) return undefined
  const fo = options.formatOptions ?? percentFormat
  const formatted = format
    .number(options.locale, fo)
    .format(fo.style === "percent" ? r.fraction : r.value)
  // `extra` carries the component's own arguments (Meter's zone): A is exactly both halves.
  return valueText({ value: r.value, percent: r.percent, formatted, ...extra } as A)
}

/** The ARIA value attributes: never an `aria-label`, `aria-valuenow` only when determinate. */
export function rangeValueAttributes(r: RangeValue, text: string | undefined) {
  return {
    "aria-valuemin": r.min,
    "aria-valuemax": r.max,
    "aria-valuenow": r.value ?? undefined,
    "aria-valuetext": r.value === null ? undefined : text,
  }
}

export type RangeOrientation = "horizontal" | "vertical"

/**
 * The fill: `--rind-<scope>-percent` (unitless 0–100) and the size along the orientation,
 * `0%` included. Nothing when indeterminate, so the theme draws its own segment.
 */
export function rangeFillStyle(scope: string, r: RangeValue, orientation: RangeOrientation) {
  if (r.value === null) return undefined
  const size = `${r.percent}%`
  return {
    [`--rind-${scope}-percent`]: String(r.percent),
    ...(orientation === "vertical" ? { "block-size": size } : { "inline-size": size }),
  }
}

/**
 * The quirk `nvda-progressbar-name` (BU#4184, nvda#13904): NVDA drops the name of a
 * progressbar or meter with no text content, so Root's last child is one visually hidden,
 * presentational character. Rendered on the server too.
 */
export const rangeFillerProps = {
  role: "presentation",
  style: visuallyHiddenStyle,
  children: "x",
} as const

/** Development: a progressbar or meter needs a name, unless the whole Root is `aria-hidden`. */
export function checkRangeName(
  scope: "progress" | "meter",
  own: Readonly<Record<string, unknown>>,
  hasLabel: boolean,
): void {
  if (process.env.NODE_ENV === "production" || hasLabel) return
  const named =
    (typeof own["aria-label"] === "string" && own["aria-label"] !== "") ||
    (typeof own["aria-labelledby"] === "string" && own["aria-labelledby"] !== "")
  const hidden = own["aria-hidden"] === true || own["aria-hidden"] === "true"
  if (named || hidden) return
  console.error(
    `[rind-ui] ${scope}: Root has no accessible name: render a ${scope === "progress" ? "Progress" : "Meter"}.Label, pass aria-label or aria-labelledby, or aria-hidden="true" when it is decorative`,
  )
}
