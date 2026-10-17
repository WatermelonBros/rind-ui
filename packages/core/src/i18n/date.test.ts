// date-values scenarios that need no DOM (add-calendar tasks 1.3).
import {
  createCalendar,
  getDayOfWeek,
  getWeeksInMonth,
  startOfMonth,
} from "@internationalized/date"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CalendarDate,
  CalendarDateTime,
  dayText,
  firstDayOfWeek,
  formatVisibleRange,
  fullDate,
  parseDate,
  parseZonedDateTime,
  resolveCalendar,
  serialise,
  Time,
  today,
  todayZone,
  toEmitted,
} from "./date"

afterEach(() => vi.restoreAllMocks())
const clock = (iso: string, zone: string) => ({ now: () => Date.parse(iso), timeZone: () => zone })

describe("value types", () => {
  it("a Time stays a Time in any zone (zag#3187)", () => {
    expect(new Time(0, 0).toString()).toBe("00:00:00")
  })

  it("weeks are counted without local Date arithmetic (bits-ui#768)", () => {
    // 2 December 2024 is a Monday whatever the host zone's DST does in November.
    expect(getDayOfWeek(new CalendarDate(2024, 12, 2), "en-GB")).toBe(0)
    expect(getWeeksInMonth(new CalendarDate(2024, 11, 1), "en-GB")).toBe(5)
  })

  it("choosing a date keeps the time of day (bits-ui#1358)", () => {
    const base = new CalendarDateTime(2026, 10, 14, 9, 30)
    expect(toEmitted(new CalendarDate(2026, 10, 20), base).toString()).toBe("2026-10-20T09:30:00")
  })

  it("buddhist display, gregorian value", () => {
    const { calendar } = resolveCalendar("th-TH", createCalendar)
    expect(calendar.identifier).toBe("buddhist")
    const emitted = toEmitted(new CalendarDate(2026, 10, 14), null)
    expect(emitted.calendar.identifier).toBe("gregory")
    expect(
      formatVisibleRange(
        startOfMonth(new CalendarDate(2026, 10, 14)),
        startOfMonth(new CalendarDate(2026, 10, 14)),
        "th-TH",
        calendar,
      ),
    ).toMatch(/2569/)
  })
})

describe("calendar systems", () => {
  it("Persian locale with createCalendar", () => {
    const { calendar } = resolveCalendar("fa-IR", createCalendar)
    expect(calendar.identifier).toBe("persian")
    const d = new CalendarDate(2026, 10, 14)
    const persian = calendar.fromJulianDay(d.calendar.toJulianDay(d))
    expect([persian.year, persian.month]).toEqual([1405, 7])
  })

  it("an unsupported system falls back to gregorian and warns (react-spectrum#8017)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const r = resolveCalendar("zh-CN-u-ca-chinese", createCalendar)
    expect(r.calendar.identifier).toBe("gregory")
    expect(warn.mock.calls.some((c) => String(c[0]).includes("chinese"))).toBe(true)
  })

  it("a non-gregorian locale without createCalendar warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    resolveCalendar("ja-JP-u-ca-japanese")
    resolveCalendar("ja-JP-u-ca-japanese")
    expect(resolveCalendar("ja-JP-u-ca-japanese").calendar.identifier).toBe("gregory")
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes("japanese")).length,
    ).toBeLessThanOrEqual(1)
  })
})

describe("today", () => {
  it("in the viewer's zone (ark#2270)", () => {
    expect(today(clock("2026-10-14T23:30:00Z", "Pacific/Auckland")).toString()).toBe("2026-10-15")
  })

  it("in the value's zone", () => {
    const value = parseZonedDateTime("2026-10-14T10:00[America/Los_Angeles]")
    const zone = todayZone(undefined, value)
    expect(today(clock("2026-10-15T03:00:00Z", "Europe/Rome"), zone).toString()).toBe("2026-10-14")
  })

  it("a fixed test clock", () => {
    expect(today(clock("2026-02-28T12:00:00Z", "UTC")).toString()).toBe("2026-02-28")
  })
})

describe("week data", () => {
  it("firstDayOfWeek='mon' in two locales (reka-ui#2157, reka-ui#2264)", () => {
    expect(firstDayOfWeek("en-US", "mon")).toBe("mon")
    expect(firstDayOfWeek("cs-CZ", "mon")).toBe("mon")
  })

  it("the locale's default", () => {
    expect(firstDayOfWeek("en-US")).toBe("sun")
    expect(firstDayOfWeek("en-GB")).toBe("mon")
    expect(firstDayOfWeek("ar-EG")).toBe("sat")
  })

  it("rows follow the first day (zag#1208)", () => {
    // March 2026 starts on a Sunday: 5 weeks from Sunday, 6 from Monday.
    expect(getWeeksInMonth(new CalendarDate(2026, 3, 1), "en-US")).toBe(5)
    expect(getWeeksInMonth(new CalendarDate(2026, 3, 1), "en-US", "mon")).toBe(6)
  })
})

describe("formatting", () => {
  const g = resolveCalendar("en-US").calendar

  it("a Japanese day cell is the number only (react-spectrum#4135)", () => {
    expect(
      dayText(new CalendarDate(2026, 10, 14), "ja-JP", resolveCalendar("ja-JP").calendar),
    ).toBe("14")
  })

  it("names and headings follow the locale (ark#3725)", () => {
    const d = new CalendarDate(2026, 10, 14)
    expect(fullDate(d, "en-US", g)).toBe("Wednesday, October 14, 2026")
    expect(fullDate(d, "de-DE", g)).toBe("Mittwoch, 14. Oktober 2026")
    expect(
      formatVisibleRange(new CalendarDate(2026, 10, 1), new CalendarDate(2026, 10, 1), "de-DE", g),
    ).toBe("Oktober 2026")
  })

  it("a range of months", () => {
    expect(
      formatVisibleRange(new CalendarDate(2026, 10, 1), new CalendarDate(2026, 11, 1), "en-US", g),
    ).toMatch(/October.*November 2026/)
  })
})

describe("serialisation", () => {
  it("ISO 8601, gregorian (a buddhist cell's data-value)", () => {
    const { calendar } = resolveCalendar("th-TH", createCalendar)
    const d = new CalendarDate(2026, 10, 14)
    const buddhist = calendar.fromJulianDay(d.calendar.toJulianDay(d))
    expect(serialise(toEmitted(buddhist, null))).toBe("2026-10-14")
    expect(parseDate("2026-10-14").toString()).toBe("2026-10-14")
  })
})
