import type {
  CreateCalendar,
  DateFieldBoundary,
  DateFieldDraftHint,
  DateFieldMessages,
  DateFieldReason,
  DateGranularity,
  DateRangeFieldValue,
  DateValidityFlags,
  DateValue,
  DayOfWeek,
  FieldMessages,
  FieldValue,
  FocusTarget,
  MessageOverrides,
  PositioningProps,
  SegmentPart,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLInputAttributes } from "svelte/elements"
import type { CalendarRootProps } from "../calendar/types"
import type { ChildArgs } from "../child"
import type { FieldOwnProps } from "../field/types"

declare module "../provider" {
  interface RindMessageScopes {
    "date-field": DateFieldMessages
  }
}

export interface DateFieldChangeDetails {
  readonly reason: DateFieldReason
  readonly modality: string | undefined
  cancel(): void
}

export interface DateRangeFieldChangeDetails {
  readonly reason: string
  cancel(): void
}

export type DatePickerCloseReason =
  | "trigger"
  | "close-trigger"
  | "select"
  | "escape-key"
  | "outside-press"
  | "outside-focus"
  | "parent-dismissed"
  | "api"

export interface DatePickerOpenChangeDetails {
  readonly reason: "trigger" | DatePickerCloseReason
  /** Keeps the open state (uncontrolled) or refuses the change (controlled). */
  cancel(): void
}

/** The picker's Root props: the Popover's open state and layer options. */
export interface DatePickerProps {
  /** The calendar popover's open state; `bind:open` controls it. */
  open?: boolean | undefined
  /** Initial open state of the calendar popover. Default: false. */
  readonly defaultOpen?: boolean | undefined
  /** Every open or close request, with `details.reason` and `details.cancel()`. */
  readonly onOpenChange?:
    | ((open: boolean, details: DatePickerOpenChangeDetails) => void)
    | undefined
  /** A pick closes the popover (default true). */
  readonly closeOnSelect?: boolean | undefined
  /** The calendar's first day of the week. */
  readonly firstDayOfWeek?: DayOfWeek | undefined
  readonly modal?: boolean | undefined
  readonly initialFocus?: (() => FocusTarget) | null | undefined
  readonly finalFocus?: (() => FocusTarget) | false | null | undefined
  readonly positioning?: PositioningProps | undefined
  readonly persistentElements?: (() => readonly Element[]) | undefined
}

/** The props both ends of a range share (they are passed to each embedded field). */
export interface DateRangeEndProps {
  readonly placeholderValue?: FieldValue | undefined
  readonly granularity?: DateGranularity | undefined
  /** `"hour"`: time ends (no date segments). Default: `"hour"` for `Time` ends. */
  readonly maxGranularity?: "year" | "hour" | undefined
  readonly hourCycle?: 12 | 24 | undefined
  readonly hideTimeZone?: boolean | undefined
  readonly shouldForceLeadingZeros?: boolean | undefined
  readonly minValue?: FieldValue | null | undefined
  readonly maxValue?: FieldValue | null | undefined
  readonly isDateUnavailable?: ((date: DateValue) => boolean) | undefined
  readonly locale?: string | undefined
  readonly dir?: "ltr" | "rtl" | undefined
}

type FieldProps = Omit<FieldOwnProps, "messages"> & {
  readonly id?: string | undefined
  /** The Field's messages when the Root is the Field. */
  readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
}

type Div = Omit<HTMLAttributes<HTMLDivElement>, "children" | "dir" | "onchange" | "defaultValue">

export type DateFieldSingleRootProps = Div &
  FieldProps &
  DatePickerProps &
  Omit<DateRangeEndProps, "minValue" | "maxValue"> & {
    /** The parts: Label, Input, Description, ErrorMessage and, for a picker, its parts. */
    readonly children?: Snippet | undefined
    readonly selectionMode?: "single" | undefined
    /** A date, a date-time, a zoned date-time, or a `Time`; `bind:value` controls it. */
    value?: FieldValue | null | undefined
    /** Read at creation; a later change only changes what a form reset restores. */
    readonly defaultValue?: FieldValue | null | undefined
    readonly onValueChange?:
      | ((value: FieldValue | null, details: DateFieldChangeDetails) => void)
      | undefined
    /** A `Time` bound compares with a date-time value on the value's own day. */
    readonly minValue?: FieldValue | null | undefined
    readonly maxValue?: FieldValue | null | undefined
    /** Calendar systems other than gregorian (`createCalendar` from @internationalized/date). */
    readonly createCalendar?: CreateCalendar | undefined
    readonly form?: string | undefined
    /** On the hidden input only (`bday`, …). */
    readonly autoComplete?: string | undefined
    readonly messages?: MessageOverrides<DateFieldMessages> | undefined
    /** Inside a host component: no Field, no hidden input, no Label (date-field "Embedded Mode"). */
    readonly embedded?: boolean | undefined
    /** Embedded: the ids that name the segments (after each segment's name). */
    readonly labelledBy?: readonly string[] | undefined
    /** Embedded: the ids that describe the first segment (every segment while invalid). */
    readonly describedBy?: readonly string[] | undefined
    /** Embedded: the field's own validity, after mount and whenever it changes. */
    readonly onValidityChange?: ((flags: DateValidityFlags, message: string) => void) | undefined
    /** Auto-advance, Backspace or an arrow found no segment to move to. */
    readonly onBoundary?: ((boundary: DateFieldBoundary) => void) | undefined
    /** The committed year, month and day (a host following the typed date). */
    readonly onDraftChange?: ((hint: DateFieldDraftHint) => void) | undefined
    /** Embedded: select all + Backspace cleared the field (a range clears both ends). */
    readonly onClearAll?: (() => void) | undefined
    /** Arrows move across every field's segments inside this element (paired fields). */
    readonly segmentScope?: (() => HTMLElement | null) | undefined
  }

export type DateRangeFieldRootProps = Div &
  FieldProps &
  DatePickerProps &
  DateRangeEndProps & {
    readonly children?: Snippet | undefined
    readonly selectionMode: "range"
    /** The pair; `bind:value` controls it. */
    value?: DateRangeFieldValue | undefined
    readonly defaultValue?: DateRangeFieldValue | undefined
    readonly onValueChange?:
      | ((value: DateRangeFieldValue, details: DateRangeFieldChangeDetails) => void)
      | undefined
    /** A range may contain unavailable dates (default false). */
    readonly allowsNonContiguousRanges?: boolean | undefined
    /** `Time` ends: an end before the start is the next day (default false). */
    readonly allowsOvernight?: boolean | undefined
    /** The hidden inputs' names. */
    readonly startName?: string | undefined
    /** The end date's hidden input name. */
    readonly endName?: string | undefined
    readonly form?: string | undefined
    readonly messages?: MessageOverrides<DateFieldMessages> | undefined
  }

/** Single mode (default), or a range of two ends with `selectionMode="range"`. */
export type DateFieldRootProps = DateFieldSingleRootProps | DateRangeFieldRootProps

export interface DateFieldState {
  readonly value: FieldValue | null
  readonly segments: readonly SegmentPart[]
  readonly focusedSegment: import("@rind-ui/core").DateSegmentType | null
  readonly composing: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: Snippet | undefined
}

export type DateFieldInputProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<DateFieldState>]> | undefined
  /** Segments in order; without children every segment renders automatically. */
  readonly children?: Snippet<[readonly SegmentPart[]]> | undefined
}
export type DateFieldSegmentProps = Omit<HTMLInputAttributes, "value" | "children"> & {
  readonly child?: Snippet<[ChildArgs<DateFieldState>]> | undefined
  /** The segment to render, one of those Input's children receive. */
  readonly segment: SegmentPart
}
export type DateFieldEndProps = Omit<HTMLAttributes<HTMLDivElement>, "children">
export type DateFieldSeparatorProps = HTMLAttributes<HTMLSpanElement>
export type DateFieldControlProps = Part<HTMLAttributes<HTMLDivElement>>
export type DateFieldTriggerProps = Part<HTMLButtonAttributes>
export type DateFieldClearTriggerProps = Part<HTMLButtonAttributes>
export type DateFieldContentProps = Part<HTMLAttributes<HTMLDivElement>>

/** The data props the picker owns (spec "Picker — Calendar Binding"). */
type BoundCalendarProps =
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "selectionMode"
  | "focusedValue"
  | "defaultFocusedValue"
  | "onFocusChange"
  | "minValue"
  | "maxValue"
  | "isDateUnavailable"
  | "disabled"
  | "readOnly"
  | "invalid"
  | "locale"
  | "firstDayOfWeek"
  | "allowsNonContiguousRanges"
  | "commitOnBlur"
  | "onDateSelect"
export type DatePickerCalendarProps = Omit<CalendarRootProps, BoundCalendarProps>
