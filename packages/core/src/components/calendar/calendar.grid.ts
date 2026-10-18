// The weeks of a month (add-calendar §1): rows of seven dates from the locale's (or the prop's)
// first day, with the adjacent months' days as placeholders; `fixedWeeks` always gives six.

import {
  type CalendarDate,
  getWeeksInMonth,
  startOfMonth,
  startOfWeek,
} from "@internationalized/date"
import type { DayOfWeek } from "../../i18n/date"

export interface MonthGrid {
  /** The first day of the month. */
  readonly month: CalendarDate
  readonly weeks: readonly (readonly CalendarDate[])[]
}

export function monthGrid(
  month: CalendarDate,
  locale: string,
  firstDayOfWeek: DayOfWeek,
  fixedWeeks = false,
): MonthGrid {
  const first = startOfMonth(month)
  const start = startOfWeek(first, locale, firstDayOfWeek)
  const count = fixedWeeks ? 6 : getWeeksInMonth(first, locale, firstDayOfWeek)
  const weeks = Array.from({ length: count }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => start.add({ days: w * 7 + d })),
  )
  return { month: first, weeks }
}

/** A date inside a grid belongs to its month (the others are placeholders). */
export const inMonth = (date: CalendarDate, month: CalendarDate) =>
  date.year === month.year && date.month === month.month && date.era === month.era
