// date-segments "Segment Names And Values": the locale's name of each segment type
// (Intl.DisplayNames, full locale so script subtags count: zag#3154) and the default spoken
// value of a segment ("10 – October", "9 AM"). Pure; messages may override both.

import { CalendarDate } from "@internationalized/date"
import { dateFormatter } from "../../i18n/date"
import type { Draft, SegmentEntry } from "./draft"
import type { DateSegmentType, SegmentFormat } from "./segments"

const names = new Map<string, Intl.DisplayNames | null>()

/** "month", "Monat", "mesec"; the type itself where DisplayNames is missing. */
export function segmentName(type: DateSegmentType | "timeZoneName", locale: string): string {
  let n = names.get(locale)
  if (n === undefined) {
    try {
      n = new Intl.DisplayNames(locale, { type: "dateTimeField" })
    } catch {
      n = null
    }
    names.set(locale, n)
  }
  return n?.of(type) ?? type
}

/** The month's long name in the field's calendar ("October"). */
export function monthName(month: number, d: Draft, f: SegmentFormat): string {
  const cal = f.options.calendar
  const eras = cal.getEras()
  const era = f.eras[d.era?.value ?? -1]?.id ?? eras[eras.length - 1] ?? ""
  // A year where every month exists (the 13th of a hebrew leap year needs one).
  const year = d.year?.value ?? (cal.identifier === "hebrew" ? 5784 : 2001)
  const date = new CalendarDate(cal, era, year, month, 1)
  return dateFormatter(f.options.locale, {
    month: "long",
    calendar: cal.identifier,
    timeZone: "UTC",
  }).format(date.toDate("UTC"))
}

/**
 * The default spoken value of a filled segment: the month with its name, the hour with
 * its day period, else the shown text. Null for an empty segment (the "Empty" message).
 */
export function defaultValueText(
  type: DateSegmentType,
  e: SegmentEntry | undefined,
  d: Draft,
  f: SegmentFormat,
): string | null {
  if (!e || e.value === null) return null
  if (type === "month") return `${e.text} – ${monthName(e.value, d, f)}`
  if (type === "hour" && f.hour12) {
    const period = d.dayPeriod?.value
    return period === null || period === undefined ? e.text : `${e.text} ${f.dayPeriods[period]}`
  }
  return e.text
}
