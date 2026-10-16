// date-values (add-calendar): the one date and time foundation every date component shares.
// Values are @internationalized/date types only; a `Date` exists only to format with Intl.
// Only the gregorian calendar is bundled: other systems come from the consumer's
// `createCalendar` (tree-shaken otherwise).

import {
  type Calendar,
  CalendarDate,
  CalendarDateTime,
  type CalendarIdentifier,
  DateFormatter,
  type DateValue,
  fromAbsolute,
  GregorianCalendar,
  getDayOfWeek,
  toCalendar,
  toCalendarDate,
  ZonedDateTime,
} from "@internationalized/date"
import type { DateClock } from "../env/capabilities"

declare const process: { env: { NODE_ENV?: string } }

export {
  type Calendar,
  CalendarDate,
  CalendarDateTime,
  type DateValue,
  isSameDay,
  isSameMonth,
  isWeekend,
  parseDate,
  parseDateTime,
  parseTime,
  parseZonedDateTime,
  Time,
  ZonedDateTime,
} from "@internationalized/date"

/** A weekday name: the first day of the week is never an index (reka-ui#2264). */
export type DayOfWeek = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
const DAYS: readonly DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

/** The consumer's calendar factory (`createCalendar` from @internationalized/date, or a subset). */
export type CreateCalendar = (identifier: CalendarIdentifier) => Calendar

export interface ResolvedCalendar {
  readonly calendar: Calendar
  /** The locale to format with: the requested one, or forced to gregorian on a fallback. */
  readonly formatLocale: string
}

const warned = new Set<string>()
function warnOnce(message: string) {
  if (process.env.NODE_ENV === "production" || warned.has(message)) return
  warned.add(message)
  console.warn(`[rind-ui] date: ${message}`)
}

/** The locale's calendar system, through `createCalendar` when it is not gregorian. */
export function resolveCalendar(locale: string, createCalendar?: CreateCalendar): ResolvedCalendar {
  const identifier = new Intl.DateTimeFormat(locale).resolvedOptions().calendar
  if (identifier === "gregory" || identifier === "iso8601") {
    return { calendar: new GregorianCalendar(), formatLocale: locale }
  }
  const gregorian = (): ResolvedCalendar => ({
    calendar: new GregorianCalendar(),
    formatLocale: withCalendar(locale, "gregory"),
  })
  if (!createCalendar) {
    warnOnce(
      `the ${identifier} calendar of "${locale}" needs \`createCalendar\`; showing gregorian.`,
    )
    return gregorian()
  }
  // Never throws (react-spectrum#8017): an unsupported system (a throw, or a factory that
  // answers with another system) falls back with a warning.
  let calendar: Calendar | null = null
  try {
    // Sound: an identifier the factory does not know is answered by a throw or another
    // system, both handled below.
    calendar = createCalendar(identifier as CalendarIdentifier)
  } catch {}
  if (calendar && calendar.identifier === identifier) return { calendar, formatLocale: locale }
  warnOnce(`the ${identifier} calendar of "${locale}" is not supported; showing gregorian.`)
  return gregorian()
}

/** `locale` with its `-u-ca-` extension set to `calendar`. */
function withCalendar(locale: string, calendar: string): string {
  try {
    return new Intl.Locale(locale, { calendar }).toString()
  } catch {
    return `${locale}-u-ca-${calendar}`
  }
}

/** Today: the clock's instant in `zone`, else the clock's own zone (ark#2270). */
export function today(clock: DateClock, zone?: string): CalendarDate {
  return toCalendarDate(fromAbsolute(clock.now(), zone ?? clock.timeZone()))
}

/** The zone "today" is read in: the prop, then a zoned value's own zone, then the clock's. */
export function todayZone(
  prop: string | undefined,
  value: DateValue | readonly DateValue[] | null | undefined,
): string | undefined {
  if (prop) return prop
  const first = Array.isArray(value) ? value[0] : value
  return first instanceof ZonedDateTime ? first.timeZone : undefined
}

// A known Sunday: its index in the locale's week names the locale's first day.
const SUNDAY = new CalendarDate(2026, 10, 11)

/** The first day of the week: the prop, else the locale's (CLDR week data). */
export function firstDayOfWeek(locale: string, prop?: DayOfWeek): DayOfWeek {
  if (prop) return prop
  const index = getDayOfWeek(SUNDAY, locale)
  return DAYS[(7 - index) % 7] ?? "sun"
}

const formatters = new Map<string, DateFormatter>()

/** A cached formatter per locale and options (calendar and zone included in the options). */
export function dateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
): DateFormatter {
  const key = `${locale}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new DateFormatter(locale, options)
    formatters.set(key, f)
  }
  return f
}

/** A `Date` for formatting only: the date's own day, at noon UTC (no host-zone shift). */
function formatDate(date: CalendarDate): Date {
  const g = toCalendar(date, new GregorianCalendar())
  return new Date(Date.UTC(g.year, g.month - 1, g.day, 12))
}

/** The day number a cell shows: the `day` part only (react-spectrum#4135: "14", not "14日"). */
export function dayText(date: CalendarDate, locale: string, calendar: Calendar): string {
  const f = dateFormatter(locale, {
    day: "numeric",
    calendar: calendar.identifier,
    timeZone: "UTC",
  })
  return f.formatToParts(formatDate(date)).find((p) => p.type === "day")?.value ?? String(date.day)
}

/** The full date a cell is named by ("Wednesday, October 14, 2026"), with the era when needed. */
export function fullDate(date: CalendarDate, locale: string, calendar: Calendar): string {
  const g = toCalendar(date, new GregorianCalendar())
  // Eras where a year alone is ambiguous: several eras, or BC in gregorian.
  const era =
    calendar.getEras().length > 1 && calendar.identifier !== "gregory"
      ? "short"
      : g.era === "BC"
        ? "short"
        : undefined
  return dateFormatter(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(era ? { era } : {}),
    calendar: calendar.identifier,
    timeZone: "UTC",
  }).format(formatDate(date))
}

/** A month and year ("October 2026"), or a range of months ("October – November 2026"). */
export function formatVisibleRange(
  start: CalendarDate,
  end: CalendarDate,
  locale: string,
  calendar: Calendar,
): string {
  const f = dateFormatter(locale, {
    month: "long",
    year: "numeric",
    calendar: calendar.identifier,
    timeZone: "UTC",
  })
  const a = formatDate(start)
  if (start.year === end.year && start.month === end.month && start.era === end.era)
    return f.format(a)
  return f.formatRange(a, formatDate(end))
}

/**
 * The value to emit for a chosen `date` (in the display calendar): the type, calendar and time
 * of day of `base` (the current value, default value or placeholder), else a gregorian date
 * (bits-ui#1358: the time is kept).
 */
export function toEmitted(date: CalendarDate, base: DateValue | null | undefined): DateValue {
  const calendar = base?.calendar ?? new GregorianCalendar()
  const day = toCalendar(date, calendar)
  if (base instanceof CalendarDateTime || base instanceof ZonedDateTime) {
    return base.set({ era: day.era, year: day.year, month: day.month, day: day.day })
  }
  return day
}

/** The ISO 8601 text of a value (gregorian; with offset and zone for a ZonedDateTime). */
export const serialise = (value: DateValue): string => value.toString()
