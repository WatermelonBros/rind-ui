// date-segments "Paste And Copy": pasted text that is an ISO 8601 value of the field's type,
// or the field's own formatted output in its locale, becomes the whole value. Pure.

import {
  type DateValue,
  parseDate,
  parseDateTime,
  parseZonedDateTime,
  toCalendar,
} from "@internationalized/date"
import { type Draft, type SegmentEntry, segmentText, toValue, type ValueShape } from "./draft"
import type { DateSegmentType, SegmentFormat } from "./segments"
import { digitOf, planName } from "./typing"

/** ISO text of the field's value type, in the value's calendar; null when it is not one. */
function parseIso(text: string, shape: ValueShape): DateValue | null {
  // A date alone is not a date-time (parseDateTime would read it as midnight).
  if (shape.kind !== "date" && !text.includes("T")) return null
  try {
    const value =
      shape.kind === "date"
        ? parseDate(text)
        : shape.kind === "datetime"
          ? parseDateTime(text)
          : parseZonedDateTime(text)
    return toCalendar(value, shape.calendar)
  } catch {
    return null
  }
}

/** Runs of digits (as numbers) and of other text, digits read in any numbering system. */
function tokens(text: string, f: SegmentFormat) {
  const out: { readonly digits: boolean; readonly text: string }[] = []
  for (const char of text) {
    const d = digitOf(char, f)
    const digits = d !== null
    const last = out[out.length - 1]
    const piece = digits ? String(d) : char
    if (last && last.digits === digits) out[out.length - 1] = { digits, text: last.text + piece }
    else out.push({ digits, text: piece })
  }
  return out
}

/** The field's own format: one digit run per numeric segment in order, names matched. */
function parseOwnFormat(
  text: string,
  f: SegmentFormat,
  shape: ValueShape,
  base: DateValue,
): DateValue | null {
  const all = tokens(text, f)
  const numbers = all.filter((t) => t.digits).map((t) => Number(t.text))
  const words = all.filter((t) => !t.digits && t.text.trim() !== "").map((t) => t.text.trim())
  const numeric = f.editable.filter((t) => t !== "era" && t !== "dayPeriod")
  if (numbers.length !== numeric.length) return null
  const draft: Partial<Record<DateSegmentType, SegmentEntry>> = {}
  numeric.forEach((type, i) => {
    const n = numbers[i] ?? 0
    // A 12-hour "12" is stored as 0 (shown 12).
    const value = type === "hour" && f.hour12 ? n % 12 : n
    draft[type] = { value, text: segmentText(type, value, f) }
  })
  for (const type of ["dayPeriod", "era"] as const) {
    if (!f.editable.includes(type)) continue
    const hit = words
      .map((w) => planName(type, w, f))
      .find((p): p is { kind: "match"; value: number } => p.kind === "match")
    if (!hit) return null
    draft[type] = { value: hit.value, text: segmentText(type, hit.value, f) }
  }
  return toValue(draft as Draft, f, shape, base, null).value
}

/** The value pasted text stands for, or null (ignored). */
export function parsePaste(
  text: string,
  f: SegmentFormat,
  shape: ValueShape,
  base: DateValue,
): DateValue | null {
  const t = text.trim()
  if (t === "") return null
  return parseIso(t, shape) ?? parseOwnFormat(t, f, shape, base)
}
