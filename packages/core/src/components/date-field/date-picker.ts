// The Date Field picker's pure rules (date-field spec "Picker — Select And Close", "Picker —
// Typing While Open"): a calendar pick as a value of the field's own type, and the month a
// partial entry shows in the open calendar.

import {
  type CalendarDate,
  CalendarDateTime,
  type DateValue,
  toCalendar,
  toCalendarDate,
  ZonedDateTime,
} from "@internationalized/date"
import type { DateGranularity } from "../date-segments"

/**
 * The value a picked day becomes: the current value's type, calendar, time of day and zone;
 * with no value, `placeholderValue`'s; else a `CalendarDate` at granularity `day` and a
 * `CalendarDateTime` at 00:00 at a time granularity.
 */
export function pickedValue(
  date: CalendarDate,
  current: DateValue | null,
  placeholder: DateValue | null | undefined,
  granularity: DateGranularity,
): DateValue {
  const like = current ?? placeholder ?? null
  if (like === null) {
    return granularity === "day"
      ? date
      : new CalendarDateTime(date.calendar, date.era, date.year, date.month, date.day)
  }
  const day = toCalendar(date, like.calendar)
  if (like instanceof ZonedDateTime || like instanceof CalendarDateTime) {
    // Only the day moves; the time (and the zone's offset for that day) are kept.
    return like.set({ era: day.era, year: day.year, month: day.month, day: day.day })
  }
  return toCalendarDate(day)
}

/**
 * The calendar's focused date while the field holds a draft with a known year and month but
 * no complete date: that month, the focused day kept (clamped). Null: nothing to follow.
 */
export function draftFocus(
  hint: {
    readonly year: number | null
    readonly month: number | null
    readonly day: number | null
  },
  focused: CalendarDate,
): CalendarDate | null {
  if (hint.year === null || hint.month === null) return null
  return focused.set({ year: hint.year, month: hint.month })
}

/** The day a value falls on (what the calendar shows and focuses). */
export const dayOf = (value: DateValue): CalendarDate => toCalendarDate(value)
