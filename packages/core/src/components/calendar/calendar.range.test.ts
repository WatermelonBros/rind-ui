// The range helpers (spec "Reusable Range Helpers", "Range Length", "Unavailable Dates In Ranges").
import { CalendarDate } from "@internationalized/date"
import { describe, expect, it } from "vitest"
import {
  availableBounds,
  canEndRange,
  crossesUnavailable,
  lengthBounds,
  makeRange,
  rangeEnds,
  rangeLength,
} from "./calendar.range"

const d = (m: number, day: number, y = 2026) => new CalendarDate(y, m, day)
const oct15 = (date: CalendarDate) => date.compare(d(10, 15)) === 0

describe("range helpers", () => {
  it("makeRange orders its ends", () => {
    expect(makeRange(d(10, 20), d(10, 10))).toEqual({ start: d(10, 10), end: d(10, 20) })
    expect(makeRange(d(10, 14), d(10, 14))).toEqual({ start: d(10, 14), end: d(10, 14) })
  })

  it("rangeLength counts both ends, per period", () => {
    expect(rangeLength(makeRange(d(10, 10), d(10, 14)))).toBe(5)
    expect(rangeLength(makeRange(d(9, 1), d(12, 1)), "month")).toBe(4)
    expect(rangeLength(makeRange(d(1, 1, 2026), d(1, 1, 2031)), "year")).toBe(6)
  })

  it("availableBounds around an anchor (spec scenario)", () => {
    const b = availableBounds(d(10, 12), oct15)
    expect(b.after).toEqual(d(10, 15))
    expect(b.before).toBeNull()
  })

  it("crossesUnavailable at month granularity (spec scenario)", () => {
    const nov = (x: CalendarDate) => x.month === 11
    expect(crossesUnavailable(makeRange(d(9, 1), d(12, 1)), nov, "month")).toBe(true)
    expect(crossesUnavailable(makeRange(d(9, 1), d(10, 1)), nov, "month")).toBe(false)
  })

  it("lengthBounds for a week at most and three nights at least", () => {
    expect(lengthBounds(d(10, 10), undefined, 7)).toMatchObject({
      earliest: d(10, 4),
      latest: d(10, 16),
    })
    expect(lengthBounds(d(10, 10), 3, undefined)).toMatchObject({
      tooCloseBefore: d(10, 8),
      tooCloseAfter: d(10, 12),
    })
  })

  it("canEndRange applies length and contiguity", () => {
    expect(canEndRange(d(10, 10), d(10, 16), { maxRangeLength: 7 })).toBe(true)
    expect(canEndRange(d(10, 10), d(10, 17), { maxRangeLength: 7 })).toBe(false)
    expect(canEndRange(d(10, 10), d(10, 11), { minRangeLength: 3 })).toBe(false)
    expect(canEndRange(d(10, 10), d(10, 12), { minRangeLength: 3 })).toBe(true)
    expect(canEndRange(d(10, 12), d(10, 16), { isUnavailable: oct15 })).toBe(false)
    expect(
      canEndRange(d(10, 12), d(10, 16), { isUnavailable: oct15, allowsNonContiguousRanges: true }),
    ).toBe(true)
    expect(canEndRange(d(10, 12), d(10, 12), {})).toBe(true)
  })

  it("a range longer than a year is checked over its whole length", () => {
    const late = (x: CalendarDate) => x.compare(d(1, 20, 2028)) === 0
    expect(crossesUnavailable(makeRange(d(10, 1), d(3, 1, 2028)), late)).toBe(true)
    expect(canEndRange(d(10, 1), d(3, 1, 2028), { isUnavailable: late })).toBe(false)
  })

  it("rangeEnds finds the contiguity bounds once and agrees with canEndRange", () => {
    const ok = rangeEnds(d(10, 12), { isUnavailable: oct15, maxRangeLength: 30 })
    expect(ok(d(10, 14))).toBe(true)
    expect(ok(d(10, 15))).toBe(false)
    expect(ok(d(10, 16))).toBe(false)
    expect(ok(d(10, 1))).toBe(true)
  })
})
