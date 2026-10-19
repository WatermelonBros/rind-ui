// date-segments "Validity": the control's own validity, from where the draft stands and the
// committed value. An impossible or incomplete entry is reported, never changed. Pure.

import { type DateValue, Time } from "@internationalized/date"
import type { DraftState, FieldValue } from "./draft"

/** Why the field is invalid, or null. Each key has a message in `messages`. */
export type DateValidityReason =
  | "valueMissing"
  | "incomplete"
  | "impossible"
  | "rangeUnderflow"
  | "rangeOverflow"
  | "unavailable"

export interface DateConstraints {
  /** A `Time` bound compares with a date-time value on the value's own day. */
  readonly minValue?: FieldValue | null | undefined
  readonly maxValue?: FieldValue | null | undefined
  readonly isDateUnavailable?: ((date: DateValue) => boolean) | undefined
  readonly required?: boolean | undefined
}

/** The flags a validity element (or an embedding host) reports for a reason. */
export interface DateValidityFlags {
  readonly valid: boolean
  readonly valueMissing: boolean
  readonly badInput: boolean
  readonly rangeUnderflow: boolean
  readonly rangeOverflow: boolean
  readonly customError: boolean
}

const timeOf = (v: FieldValue) =>
  v instanceof Time ? v : "hour" in v ? new Time(v.hour, v.minute, v.second, v.millisecond) : null

/** A value against a bound; 0 (in bounds) when a date meets a `Time` bound or the reverse. */
function compare(a: FieldValue, b: FieldValue): number {
  if (a instanceof Time || b instanceof Time) {
    const [x, y] = [timeOf(a), timeOf(b)]
    return x && y ? x.compare(y) : 0
  }
  // Sound: every DateValue compares with every other through its `compare` (the library
  // converts across the three types); TypeScript cannot express that union of overloads.
  return a.compare(b as never)
}

export function dateValidity(
  state: DraftState,
  value: FieldValue | null,
  c: DateConstraints,
): DateValidityReason | null {
  if (state === "incomplete") return "incomplete"
  if (state === "impossible") return "impossible"
  if (value === null) return c.required === true ? "valueMissing" : null
  if (c.minValue && compare(value, c.minValue) < 0) return "rangeUnderflow"
  if (c.maxValue && compare(value, c.maxValue) > 0) return "rangeOverflow"
  if (!(value instanceof Time) && c.isDateUnavailable?.(value) === true) return "unavailable"
  return null
}

export function validityFlags(reason: DateValidityReason | null): DateValidityFlags {
  return {
    valid: reason === null,
    valueMissing: reason === "valueMissing",
    badInput: reason === "incomplete" || reason === "impossible",
    rangeUnderflow: reason === "rangeUnderflow",
    rangeOverflow: reason === "rangeOverflow",
    customError: reason === "unavailable",
  }
}
