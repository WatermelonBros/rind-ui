// calendar-navigation and the month grid in Node (tasks 2.2).
import { CalendarDate, createCalendar, toCalendar } from "@internationalized/date"
import { describe, expect, it } from "vitest"
import { inMonth, monthGrid } from "./calendar.grid"
import { canPage, initialFocus, move, type NavigationOptions, page } from "./calendar.navigation"

const o = (over: Partial<NavigationOptions> = {}): NavigationOptions => ({
  visibleMonths: 1,
  pageBehavior: "visible",
  minValue: null,
  maxValue: null,
  locale: "en-US",
  firstDayOfWeek: "sun",
  ...over,
})
const d = (y: number, m: number, day: number) => new CalendarDate(y, m, day)
const at = (focused: CalendarDate, visibleStart = d(focused.year, focused.month, 1)) => ({
  focused,
  visibleStart,
})

describe("moves", () => {
  it("month end clamps (APG)", () => {
    expect(move(at(d(2026, 1, 31)), "next-month", o()).focused.toString()).toBe("2026-02-28")
  })

  it("leap day to the next year", () => {
    expect(move(at(d(2028, 2, 29)), "next-year", o()).focused.toString()).toBe("2029-02-28")
  })

  it("week start with Monday weeks", () => {
    expect(
      move(at(d(2026, 10, 18)), "week-start", o({ firstDayOfWeek: "mon" })).focused.toString(),
    ).toBe("2026-10-12")
  })

  it("week edges with Sunday weeks (APG Home/End)", () => {
    expect(move(at(d(2026, 10, 14)), "week-start", o()).focused.toString()).toBe("2026-10-11")
    expect(move(at(d(2026, 10, 14)), "week-end", o()).focused.toString()).toBe("2026-10-17")
  })

  it("hebrew leap year: 30 Shevat → 30 Adar I", () => {
    const hebrew = createCalendar("hebrew")
    // 5784 is a leap year; Shevat is month 5, Adar I month 6.
    const shevat = toCalendar(d(2024, 2, 9), hebrew)
    expect([shevat.month, shevat.day]).toEqual([5, 30])
    const next = move(at(shevat), "next-month", o()).focused
    expect([next.month, next.day]).toEqual([6, 30])
  })

  it("buddhist, persian and islamic-umalqura month lengths come from the system", () => {
    for (const id of ["buddhist", "persian", "islamic-umalqura"] as const) {
      const c = createCalendar(id)
      const start = toCalendar(d(2026, 10, 14), c)
      const next = move(at(start), "next-month", o()).focused
      expect(next.calendar.identifier).toBe(id)
      expect(next.month === start.month + 1 || (start.month === 12 && next.month === 1)).toBe(true)
    }
  })
})

describe("constraints", () => {
  it("an arrow past the minimum stays", () => {
    expect(
      move(
        at(d(2026, 10, 10)),
        "previous-day",
        o({ minValue: d(2026, 10, 10) }),
      ).focused.toString(),
    ).toBe("2026-10-10")
  })

  it("a month move clamps to the maximum", () => {
    expect(
      move(at(d(2026, 10, 25)), "next-month", o({ maxValue: d(2026, 11, 20) })).focused.toString(),
    ).toBe("2026-11-20")
  })

  it("an arrow crosses the month and the range follows", () => {
    const next = move(at(d(2026, 10, 31)), "next-day", o())
    expect(next.focused.toString()).toBe("2026-11-01")
    expect(next.visibleStart.toString()).toBe("2026-11-01")
  })
})

describe("visible range", () => {
  it("moving within two visible months keeps them", () => {
    const next = move(at(d(2026, 10, 31)), "next-day", o({ visibleMonths: 2 }))
    expect(next.visibleStart.toString()).toBe("2026-10-01")
  })

  it("paging two months", () => {
    const next = page(at(d(2026, 10, 14)), 1, o({ visibleMonths: 2 }))
    expect(next?.visibleStart.toString()).toBe("2026-12-01")
    expect(next?.focused.toString()).toBe("2026-12-14")
  })

  it("single page behaviour moves one month", () => {
    expect(
      page(
        at(d(2026, 10, 14)),
        1,
        o({ visibleMonths: 2, pageBehavior: "single" }),
      )?.visibleStart.toString(),
    ).toBe("2026-11-01")
  })

  it("paging blocked by the maximum", () => {
    expect(canPage(d(2026, 11, 1), 1, o({ maxValue: d(2026, 11, 20) }))).toBe(false)
    expect(page(at(d(2026, 11, 5)), 1, o({ maxValue: d(2026, 11, 20) }))).toBe(null)
    expect(canPage(d(2026, 10, 1), 1, o({ maxValue: d(2026, 11, 20) }))).toBe(true)
  })

  it("only past dates allowed (bits-ui#1262)", () => {
    const s = initialFocus(null, d(2026, 10, 14), o({ maxValue: d(2026, 6, 1) }))
    expect(s.focused.toString()).toBe("2026-06-01")
    expect(s.visibleStart.toString()).toBe("2026-06-01")
  })
})

describe("month grid", () => {
  it("October 2026 with Sunday weeks: five rows, placeholders around", () => {
    const g = monthGrid(d(2026, 10, 14), "en-US", "sun")
    expect(g.weeks).toHaveLength(5)
    expect(g.weeks[0]?.[0]?.toString()).toBe("2026-09-27")
    expect(inMonth(d(2026, 9, 27), g.month)).toBe(false)
  })

  it("fixedWeeks gives six rows; Monday weeks change the count (zag#1208)", () => {
    expect(monthGrid(d(2026, 10, 1), "en-US", "sun", true).weeks).toHaveLength(6)
    expect(monthGrid(d(2026, 3, 1), "en-US", "mon").weeks).toHaveLength(6)
    expect(monthGrid(d(2026, 3, 1), "en-US", "sun").weeks).toHaveLength(5)
  })
})
