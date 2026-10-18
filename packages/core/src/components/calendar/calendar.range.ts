// Range selection helpers (spec "Reusable Range Helpers"): pure, over CalendarDate period
// starts, with the period as an argument so the month and year views reuse them at their unit.

import type { CalendarDate } from "@internationalized/date"

export type RangePeriod = "day" | "month" | "year"

export interface DateRange<D = CalendarDate> {
  readonly start: D
  readonly end: D
}

const step = (period: RangePeriod) =>
  period === "day" ? { days: 1 } : period === "month" ? { months: 1 } : { years: 1 }

/** The period start a date belongs to. */
const startOf = (date: CalendarDate, period: RangePeriod): CalendarDate =>
  period === "day"
    ? date
    : period === "month"
      ? date.set({ day: 1 })
      : date.set({ month: 1, day: 1 })

/** The two dates in date order. */
export function makeRange(a: CalendarDate, b: CalendarDate): DateRange {
  return a.compare(b) <= 0 ? { start: a, end: b } : { start: b, end: a }
}

/** Periods from `start` to `end`, both included (1 for a one-period range). */
export function rangeLength(range: DateRange, period: RangePeriod = "day"): number {
  const a = startOf(range.start, period)
  const b = startOf(range.end, period)
  if (period === "day") return b.compare(a) + 1
  const months = (b.year - a.year) * 12 + (b.month - a.month)
  return period === "month" ? months + 1 : b.year - a.year + 1
}

/** Every period of the range, in order (bounded by `limit`). */
function* periods(range: DateRange, period: RangePeriod, limit: number) {
  let at = startOf(range.start, period)
  const end = startOf(range.end, period)
  for (let i = 0; i < limit && at.compare(end) <= 0; i++) {
    yield at
    at = at.add(step(period))
  }
}

/** Whether the range contains an unavailable period (every period of it by default). */
export function crossesUnavailable(
  range: DateRange,
  isUnavailable: (date: CalendarDate) => boolean,
  period: RangePeriod = "day",
  limit = rangeLength(range, period),
): boolean {
  for (const p of periods(range, period, limit)) if (isUnavailable(p)) return true
  return false
}

/**
 * The nearest unavailable period start before and after the anchor (null when none within
 * `limit` periods): a contiguous range from the anchor stays strictly between them.
 */
export function availableBounds(
  anchor: CalendarDate,
  isUnavailable: (date: CalendarDate) => boolean,
  period: RangePeriod = "day",
  limit = 366,
): { readonly before: CalendarDate | null; readonly after: CalendarDate | null } {
  const from = startOf(anchor, period)
  let before: CalendarDate | null = null
  let after: CalendarDate | null = null
  for (let i = 1; i <= limit && (before === null || after === null); i++) {
    if (before === null) {
      const d = from.subtract(
        period === "day" ? { days: i } : period === "month" ? { months: i } : { years: i },
      )
      if (isUnavailable(d)) before = d
    }
    if (after === null) {
      const d = from.add(
        period === "day" ? { days: i } : period === "month" ? { months: i } : { years: i },
      )
      if (isUnavailable(d)) after = d
    }
  }
  return { before, after }
}

/**
 * The dates a range from `anchor` may end on under the length bounds (both ends included):
 * `min` and `max` are lengths in periods; the result is the inclusive span around the anchor
 * that is allowed, and the dates too close to the anchor (`minRangeLength`).
 */
export function lengthBounds(
  anchor: CalendarDate,
  minRangeLength: number | undefined,
  maxRangeLength: number | undefined,
  period: RangePeriod = "day",
): {
  /** Allowed ends: inside [earliest, latest] (null: unbounded). */
  readonly earliest: CalendarDate | null
  readonly latest: CalendarDate | null
  /** Ends strictly inside (tooCloseBefore, tooCloseAfter) make a range too short. */
  readonly tooCloseBefore: CalendarDate | null
  readonly tooCloseAfter: CalendarDate | null
} {
  const from = startOf(anchor, period)
  const by = (n: number) =>
    period === "day" ? { days: n } : period === "month" ? { months: n } : { years: n }
  const max = maxRangeLength !== undefined && maxRangeLength >= 1 ? maxRangeLength : undefined
  const min = minRangeLength !== undefined && minRangeLength > 1 ? minRangeLength : undefined
  return {
    earliest: max === undefined ? null : from.subtract(by(max - 1)),
    latest: max === undefined ? null : from.add(by(max - 1)),
    tooCloseBefore: min === undefined ? null : from.subtract(by(min - 1)),
    tooCloseAfter: min === undefined ? null : from.add(by(min - 1)),
  }
}

/** The searches longer than this stop: a range that long is checked again at commit. */
const BOUNDS_LIMIT = 3660

/**
 * A checker for the ends a range from `anchor` may take, with the contiguity bounds found
 * once (spec "Unavailable Dates In Ranges"): a calendar asks it for every cell of a render.
 */
export function rangeEnds(
  anchor: CalendarDate,
  options: {
    readonly minRangeLength?: number | undefined
    readonly maxRangeLength?: number | undefined
    readonly isUnavailable?: ((date: CalendarDate) => boolean) | undefined
    readonly allowsNonContiguousRanges?: boolean | undefined
    readonly period?: RangePeriod | undefined
  },
): (end: CalendarDate) => boolean {
  const period = options.period ?? "day"
  const bounds =
    options.isUnavailable && !options.allowsNonContiguousRanges
      ? availableBounds(
          anchor,
          options.isUnavailable,
          period,
          // The farthest end that can matter: the length bound, else a decade of periods.
          options.maxRangeLength ?? BOUNDS_LIMIT,
        )
      : null
  return (end) => {
    const length = rangeLength(makeRange(anchor, end), period)
    if (options.maxRangeLength !== undefined && length > options.maxRangeLength) return false
    if (options.minRangeLength !== undefined && length < options.minRangeLength) return false
    if (bounds?.before && end.compare(bounds.before) <= 0) return false
    if (bounds?.after && end.compare(bounds.after) >= 0) return false
    return true
  }
}

/** Whether `end` may close a range started at `anchor` under length and availability rules. */
export function canEndRange(
  anchor: CalendarDate,
  end: CalendarDate,
  options: {
    readonly minRangeLength?: number | undefined
    readonly maxRangeLength?: number | undefined
    readonly isUnavailable?: ((date: CalendarDate) => boolean) | undefined
    readonly allowsNonContiguousRanges?: boolean | undefined
    readonly period?: RangePeriod | undefined
  },
): boolean {
  const period = options.period ?? "day"
  const length = rangeLength(makeRange(anchor, end), period)
  if (options.maxRangeLength !== undefined && length > options.maxRangeLength) return false
  if (options.minRangeLength !== undefined && length < options.minRangeLength) {
    // The anchor itself (a one-period range) is allowed only when the minimum is 1.
    return false
  }
  if (options.isUnavailable && !options.allowsNonContiguousRanges) {
    if (crossesUnavailable(makeRange(anchor, end), options.isUnavailable, period)) return false
  }
  return true
}
