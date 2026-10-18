// date-segments "Segment List": the locale's formatter parts for a field's options, in the
// formatter's order, plus what typing and display need from the same formatter (padding,
// numbering system, day-period and era names). Pure and cached: no DOM, no clock.

import type { Calendar } from "@internationalized/date"
import { CalendarDate, GregorianCalendar, toCalendar } from "@internationalized/date"
import { dateFormatter } from "../../i18n/date"

/** An editable segment. */
export type DateSegmentType =
  | "era"
  | "year"
  | "month"
  | "day"
  | "hour"
  | "dayPeriod"
  | "minute"
  | "second"

export type SegmentType = DateSegmentType | "timeZoneName" | "literal"

/** The smallest editable segment. */
export type DateGranularity = "day" | "hour" | "minute" | "second"

export interface Segment {
  readonly type: SegmentType
  /** A literal's or the time zone name's text; "" for editable segments (the draft shows them). */
  readonly text: string
}

export interface SegmentOptions {
  /** The locale to format with (the calendar's format locale, `date-values`). */
  readonly locale: string
  readonly calendar: Calendar
  readonly granularity: DateGranularity
  /** The coarsest segment: `year` (dates) or `hour` (Time Field). Default `year`. */
  readonly maxGranularity?: "year" | "hour" | undefined
  /** Default: the locale's. */
  readonly hourCycle?: 12 | 24 | undefined
  /** The zone a zoned value is shown in; "UTC" for floating values. */
  readonly timeZone: string
  /** Show the read-only time zone name (a zoned value without `hideTimeZone`). */
  readonly showTimeZone: boolean
  readonly forceLeadingZeros: boolean
  /** A gregorian date before the common era: the era is shown and editable. */
  readonly bc: boolean
}

export interface EraName {
  readonly id: string
  readonly name: string
}

/** Everything a field derives from its formatter, once per options. */
export interface SegmentFormat {
  readonly options: SegmentOptions
  readonly segments: readonly Segment[]
  /** The editable segments in format order (auto-advance, fill). */
  readonly editable: readonly DateSegmentType[]
  /** The hour runs in a 12-hour cycle (stored 0–11, shown 12, 1–11). */
  readonly hour12: boolean
  readonly numberingSystem: string
  /** AM, PM in the locale ("오전", "오후"). */
  readonly dayPeriods: readonly [string, string]
  /** The calendar's eras in order, with their short names. */
  readonly eras: readonly EraName[]
  /** Formats one numeric segment's number in the locale's digits and padding. */
  number(type: DateSegmentType, n: number): string
  /** Longest text a segment can show (its input's `size`). */
  size(type: DateSegmentType): number
  /** The formatter of a whole value (copy, the value description), in `timeZone`. */
  format(date: Date): string
}

const TIME: readonly SegmentType[] = ["hour", "minute", "second"]
const ORDER: readonly DateGranularity[] = ["day", "hour", "minute", "second"]
const finer = (g: DateGranularity, than: DateGranularity) => ORDER.indexOf(g) >= ORDER.indexOf(than)

// U+2066 LEFT-TO-RIGHT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE (spec "Right-To-Left Rendering").
const LRI = "⁦"
const PDI = "⁩"

/** The formatter options a field's segments come from. */
function intlOptions(o: SegmentOptions, zone: string): Intl.DateTimeFormatOptions {
  const two = o.forceLeadingZeros ? "2-digit" : "numeric"
  const dates = (o.maxGranularity ?? "year") === "year"
  const multiEra = o.calendar.identifier !== "gregory" && o.calendar.getEras().length > 1
  return {
    calendar: o.calendar.identifier,
    timeZone: zone,
    ...(dates ? { year: "numeric", month: two, day: two } : {}),
    ...(dates && (multiEra || o.bc) ? { era: "short" } : {}),
    ...(finer(o.granularity, "hour") ? { hour: two } : {}),
    ...(finer(o.granularity, "minute") ? { minute: "2-digit" } : {}),
    ...(finer(o.granularity, "second") ? { second: "2-digit" } : {}),
    ...(finer(o.granularity, "hour") && o.hourCycle !== undefined
      ? { hourCycle: o.hourCycle === 12 ? "h12" : "h23" }
      : {}),
    ...(o.showTimeZone && finer(o.granularity, "hour") ? { timeZoneName: "short" } : {}),
  }
}

/** A formatter part's segment type (spec: `relatedYear` is a year; unknown parts are literals). */
function typeOf(part: string, o: SegmentOptions, hour12: boolean): SegmentType {
  switch (part) {
    case "relatedYear":
    case "year":
      return "year"
    case "era":
      return o.calendar.getEras().length > 1 || o.bc ? "era" : "literal"
    case "month":
    case "day":
    case "hour":
    case "minute":
    case "second":
      return part
    case "dayPeriod":
      return hour12 ? "dayPeriod" : "literal"
    case "timeZoneName":
      return "timeZoneName"
    default:
      return "literal"
  }
}

/** The 1st of the 1st month at 01:01:01 in `calendar`: each numeric part's text length is its padding. */
function ones(calendar: Calendar): Date {
  const first = toCalendar(new CalendarDate(2001, 6, 1), calendar).set({ month: 1, day: 1 })
  const g = toCalendar(first, new GregorianCalendar())
  return new Date(Date.UTC(g.year, g.month - 1, g.day, 1, 1, 1))
}

const cache = new Map<string, SegmentFormat>()

/** The segments and format facts for a field's options (cached by value). */
export function segmentFormat(o: SegmentOptions): SegmentFormat {
  const key = JSON.stringify({ ...o, calendar: o.calendar.identifier })
  const hit = cache.get(key)
  if (hit) return hit
  const made = build(o)
  cache.set(key, made)
  return made
}

function build(o: SegmentOptions): SegmentFormat {
  const zoned = dateFormatter(o.locale, intlOptions(o, o.timeZone))
  const utc = dateFormatter(o.locale, { ...intlOptions(o, "UTC"), timeZoneName: undefined })
  const resolved = utc.resolvedOptions()
  const hour12 = resolved.hour12 === true
  const numberingSystem = resolved.numberingSystem

  const parts: Segment[] = zoned.formatToParts(ones(o.calendar)).map((part) => {
    const type = typeOf(part.type, o, hour12)
    return { type, text: type === "literal" || type === "timeZoneName" ? part.value : "" }
  })
  const segments = mergeLiterals(isolateTime(parts))

  const pads = new Map<string, number>()
  for (const part of utc.formatToParts(ones(o.calendar))) {
    // Engines name a non-gregorian year `relatedYear` (not in TypeScript's part types).
    const type: string = part.type
    if (type !== "year" && type !== "relatedYear") pads.set(type, part.value.length)
  }
  const numberFormats = new Map<number, Intl.NumberFormat>()
  const digits = (pad: number) => {
    let f = numberFormats.get(pad)
    if (!f) {
      f = new Intl.NumberFormat(o.locale, {
        numberingSystem,
        useGrouping: false,
        minimumIntegerDigits: pad,
      })
      numberFormats.set(pad, f)
    }
    return f
  }

  const dayPeriods = dayPeriodNames(o)
  const eras = eraNames(o)
  const editable = segments
    .map((s) => s.type)
    .filter((t): t is DateSegmentType => t !== "literal" && t !== "timeZoneName")
  return {
    options: o,
    segments,
    editable,
    hour12,
    numberingSystem,
    dayPeriods,
    eras,
    number: (type, n) => digits(type === "year" ? 1 : (pads.get(type) ?? 1)).format(n),
    size: (type) => {
      if (type === "dayPeriod") return Math.max(...dayPeriods.map((p) => p.length))
      if (type === "era") return Math.max(1, ...eras.map((e) => e.name.length))
      if (type === "year") return 4
      return 2
    },
    format: (date) => zoned.format(date),
  }
}

/** Wraps the hour-to-second run in isolates so it reads hour:minute in any direction. */
function isolateTime(segments: readonly Segment[]): readonly Segment[] {
  const first = segments.findIndex((s) => TIME.includes(s.type))
  if (first < 0) return segments
  const last = segments.findLastIndex((s) => TIME.includes(s.type))
  return [
    ...segments.slice(0, first),
    { type: "literal", text: LRI },
    ...segments.slice(first, last + 1),
    { type: "literal", text: PDI },
    ...segments.slice(last + 1),
  ]
}

/** Consecutive literals as one (an isolate joins its neighbour). */
function mergeLiterals(segments: readonly Segment[]): Segment[] {
  const out: Segment[] = []
  for (const s of segments) {
    const last = out[out.length - 1]
    if (s.type === "literal" && last?.type === "literal") {
      out[out.length - 1] = { type: "literal", text: last.text + s.text }
    } else out.push(s)
  }
  return out
}

function dayPeriodNames(o: SegmentOptions): readonly [string, string] {
  const f = dateFormatter(o.locale, { hour: "numeric", hourCycle: "h12", timeZone: "UTC" })
  const name = (h: number) =>
    f.formatToParts(new Date(Date.UTC(2001, 0, 1, h))).find((p) => p.type === "dayPeriod")?.value ??
    (h < 12 ? "AM" : "PM")
  return [name(1), name(13)]
}

function eraNames(o: SegmentOptions): readonly EraName[] {
  const f = dateFormatter(o.locale, {
    calendar: o.calendar.identifier,
    era: "short",
    year: "numeric",
    timeZone: "UTC",
  })
  return o.calendar.getEras().map((id) => {
    // The last day of the era's first year: its first day may precede the era (Meiji 1).
    const date = new CalendarDate(o.calendar, id, 1, 12, 31)
    const name = f.formatToParts(date.toDate("UTC")).find((p) => p.type === "era")?.value ?? id
    return { id, name }
  })
}
