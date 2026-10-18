import { CalendarDate, CalendarDateTime, parseZonedDateTime } from "@internationalized/date"
import { describe, expect, it } from "vitest"
import { draftFocus, pickedValue } from "./date-picker"

const oct20 = new CalendarDate(2026, 10, 20)

describe("pickedValue", () => {
  it("keeps the current value's time of day", () => {
    const v = pickedValue(oct20, new CalendarDateTime(2026, 10, 14, 9, 30), null, "minute")
    expect(v.toString()).toBe("2026-10-20T09:30:00")
  })
  it("keeps the zone", () => {
    const v = pickedValue(
      oct20,
      parseZonedDateTime("2026-10-14T09:30[Europe/Rome]"),
      null,
      "minute",
    )
    expect(v.toString()).toBe("2026-10-20T09:30:00+02:00[Europe/Rome]")
  })
  it("no value: a CalendarDate at day, midnight at a time granularity", () => {
    expect(pickedValue(oct20, null, null, "day").toString()).toBe("2026-10-20")
    expect(pickedValue(oct20, null, null, "minute").toString()).toBe("2026-10-20T00:00:00")
  })
  it("no value: the placeholder's type and time", () => {
    const v = pickedValue(oct20, null, new CalendarDateTime(2026, 1, 1, 8, 0), "minute")
    expect(v.toString()).toBe("2026-10-20T08:00:00")
  })
})

describe("draftFocus", () => {
  it("year and month known: that month, the day clamped", () => {
    const f = draftFocus({ year: 2027, month: 2, day: null }, new CalendarDate(2026, 10, 31))
    expect(f?.toString()).toBe("2027-02-28")
  })
  it("no month: nothing to follow", () => {
    expect(draftFocus({ year: 2027, month: null, day: null }, oct20)).toBeNull()
  })
})
