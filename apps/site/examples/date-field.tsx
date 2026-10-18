"use client"

import {
  CalendarDate,
  CalendarDateTime,
  createCalendar,
  isWeekend,
  parseZonedDateTime,
} from "@internationalized/date"
import { Button, Calendar, DateField, type DateFieldRootProps, Field } from "@rind-ui/react"
import type { States, Variants } from "./types"

/**
 * `editing` and `composing` need a focused segment or an IME session: the harness marks them
 * when the driver reaches them.
 */
export const states: States = { "date-field": { idle: "Basic" } }

/** Every example has a fixed date so its output never depends on today. */
const fixed = new CalendarDate(2026, 10, 14)

/** Label and the automatic segments. */
function Dates({ label, ...props }: DateFieldRootProps & { readonly label: string }) {
  return (
    <DateField.Root {...props}>
      <DateField.Label>{label}</DateField.Label>
      <DateField.Input />
    </DateField.Root>
  )
}

/** The picker parts: the field and its triggers in a Control, the Calendar in a popover. */
function PickerParts() {
  return (
    <>
      <DateField.Control>
        <DateField.Input />
        <DateField.ClearTrigger>
          <span aria-hidden="true">×</span>
        </DateField.ClearTrigger>
        <DateField.Trigger>
          <CalendarIcon />
        </DateField.Trigger>
      </DateField.Control>
      <DateField.Portal>
        <DateField.Positioner>
          <DateField.Content>
            <DateField.Calendar>
              <Calendar.Header>
                <Calendar.PrevTrigger />
                <Calendar.Heading />
                <Calendar.NextTrigger />
              </Calendar.Header>
              <Calendar.Grid />
            </DateField.Calendar>
          </DateField.Content>
        </DateField.Positioner>
      </DateField.Portal>
    </>
  )
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function DatePicker() {
  return (
    <DateField.Root name="departure" defaultValue={fixed}>
      <DateField.Label>Departure</DateField.Label>
      <PickerParts />
      <DateField.ErrorMessage />
    </DateField.Root>
  )
}

export function DateRangePicker() {
  return (
    <DateField.Root
      selectionMode="range"
      startName="check-in"
      endName="check-out"
      defaultValue={{ start: new CalendarDate(2026, 10, 12), end: new CalendarDate(2026, 10, 16) }}
    >
      <DateField.Label>Stay</DateField.Label>
      <PickerParts />
      <DateField.ErrorMessage />
    </DateField.Root>
  )
}

/** The picker open on its value (a state example). */
export function DatePickerOpen() {
  return (
    <DateField.Root defaultValue={fixed} defaultOpen>
      <DateField.Label>Departure</DateField.Label>
      <PickerParts />
    </DateField.Root>
  )
}

export function DatePickerRules() {
  return (
    <DateField.Root
      selectionMode="range"
      validationMode="blur"
      minValue={new CalendarDate(2026, 10, 1)}
      maxValue={new CalendarDate(2026, 12, 31)}
      isDateUnavailable={(date) => isWeekend(date, "en-US")}
    >
      <DateField.Label>Working week</DateField.Label>
      <DateField.Description>Weekdays from October to December.</DateField.Description>
      <PickerParts />
      <DateField.ErrorMessage />
    </DateField.Root>
  )
}

export function Basic() {
  return <Dates label="Birthday" name="birthday" defaultValue={fixed} />
}

export function DateTime12Hour() {
  return (
    <Dates
      label="Meeting (12-hour)"
      defaultValue={new CalendarDateTime(2026, 10, 14, 15, 30)}
      granularity="minute"
      hourCycle={12}
      locale="en-US"
    />
  )
}

export function DateTime24Hour() {
  return (
    <Dates
      label="Meeting (24-hour)"
      defaultValue={new CalendarDateTime(2026, 10, 14, 15, 30)}
      granularity="minute"
      hourCycle={24}
      locale="en-US"
    />
  )
}

export function Zoned() {
  return (
    <Dates
      label="Flight departs"
      defaultValue={parseZonedDateTime("2026-10-14T15:30[Europe/Rome]")}
      granularity="minute"
      locale="en-US"
    />
  )
}

export function ZonedWithoutName() {
  return (
    <Dates
      label="Flight departs (zone hidden)"
      defaultValue={parseZonedDateTime("2026-10-14T15:30[Europe/Rome]")}
      granularity="minute"
      hideTimeZone
      locale="en-US"
    />
  )
}

export function JapaneseEras() {
  return (
    <Dates
      label="生年月日"
      locale="ja-JP-u-ca-japanese"
      createCalendar={createCalendar}
      defaultValue={fixed}
    />
  )
}

export function Buddhist() {
  return <Dates label="วันเกิด" locale="th-TH" createCalendar={createCalendar} defaultValue={fixed} />
}

export function ArabicRtl() {
  return <Dates label="تاريخ الميلاد" locale="ar-EG" defaultValue={fixed} />
}

export function MinMax() {
  return (
    <Dates
      label="Within October 2026"
      minValue={new CalendarDate(2026, 10, 1)}
      maxValue={new CalendarDate(2026, 10, 31)}
      defaultValue={fixed}
    />
  )
}

export function UnavailableWeekends() {
  return (
    <Dates
      label="Weekday only"
      // A fixed Saturday: invalid from the start.
      defaultValue={new CalendarDate(2026, 10, 14)}
      isDateUnavailable={(date) => isWeekend(date, "en-US")}
      locale="en-US"
    />
  )
}

export function RequiredInForm() {
  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()}>
      <DateField.Root name="arrival" required>
        <DateField.Label>Arrival</DateField.Label>
        <DateField.Input />
        <DateField.Description>Required; submits the ISO date.</DateField.Description>
        <DateField.ErrorMessage />
      </DateField.Root>
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
      </div>
    </form>
  )
}

export function ReadOnly() {
  return <Dates label="Read-only" defaultValue={fixed} readOnly />
}

export function Disabled() {
  return <Dates label="Disabled" defaultValue={fixed} disabled />
}

export function Invalid() {
  return (
    <div className="stack">
      <DateField.Root placeholderValue={fixed}>
        <DateField.Label>Impossible date</DateField.Label>
        <DateField.Input />
        <DateField.Description>
          Type 31 in the day and 2 in the month: February 31 does not exist, so the field is invalid
          until you fix a segment.
        </DateField.Description>
        <DateField.ErrorMessage />
      </DateField.Root>
      <Field.Root invalid>
        <Field.Label>Forced invalid</Field.Label>
        <DateField.Root defaultValue={fixed}>
          <DateField.Input />
        </DateField.Root>
        <Field.ErrorMessage>Pick another date.</Field.ErrorMessage>
      </Field.Root>
    </div>
  )
}

export function Paste() {
  return (
    <div className="stack">
      <Dates label="Paste a date" placeholderValue={fixed} />
      <span className="note">Copy 2026-10-14, focus a segment and paste.</span>
    </div>
  )
}

export function InAField() {
  return (
    <Field.Root name="start" validationMode="blur" required>
      <Field.Label>Start date</Field.Label>
      <DateField.Root placeholderValue={fixed}>
        <DateField.Input />
      </DateField.Root>
      <Field.Description>The error shows after you leave the field.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  )
}

export function Range() {
  return (
    <DateField.Root
      selectionMode="range"
      startName="from"
      endName="to"
      defaultValue={{ start: new CalendarDate(2026, 10, 12), end: new CalendarDate(2026, 10, 16) }}
    >
      <DateField.Label>Stay</DateField.Label>
      <DateField.Input />
      <DateField.ErrorMessage />
    </DateField.Root>
  )
}

export function RangeRules() {
  return (
    <DateField.Root
      selectionMode="range"
      validationMode="blur"
      isDateUnavailable={(date) => isWeekend(date, "en-US")}
    >
      <DateField.Label>Working week</DateField.Label>
      <DateField.Description>Weekends cannot be inside the range.</DateField.Description>
      <DateField.Input />
      <DateField.ErrorMessage />
    </DateField.Root>
  )
}

export const variants: Variants = {
  DatePicker: {
    title: "Date picker",
    description: "Type the date, or open the calendar with the button or Alt+Down.",
  },
  DateRangePicker: {
    title: "Date range picker",
    description: '`selectionMode="range"`: pick the start, then the end; both ends stay typeable.',
  },
  DatePickerOpen: {
    title: "Picker open",
    description: "The calendar opens on the selected date; Escape closes it.",
  },
  DatePickerRules: {
    title: "Range picker with rules",
    description: "Bounds and unavailable days reach the calendar: no range across a weekend.",
  },
  Basic: {
    title: "Basic",
    description: "A date with locale order; type digits or use the arrows.",
  },
  Range: {
    title: "Date range",
    description:
      '`selectionMode="range"`: two ends in one group; typing past the start moves to the end.',
  },
  RangeRules: {
    title: "Range rules",
    description: "An end before the start, or a weekend inside the range, is invalid.",
  },
  DateTime12Hour: {
    title: "Date and time, 12-hour",
    description: '`granularity="minute"` adds the time and the AM/PM segment.',
  },
  DateTime24Hour: { title: "Date and time, 24-hour", description: "`hourCycle={24}`." },
  Zoned: { title: "Zoned", description: "A `ZonedDateTime` shows the zone name." },
  ZonedWithoutName: { title: "Zoned, no zone name", description: "`hideTimeZone`." },
  JapaneseEras: {
    title: "Japanese eras",
    description: "The era is a segment; pass `createCalendar` for non-Gregorian systems.",
  },
  Buddhist: { title: "Buddhist calendar", description: '`locale="th-TH"` shows year 2569.' },
  ArabicRtl: {
    title: "Arabic, right-to-left",
    description: "Digits and segment order follow the locale.",
  },
  MinMax: {
    title: "Min and max",
    description: "A date outside the range makes the field invalid.",
  },
  UnavailableWeekends: {
    title: "Unavailable weekends",
    description: "`isDateUnavailable` makes weekends invalid: type a Saturday.",
  },
  RequiredInForm: {
    title: "Required in a form",
    description: "Submitting empty is blocked; Reset restores the default.",
  },
  ReadOnly: { title: "Read-only", description: "Focusable and copyable; nothing changes." },
  Disabled: { title: "Disabled", description: "Segments are not focusable." },
  Invalid: {
    title: "Invalid",
    description: "An impossible date typed by the user, and `invalid` forced by a Field.",
  },
  Paste: { title: "Paste", description: "A pasted ISO date fills every segment." },
  InAField: {
    title: "In a Field",
    description: '`validationMode="blur"`: moving between segments does not validate.',
  },
}
