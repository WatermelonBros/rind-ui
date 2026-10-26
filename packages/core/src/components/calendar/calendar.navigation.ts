// calendar-navigation (add-calendar §2): the focused date and the visible months as pure date
// logic over CalendarDates in the display calendar — no DOM, no current time. Month and year
// moves use the calendar system's own month lengths (@internationalized/date constrains days).

import {
  type CalendarDate,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  toCalendar,
} from "@internationalized/date"
import type { DayOfWeek } from "../../i18n/date"

export type CalendarMove =
  | "next-day"
  | "previous-day"
  | "next-week"
  | "previous-week"
  | "week-start"
  | "week-end"
  | "next-month"
  | "previous-month"
  | "next-year"
  | "previous-year"

export interface NavigationOptions {
  readonly visibleMonths: number
  readonly pageBehavior: "visible" | "single"
  readonly minValue: CalendarDate | null
  readonly maxValue: CalendarDate | null
  readonly locale: string
  readonly firstDayOfWeek: DayOfWeek
}

export interface NavigationState {
  readonly focused: CalendarDate
  /** The first day of the first visible month. */
  readonly visibleStart: CalendarDate
}

const inCalendar = (d: CalendarDate | null, like: CalendarDate) =>
  d === null ? null : toCalendar(d, like.calendar)

/** `date` inside [minValue, maxValue] (inclusive). */
export function clamp(date: CalendarDate, o: Pick<NavigationOptions, "minValue" | "maxValue">) {
  const min = inCalendar(o.minValue, date)
  const max = inCalendar(o.maxValue, date)
  if (min && date.compare(min) < 0) return min
  // Min after max (a development warning says so): min is the one fixed point, or a
  // controlled focus would bounce between the two forever.
  if (max && date.compare(max) > 0) return min && min.compare(max) > 0 ? min : max
  return date
}

/** The first day of the last visible month. */
export const lastVisibleMonth = (
  visibleStart: CalendarDate,
  o: Pick<NavigationOptions, "visibleMonths">,
) => visibleStart.add({ months: o.visibleMonths - 1 })

/** The last visible day. */
export const visibleEnd = (
  visibleStart: CalendarDate,
  o: Pick<NavigationOptions, "visibleMonths">,
) => lastVisibleMonth(visibleStart, o).add({ months: 1 }).subtract({ days: 1 })

/** The visible range after the focus moved: unchanged while visible, else aligned to it. */
export function align(
  focused: CalendarDate,
  visibleStart: CalendarDate,
  o: Pick<NavigationOptions, "visibleMonths">,
): CalendarDate {
  const month = startOfMonth(focused)
  if (month.compare(visibleStart) < 0) return month.subtract({ months: o.visibleMonths - 1 })
  if (month.compare(lastVisibleMonth(visibleStart, o)) > 0) return month
  return visibleStart
}

function target(focused: CalendarDate, m: CalendarMove, o: NavigationOptions): CalendarDate {
  switch (m) {
    case "next-day":
      return focused.add({ days: 1 })
    case "previous-day":
      return focused.subtract({ days: 1 })
    case "next-week":
      return focused.add({ weeks: 1 })
    case "previous-week":
      return focused.subtract({ weeks: 1 })
    case "week-start":
      return startOfWeek(focused, o.locale, o.firstDayOfWeek)
    case "week-end":
      return endOfWeek(focused, o.locale, o.firstDayOfWeek)
    case "next-month":
      return focused.add({ months: 1 })
    case "previous-month":
      return focused.subtract({ months: 1 })
    case "next-year":
      return focused.add({ years: 1 })
    case "previous-year":
      return focused.subtract({ years: 1 })
    default: {
      const never: never = m
      return never
    }
  }
}

/** One move: clamped to the constraints (unavailable dates stay reachable), range aligned. */
export function move(
  state: NavigationState,
  m: CalendarMove,
  o: NavigationOptions,
): NavigationState {
  const focused = clamp(target(state.focused, m, o), o)
  return { focused, visibleStart: align(focused, state.visibleStart, o) }
}

const months = (o: NavigationOptions) => (o.pageBehavior === "single" ? 1 : o.visibleMonths)

/** Whether paging in `direction` stays inside the months of the constraints. */
export function canPage(visibleStart: CalendarDate, direction: 1 | -1, o: NavigationOptions) {
  if (direction > 0) {
    const max = inCalendar(o.maxValue, visibleStart)
    return !max || lastVisibleMonth(visibleStart, o).compare(startOfMonth(max)) < 0
  }
  const min = inCalendar(o.minValue, visibleStart)
  return !min || visibleStart.compare(startOfMonth(min)) > 0
}

/** A page: the range and the focus by `visibleMonths` (or one month); null when blocked. */
export function page(
  state: NavigationState,
  direction: 1 | -1,
  o: NavigationOptions,
): NavigationState | null {
  if (!canPage(state.visibleStart, direction, o)) return null
  const n = months(o) * direction
  let visibleStart = state.visibleStart.add({ months: n })
  // Never start before the minimum's month or end after the maximum's.
  const min = inCalendar(o.minValue, visibleStart)
  const max = inCalendar(o.maxValue, visibleStart)
  if (max) {
    const latest = startOfMonth(max).subtract({ months: o.visibleMonths - 1 })
    if (visibleStart.compare(latest) > 0) visibleStart = latest
  }
  if (min && visibleStart.compare(startOfMonth(min)) < 0) visibleStart = startOfMonth(min)
  let focused = clamp(state.focused.add({ months: n }), o)
  // The focus stays inside the new range.
  if (focused.compare(visibleStart) < 0) focused = clamp(visibleStart, o)
  const end = visibleEnd(visibleStart, o)
  if (focused.compare(end) > 0) focused = clamp(end, o)
  return { focused, visibleStart }
}

/** The first focus: the value (or the first one), else today, clamped; its month visible first. */
export function initialFocus(
  value: CalendarDate | null,
  today: CalendarDate,
  o: NavigationOptions,
): NavigationState {
  const focused = clamp(value ?? today, o)
  return { focused, visibleStart: startOfMonth(focused) }
}
