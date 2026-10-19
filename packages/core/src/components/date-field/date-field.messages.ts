// The Date Field's strings (spec "Messages"): every text that reaches assistive technology
// or the user. Segment names fall back to the locale's (Intl.DisplayNames); dates in the
// arguments are already formatted in the field's locale.

import { type DateSegmentType, segmentName } from "../date-segments"

export interface DateFieldValueTextArgs {
  readonly type: DateSegmentType
  readonly value: number
  /** The segment's shown text. */
  readonly text: string
  /** The default spoken value ("10 – October", "9 AM"). */
  readonly formatted: string
}

export type DateFieldMessages = {
  /** A segment's name (default: the locale's, "month", "Monat"). */
  readonly segmentName: (args: {
    readonly type: DateSegmentType | "timeZoneName"
    readonly locale: string
  }) => string
  /** aria-valuetext of a filled segment. */
  readonly segmentValueText: (args: DateFieldValueTextArgs) => string
  /** aria-valuetext of an empty segment. */
  readonly empty: string
  /** An empty segment's placeholder (an empty result keeps the default). */
  readonly placeholder: (type: DateSegmentType) => string
  /** The group's description of the whole value (`time`: a time field, no date shown). */
  readonly valueDescription: (args: {
    readonly formatted: string
    readonly time?: boolean | undefined
  }) => string
  /** The picker trigger's name (with the Label's). */
  readonly trigger: string
  /** The range picker trigger's name (with the Label's). */
  readonly rangeTrigger: string
  /** The clear trigger's name (with the Label's). */
  readonly clear: string
  readonly incomplete: string
  readonly impossible: string
  readonly rangeUnderflow: (args: { readonly min: string }) => string
  readonly rangeOverflow: (args: { readonly max: string }) => string
  readonly unavailable: string
  /** Range mode: the start end's name (after each segment's name). */
  readonly startDate: string
  /** Range mode: the end's name. */
  readonly endDate: string
  /** Range mode with time ends: the start's name. */
  readonly startTime: string
  /** Range mode with time ends: the end's name. */
  readonly endTime: string
  /** Range mode: the visible separator between the ends. */
  readonly separator: string
  /** Range mode: the group's description of the whole range. */
  readonly rangeDescription: (args: { readonly start: string; readonly end: string }) => string
  /** Range mode: an end's own problem, prefixed with the end's name. */
  readonly endProblem: (args: { readonly edge: string; readonly message: string }) => string
  readonly endBeforeStart: string
  readonly endBeforeStartTime: string
  readonly containsUnavailable: string
  /** Range mode with `allowsOvernight`: the end on the next day, in the description. */
  readonly overnight: (args: { readonly end: string }) => string
}

const PLACEHOLDERS: Readonly<Record<DateSegmentType, string>> = {
  era: "era",
  year: "yyyy",
  month: "mm",
  day: "dd",
  hour: "––",
  minute: "––",
  second: "––",
  dayPeriod: "AM",
}

/** The English default placeholder of a segment. */
export const defaultPlaceholder = (type: DateSegmentType) => PLACEHOLDERS[type]

export const dateFieldMessages: DateFieldMessages = {
  segmentName: ({ type, locale }) => segmentName(type, locale),
  segmentValueText: ({ formatted }) => formatted,
  empty: "Empty",
  placeholder: defaultPlaceholder,
  valueDescription: ({ formatted, time }) =>
    time ? `Selected time: ${formatted}` : `Selected date: ${formatted}`,
  trigger: "Choose date",
  rangeTrigger: "Choose dates",
  clear: "Clear",
  incomplete: "Enter a complete date",
  impossible: "Enter a valid date",
  rangeUnderflow: ({ min }) => `Value must be ${min} or later`,
  rangeOverflow: ({ max }) => `Value must be ${max} or earlier`,
  unavailable: "This date is unavailable",
  startDate: "Start date",
  endDate: "End date",
  startTime: "Start time",
  endTime: "End time",
  separator: "–",
  rangeDescription: ({ start, end }) => `Selected range: ${start} to ${end}`,
  endProblem: ({ edge, message }) => `${edge}: ${message}`,
  endBeforeStart: "End date must be on or after the start date",
  endBeforeStartTime: "End time must be after the start time",
  containsUnavailable: "The range includes an unavailable date",
  overnight: ({ end }) => `${end} the next day`,
}
