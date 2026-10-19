// Range mode (date-field spec "Range Mode — Derived Value", "Range Validity", "Time Ends And
// Overnight"): the pair's public value and validity from its two ends. Pure: the ends are the
// embedded fields' committed values and their own validity; nothing here edits an end.

import {
  type CalendarDate,
  type DateValue,
  parseDate,
  parseDateTime,
  parseTime,
  parseZonedDateTime,
  Time,
  toCalendarDate,
} from "@internationalized/date"
import { type DateValidityFlags, validityFlags } from "../date-segments"
import type { DateFieldMessages } from "./date-field.messages"

export type DateRangeEdge = "start" | "end"
export type DateRangeEndValue = DateValue | Time

export interface DateRangeValue<T = DateValue> {
  readonly start: T
  readonly end: T
}
export type TimeRangeValue = DateRangeValue<Time>

/** One end as the pair sees it: its committed value and its own validity. */
export interface DateRangeEnd {
  readonly value: DateRangeEndValue | null
  /** The end's own problem ("" when valid). */
  readonly message: string
  readonly flags: DateValidityFlags
}

/** An end with no value and no problem of its own: every segment is empty. */
const emptyEnd = (e: DateRangeEnd) => e.value === null && e.message === ""

export interface DateRangeRules {
  readonly isDateUnavailable?: ((date: DateValue) => boolean) | undefined
  readonly allowsNonContiguousRanges?: boolean | undefined
  /** `Time` ends only: an end before the start is the next day. */
  readonly allowsOvernight?: boolean | undefined
  readonly required?: boolean | undefined
}

export interface DateRangeState {
  /** Both ends complete, in order and valid by the range rules; else null. */
  readonly value: DateRangeValue<DateRangeEndValue> | null
  readonly message: string
  readonly flags: DateValidityFlags
  /** The end that alone makes the pair invalid, if any. */
  readonly invalidEdge: DateRangeEdge | null
  /** `Time` ends with `allowsOvernight` and the end before the start. */
  readonly overnight: boolean
}

const isTime = (v: DateRangeEndValue): v is Time => v instanceof Time

/** Compares two end values of the same kind (instants for zoned values). */
export function compareEnds(a: DateRangeEndValue, b: DateRangeEndValue): number {
  if (isTime(a) && isTime(b)) return a.compare(b)
  if (isTime(a) || isTime(b)) return 0
  // Sound: every DateValue compares with every other (the library converts across types).
  return (a as DateValue).compare(b as never)
}

/** Whether the days from `start` to `end` include an unavailable one (366 days at most). */
export function rangeCrossesUnavailable(
  start: DateValue,
  end: DateValue,
  isUnavailable: (date: DateValue) => boolean,
): boolean {
  let day: CalendarDate = toCalendarDate(start)
  const last = toCalendarDate(end)
  for (let i = 0; i < 366 && day.compare(last) <= 0; i++) {
    if (isUnavailable(day)) return true
    day = day.add({ days: 1 })
  }
  return false
}

const VALID = validityFlags(null)

/** The pair's derived value and its first problem (spec "Range Validity"). */
export function deriveRange(
  start: DateRangeEnd,
  end: DateRangeEnd,
  rules: DateRangeRules,
  messages: Pick<
    DateFieldMessages,
    | "startDate"
    | "endDate"
    | "endProblem"
    | "endBeforeStart"
    | "endBeforeStartTime"
    | "containsUnavailable"
    | "incomplete"
  >,
): DateRangeState {
  const invalid = (
    message: string,
    flags: DateValidityFlags,
    invalidEdge: DateRangeEdge | null,
  ): DateRangeState => ({ value: null, message, flags, invalidEdge, overnight: false })
  // Each end's own problem first, start before end.
  for (const [edge, e, name] of [
    ["start", start, messages.startDate],
    ["end", end, messages.endDate],
  ] as const) {
    if (e.message)
      return invalid(messages.endProblem({ edge: name, message: e.message }), e.flags, edge)
  }
  if (emptyEnd(start) && emptyEnd(end)) {
    return rules.required
      ? invalid(messages.incomplete, validityFlags("valueMissing"), null)
      : { value: null, message: "", flags: VALID, invalidEdge: null, overnight: false }
  }
  // One end empty: incomplete (badInput), named by the empty end.
  if (start.value === null || end.value === null) {
    const edge: DateRangeEdge = start.value === null ? "start" : "end"
    const name = edge === "start" ? messages.startDate : messages.endDate
    return invalid(
      messages.endProblem({ edge: name, message: messages.incomplete }),
      validityFlags(rules.required ? "valueMissing" : "incomplete"),
      edge,
    )
  }
  const s = start.value
  const e = end.value
  const times = isTime(s) && isTime(e)
  if (compareEnds(e, s) < 0) {
    if (times && rules.allowsOvernight) {
      return {
        value: { start: s, end: e },
        message: "",
        flags: VALID,
        invalidEdge: null,
        overnight: true,
      }
    }
    return invalid(
      times ? messages.endBeforeStartTime : messages.endBeforeStart,
      validityFlags("rangeUnderflow"),
      "end",
    )
  }
  if (
    !times &&
    rules.isDateUnavailable &&
    !rules.allowsNonContiguousRanges &&
    rangeCrossesUnavailable(s as DateValue, e as DateValue, rules.isDateUnavailable)
  ) {
    return invalid(messages.containsUnavailable, validityFlags("unavailable"), null)
  }
  return {
    value: { start: s, end: e },
    message: "",
    flags: VALID,
    invalidEdge: null,
    overnight: false,
  }
}

/** Two derived values are the same range (each end by `compare`). */
export function sameRange(
  a: DateRangeValue<DateRangeEndValue> | null,
  b: DateRangeValue<DateRangeEndValue> | null,
): boolean {
  if (a === null || b === null) return a === b
  return (
    a.start.constructor === b.start.constructor &&
    a.end.constructor === b.end.constructor &&
    compareEnds(a.start, b.start) === 0 &&
    compareEnds(a.end, b.end) === 0
  )
}

/**
 * A hidden input's ISO text (a browser autofill) as an end value of the input's type, or null
 * when it does not parse (spec "Range Mode — Hidden Inputs And Form").
 */
export function parseEndValue(text: string, type: string): DateRangeEndValue | null {
  try {
    if (text === "") return null
    if (type === "date") return parseDate(text)
    if (type === "time") return parseTime(text)
    if (type === "datetime-local") return parseDateTime(text)
    return parseZonedDateTime(text)
  } catch {
    return null
  }
}
