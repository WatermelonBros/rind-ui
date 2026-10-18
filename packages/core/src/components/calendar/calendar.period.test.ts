// period-navigation (spec): pages, moves and constraints, without a DOM or the current time.
import { CalendarDate, createCalendar, toCalendar } from "@internationalized/date"
import { describe, expect, it } from "vitest"
import {
  canPagePeriod,
  clampView,
  movePeriod,
  type PeriodOptions,
  pageOf,
  periodAllowed,
} from "./calendar.period"

const o = (extra: Partial<PeriodOptions> = {}): PeriodOptions => ({
  minValue: null,
  maxValue: null,
  ...extra,
})
const d = (y: number, m: number, day = 1) => new CalendarDate(y, m, day)
const hebrew = createCalendar("hebrew")
const japanese = createCalendar("japanese")
const s = (x: CalendarDate) => x.toString()

describe("pages and grid shape", () => {
  it("Twelve months in three rows", () => {
    expect(pageOf(d(2026, 5), "months", o())).toHaveLength(12)
  })

  it("Thirteen months (hebrew leap year)", () => {
    const at = toCalendar(d(2024, 1, 15), hebrew)
    expect(at.year).toBe(5784)
    expect(pageOf(at, "months", o())).toHaveLength(13)
  })

  it("Fixed year pages", () => {
    const page = pageOf(d(2026, 1), "years", o())
    expect([page[0]?.year, page.at(-1)?.year]).toEqual([2016, 2027])
    let at = d(2026, 1)
    at = movePeriod(at, "years", "next-page", o())
    expect(pageOf(at, "years", o())[0]?.year).toBe(2028)
    at = movePeriod(at, "years", "previous-page", o())
    expect(pageOf(at, "years", o())[0]?.year).toBe(2016)
  })

  it("Era boundary (japanese)", () => {
    const heisei = toCalendar(d(2019, 1, 15), japanese)
    const page = pageOf(heisei, "years", o())
    expect(page.at(-1)?.era).toBe("heisei")
    expect(page.at(-1)?.year).toBe(31)
    const next = movePeriod(page.at(-1) as CalendarDate, "years", "next", o())
    expect([next.era, next.year]).toEqual(["reiwa", 1])
  })

  it("BC years: a page never mixes eras and runs in time order", () => {
    const page = pageOf(new CalendarDate("BC", 3, 1, 1), "years", o())
    expect(page.every((p) => p.era === "BC")).toBe(true)
    expect(page.map((p) => p.year)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
  })
})

describe("moves", () => {
  it("Right across the year boundary", () => {
    expect(s(movePeriod(d(2026, 12), "months", "next", o()))).toBe("2027-01-01")
  })

  it("Down keeps the column (reka-ui#2781)", () => {
    expect(s(movePeriod(d(2026, 3), "months", "next-row", o({ columns: 3 })))).toBe("2026-06-01")
  })

  it("Down from the last row", () => {
    expect(s(movePeriod(d(2026, 11), "months", "next-row", o()))).toBe("2027-03-01")
  })

  it("Short last row (13 months)", () => {
    const leap = toCalendar(d(2024, 1, 15), hebrew).set({ day: 1 })
    const thirteenth = leap.set({ month: 13 })
    const next = movePeriod(thirteenth, "months", "next-row", o())
    expect([next.year, next.month]).toEqual([5785, 1])
    const twelfth = leap.set({ month: 12 })
    expect(movePeriod(twelfth, "months", "next-row", o()).month).toBe(13)
  })

  it("Page keeps the month", () => {
    expect(s(movePeriod(d(2026, 10), "months", "next-page", o()))).toBe("2027-10-01")
    const leap13 = toCalendar(d(2024, 1, 15), hebrew).set({ month: 13, day: 1 })
    const next = movePeriod(leap13, "months", "next-page", o())
    expect([next.year, next.month]).toEqual([5785, 12])
  })

  it("First and last", () => {
    expect(movePeriod(d(2021, 1), "years", "last", o()).year).toBe(2027)
    expect(movePeriod(d(2021, 1), "years", "first", o()).year).toBe(2016)
  })
})

describe("constraints on moves", () => {
  it("Min and max within two adjacent years (zag#2153)", () => {
    const c = o({ minValue: d(2025, 12, 15), maxValue: d(2026, 2, 20) })
    expect(periodAllowed(d(2025, 1), "years", c)).toBe(true)
    expect(periodAllowed(d(2026, 1), "years", c)).toBe(true)
    expect(periodAllowed(d(2024, 1), "years", c)).toBe(false)
    expect(periodAllowed(d(2027, 1), "years", c)).toBe(false)
  })

  it("Month containing the minimum", () => {
    const c = o({ minValue: d(2026, 10, 15) })
    expect(periodAllowed(d(2026, 10), "months", c)).toBe(true)
    expect(periodAllowed(d(2026, 9), "months", c)).toBe(false)
  })

  it("Arrow past the minimum", () => {
    const c = o({ minValue: d(2026, 10, 15) })
    expect(s(movePeriod(d(2026, 10), "months", "previous", c))).toBe("2026-10-01")
  })

  it("Unavailable stays reachable (moves ignore availability)", () => {
    expect(s(movePeriod(d(2026, 4), "months", "next", o()))).toBe("2026-05-01")
  })

  it("Pages without allowed periods are not reachable", () => {
    const c = o({ maxValue: d(2026, 6, 1) })
    expect(canPagePeriod(d(2026, 3), "months", 1, c)).toBe(false)
    expect(canPagePeriod(d(2026, 3), "months", -1, c)).toBe(true)
  })
})

describe("views", () => {
  it("clampView keeps the view inside [minView, maxView]", () => {
    expect(clampView("days", "months", "years")).toBe("months")
    expect(clampView("years", "days", "months")).toBe("months")
  })
})
