// date-segments "Partial Values And Limits": each editable segment's own value and text,
// independent of the committed value; limits from the calendar while incomplete; steps that
// wrap without carrying; and the one conversion of a draft into a value (a real date in the
// value's type, calendar and zone, or null). Pure: segment values never pass through a `Date`.

import {
  type Calendar,
  CalendarDate,
  CalendarDateTime,
  type DateValue,
  toCalendar,
  toCalendarDateTime,
  toZoned,
  ZonedDateTime,
} from "@internationalized/date"
import type { DateSegmentType, SegmentFormat } from "./segments"

export interface SegmentEntry {
  /** null: empty, or typed text that is not yet a value ("0" in a month). */
  readonly value: number | null
  /** What the segment shows. */
  readonly text: string
}

/** The editable segments' entries (a missing entry is empty). */
export type Draft = Readonly<Partial<Record<DateSegmentType, SegmentEntry>>>

/** The kind of value a field emits, from its value or placeholder. */
export interface ValueShape {
  readonly kind: "date" | "datetime" | "zoned"
  /** The value's own calendar (it may differ from the display calendar). */
  readonly calendar: Calendar
  readonly timeZone: string
}

export function shapeOf(value: DateValue): ValueShape {
  if (value instanceof ZonedDateTime) {
    return { kind: "zoned", calendar: value.calendar, timeZone: value.timeZone }
  }
  return {
    kind: value instanceof CalendarDateTime ? "datetime" : "date",
    calendar: value.calendar,
    timeZone: "UTC",
  }
}

/** Where a draft stands. */
export type DraftState = "empty" | "incomplete" | "impossible" | "complete"

export interface Limits {
  readonly min: number
  readonly max: number
}

/** The PageUp/PageDown amounts (spec "Stepping Keys"). */
export const PAGE_STEP: Readonly<Record<DateSegmentType, number>> = {
  era: 1,
  year: 5,
  month: 2,
  day: 7,
  hour: 2,
  dayPeriod: 1,
  minute: 15,
  second: 15,
}

/** The text a segment shows for a value: names for era and day period, else locale digits. */
export function segmentText(type: DateSegmentType, n: number, f: SegmentFormat): string {
  if (type === "era") return f.eras[n]?.name ?? ""
  if (type === "dayPeriod") return f.dayPeriods[n === 1 ? 1 : 0]
  if (type === "hour" && f.hour12) return f.number("hour", n === 0 ? 12 : n)
  return f.number(type, n)
}

const entry = (type: DateSegmentType, n: number, f: SegmentFormat): SegmentEntry => ({
  value: n,
  text: segmentText(type, n, f),
})

/** The wall-clock fields of a value in the display calendar. */
function fieldsOf(value: DateValue, f: SegmentFormat) {
  const shown = toCalendar(value, f.options.calendar)
  const time =
    shown instanceof CalendarDateTime || shown instanceof ZonedDateTime
      ? shown
      : { hour: 0, minute: 0, second: 0 }
  const era = f.eras.findIndex((e) => e.id === shown.era)
  return {
    era: era < 0 ? f.eras.length - 1 : era,
    year: shown.year,
    month: shown.month,
    day: shown.day,
    hour: f.hour12 ? time.hour % 12 : time.hour,
    dayPeriod: time.hour >= 12 ? 1 : 0,
    minute: time.minute,
    second: time.second,
  } satisfies Record<DateSegmentType, number>
}

/** Every editable segment filled from a value; empty segments for null. */
export function draftOf(value: DateValue | null, f: SegmentFormat): Draft {
  if (value === null) return {}
  const fields = fieldsOf(value, f)
  return Object.fromEntries(f.editable.map((t) => [t, entry(t, fields[t], f)]))
}

/** One segment of a value (stepping an empty segment starts from the placeholder's part). */
export function partOf(type: DateSegmentType, value: DateValue, f: SegmentFormat): SegmentEntry {
  return entry(type, fieldsOf(value, f)[type], f)
}

const entryValue = (d: Draft, t: DateSegmentType) => d[t]?.value ?? null

export function draftState(d: Draft, f: SegmentFormat): "empty" | "partial" | "filled" {
  const filled = f.editable.filter((t) => entryValue(d, t) !== null).length
  if (filled === 0) return "empty"
  return filled === f.editable.length ? "filled" : "partial"
}

/** The era id a draft is in: its era segment, else the calendar's current (last) era. */
function eraId(d: Draft, f: SegmentFormat): string {
  const i = entryValue(d, "era")
  return f.eras[i ?? f.eras.length - 1]?.id ?? f.options.calendar.getEras().at(-1) ?? ""
}

/**
 * The years an era has. Asked of 1 January of its second year: an era's first day may fall
 * late in its first year, and the library counts a partial last year from the date it gets.
 */
function yearsInEra(cal: Calendar, era: string): number {
  return cal.getYearsInEra?.(new CalendarDate(cal, era, 2, 1, 1)) ?? 9999
}

/** The first day of a draft's year and month, when both are known. */
function monthStart(d: Draft, f: SegmentFormat): CalendarDate | null {
  const year = entryValue(d, "year")
  if (year === null) return null
  const cal = f.options.calendar
  const probe = new CalendarDate(cal, eraId(d, f), year, 1, 1)
  const month = entryValue(d, "month")
  if (month === null) return probe
  if (month < 1 || month > cal.getMonthsInYear(probe)) return null
  return new CalendarDate(cal, eraId(d, f), year, month, 1)
}

/**
 * A segment's limits now: the calendar's maxima while the draft is not complete (day 31
 * before the month is typed), the month's length once it is.
 */
export function limits(type: DateSegmentType, d: Draft, f: SegmentFormat): Limits {
  const cal: Calendar = f.options.calendar
  switch (type) {
    case "era":
      return { min: 0, max: Math.max(0, f.eras.length - 1) }
    case "year":
      return { min: 1, max: yearsInEra(cal, eraId(d, f)) }
    case "month": {
      const year = entryValue(d, "year")
      const months =
        year === null || draftState(d, f) !== "filled"
          ? (cal.getMaximumMonthsInYear?.() ?? 12)
          : cal.getMonthsInYear(new CalendarDate(cal, eraId(d, f), year, 1, 1))
      return { min: 1, max: months }
    }
    case "day": {
      const start = draftState(d, f) === "filled" ? monthStart(d, f) : null
      const days = start ? cal.getDaysInMonth(start) : (cal.getMaximumDaysInMonth?.() ?? 31)
      return { min: 1, max: days }
    }
    case "hour":
      return { min: 0, max: f.hour12 ? 11 : 23 }
    case "dayPeriod":
      return { min: 0, max: 1 }
    case "minute":
    case "second":
      return { min: 0, max: 59 }
  }
}

/** A segment stepped by `amount`, wrapping within its limits, never carrying (react-spectrum#6590). */
export function stepEntry(
  type: DateSegmentType,
  d: Draft,
  amount: number,
  f: SegmentFormat,
): SegmentEntry {
  const { min, max } = limits(type, d, f)
  const current = entryValue(d, type) ?? min
  const span = max - min + 1
  const next = min + ((((current - min + amount) % span) + span) % span)
  return entry(type, next, f)
}

/** A segment at its minimum or maximum (12-hour hour: Home shows 12, End 11). */
export function edgeEntry(
  type: DateSegmentType,
  d: Draft,
  edge: "min" | "max",
  f: SegmentFormat,
): SegmentEntry {
  return entry(type, limits(type, d, f)[edge], f)
}

/**
 * The hour of a complete zoned value stepped with zoned arithmetic: both occurrences of a
 * repeated hour are reachable and a skipped hour is skipped.
 */
export function stepZonedHour(value: ZonedDateTime, amount: number, f: SegmentFormat) {
  return value.cycle("hour", amount, { hourCycle: f.hour12 ? 12 : 24 })
}

export interface Conversion {
  readonly state: DraftState
  readonly value: DateValue | null
}

const impossible: Conversion = { state: "impossible", value: null }

/**
 * The draft as a value: a real date in `shape` when every editable segment is filled and
 * forms one, else null. Fields the field does not show come from `base` (the value or the
 * placeholder). A zoned draft equal to `previous`'s wall clock keeps `previous` (its offset).
 */
export function toValue(
  d: Draft,
  f: SegmentFormat,
  shape: ValueShape,
  base: DateValue,
  previous: DateValue | null,
): Conversion {
  const filled = draftState(d, f)
  if (filled === "empty") return { state: "empty", value: null }
  if (filled === "partial") return { state: "incomplete", value: null }
  const state = "complete"
  const fields = fieldsOf(base, f)
  const get = (t: DateSegmentType) => entryValue(d, t) ?? fields[t]
  const cal = f.options.calendar
  const era = f.eras[get("era")]?.id ?? eraId(d, f)
  // The display date, checked before the constructor would constrain it (react-spectrum#9624).
  const year = get("year")
  if (year < 1 || year > yearsInEra(cal, era)) return impossible
  const first = new CalendarDate(cal, era, year, 1, 1)
  const month = get("month")
  if (month < 1 || month > cal.getMonthsInYear(first)) return impossible
  const day = get("day")
  if (day < 1 || day > cal.getDaysInMonth(new CalendarDate(cal, era, year, month, 1))) {
    return impossible
  }
  const date = toCalendar(new CalendarDate(cal, era, year, month, day), shape.calendar)
  if (shape.kind === "date") return { state, value: date }
  const hour = f.hour12 ? (get("hour") % 12) + (get("dayPeriod") === 1 ? 12 : 0) : get("hour")
  const time = new CalendarDateTime(
    date.calendar,
    date.era,
    date.year,
    date.month,
    date.day,
    hour,
    get("minute"),
    get("second"),
  )
  if (shape.kind === "datetime") return { state, value: time }
  if (previous instanceof ZonedDateTime && toCalendarDateTime(previous).compare(time) === 0) {
    return { state, value: previous }
  }
  return { state, value: toZoned(time, shape.timeZone) }
}

/**
 * A draft carried into a new format (locale, calendar, granularity or hour cycle changed):
 * a complete draft converts through its value; otherwise each segment keeps its number,
 * the hour moving between cycles with its day period.
 */
export function reformat(
  d: Draft,
  from: SegmentFormat,
  to: SegmentFormat,
  shape: ValueShape,
  base: DateValue,
): Draft {
  const whole = toValue(d, from, shape, base, null)
  if (whole.value !== null) return draftOf(whole.value, to)
  const out: Partial<Record<DateSegmentType, SegmentEntry>> = {}
  for (const type of to.editable) {
    let n = entryValue(d, type)
    if (type === "hour" && n !== null && from.hour12 !== to.hour12) {
      n = to.hour12 ? n % 12 : n + (entryValue(d, "dayPeriod") === 1 ? 12 : 0)
    }
    if (type === "dayPeriod" && n === null && !from.hour12) {
      const h = entryValue(d, "hour")
      n = h === null ? null : h >= 12 ? 1 : 0
    }
    if (n !== null) out[type] = entry(type, n, to)
  }
  return out
}

/** The committed year, month and day of a draft (null where empty), for hosts that follow it. */
export function draftHint(d: Draft): {
  readonly year: number | null
  readonly month: number | null
  readonly day: number | null
} {
  return {
    year: entryValue(d, "year"),
    month: entryValue(d, "month"),
    day: entryValue(d, "day"),
  }
}
