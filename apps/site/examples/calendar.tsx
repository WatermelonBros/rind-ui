"use client"

import {
  CalendarDate,
  createCalendar,
  getLocalTimeZone,
  isWeekend,
  today,
} from "@internationalized/date"
import type { CalendarValue, CalendarView } from "@rind-ui/core"
import { Calendar, type CalendarRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** `focused` needs real focus inside the grid: it is reached by the driver. */
export const states: States = {
  calendar: { idle: "Single", months: "MonthPicker", years: "YearPicker" },
}

/** Header with both pagers and the heading, then one grid per visible month. */
function Cal({
  label,
  months = 1,
  ...root
}: CalendarRootProps & { readonly label: string; readonly months?: number }) {
  return (
    <Calendar.Root aria-label={label} visibleMonths={months} {...root}>
      <Calendar.Header>
        <Calendar.PrevTrigger />
        <Calendar.Heading />
        <Calendar.NextTrigger />
      </Calendar.Header>
      {Array.from({ length: months }, (_, m) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: months are positions
        <Calendar.Grid key={m} month={m} />
      ))}
    </Calendar.Root>
  )
}

const now = () => today(getLocalTimeZone())

export function Single() {
  const [value, setValue] = useState<CalendarValue>(null)
  return (
    <div className="stack">
      {/* A fixed month: the state example's ARIA snapshot never depends on today. */}
      <Cal
        label="Departure"
        value={value}
        onValueChange={(v) => setValue(v)}
        defaultFocusedValue={new CalendarDate(2026, 10, 14)}
      />
      <span className="note">selected: {value ? String(value) : "none"}</span>
    </div>
  )
}

export function Multiple() {
  return <Cal label="Days off" selectionMode="multiple" />
}

export function TwoMonths() {
  return <Cal label="Trip dates" months={2} />
}

export function ThreeMonthsSinglePaging() {
  return <Cal label="Quarter" months={3} pageBehavior="single" />
}

export function MinMax() {
  const start = now()
  return (
    <Cal
      label="Next two weeks"
      minValue={start}
      maxValue={start.add({ days: 14 })}
      defaultValue={start.add({ days: 3 })}
    />
  )
}

export function UnavailableWeekends() {
  return <Cal label="Weekdays only" isDateUnavailable={(d) => isWeekend(d, "en-US")} />
}

export function MondayWeeks() {
  return <Cal label="Monday first" firstDayOfWeek="mon" />
}

export function Arabic() {
  return <Cal label="التاريخ" locale="ar-EG" dir="rtl" />
}

export function ThaiBuddhist() {
  return <Cal label="วันที่" locale="th-TH" createCalendar={createCalendar} />
}

export function ReadOnly() {
  return <Cal label="Read-only" readOnly defaultValue={now()} />
}

export function Disabled() {
  return <Cal label="Disabled" disabled defaultValue={now()} />
}

export function Invalid() {
  const start = now()
  // The selected date is outside the allowed range: the root and the cell turn invalid.
  return (
    <Cal
      label="Out of range"
      minValue={start.add({ days: 1 })}
      defaultValue={start.subtract({ days: 3 })}
    />
  )
}

export function ControlledFocus() {
  const [focused, setFocused] = useState<CalendarDate>(() => new CalendarDate(2026, 10, 14))
  return (
    <div className="stack">
      <Cal label="Controlled focus" focusedValue={focused} onFocusChange={setFocused} />
      <button type="button" onClick={() => setFocused(new CalendarDate(2027, 1, 1))}>
        Go to 1 January 2027
      </button>
      <span className="note">focused: {String(focused)}</span>
    </div>
  )
}

export function Range() {
  const [value, setValue] = useState<CalendarValue>(null)
  const range =
    value && "start" in (value as object) ? (value as { start: unknown; end: unknown }) : null
  return (
    <div className="stack">
      <Cal
        label="Stay"
        months={2}
        selectionMode="range"
        value={value}
        onValueChange={(v) => setValue(v)}
        defaultFocusedValue={new CalendarDate(2026, 10, 14)}
      />
      <span className="note">
        range: {range ? `${String(range.start)} to ${String(range.end)}` : "none"}
      </span>
    </div>
  )
}

export function RangeRules() {
  return (
    <Cal
      label="Booking"
      selectionMode="range"
      maxRangeLength={7}
      isDateUnavailable={(date) => isWeekend(date, "en-US")}
      defaultFocusedValue={new CalendarDate(2026, 10, 14)}
    />
  )
}

export function RangeShown() {
  return (
    <Cal
      label="Trip"
      selectionMode="range"
      defaultValue={{ start: new CalendarDate(2026, 10, 12), end: new CalendarDate(2026, 10, 16) }}
      defaultFocusedValue={new CalendarDate(2026, 10, 14)}
    />
  )
}

/** A month picker: the value is chosen in the months view (`minView`); the heading opens years. */
export function MonthPicker() {
  const [value, setValue] = useState<CalendarValue>(null)
  return (
    <div className="stack">
      <Cal
        label="Billing month"
        minView="months"
        value={value}
        onValueChange={(v) => setValue(v)}
        defaultFocusedValue={new CalendarDate(2026, 10, 14)}
      />
      <span className="note">selected: {value ? String(value) : "none"}</span>
    </div>
  )
}

export function YearPicker() {
  return (
    <Cal label="Model year" minView="years" defaultFocusedValue={new CalendarDate(2026, 10, 14)} />
  )
}

export function MonthRange() {
  return (
    <Cal
      label="Contract"
      minView="months"
      selectionMode="range"
      defaultValue={{ start: new CalendarDate(2026, 10, 1), end: new CalendarDate(2027, 4, 1) }}
      defaultFocusedValue={new CalendarDate(2026, 10, 14)}
    />
  )
}

export function DrillDown() {
  const [view, setView] = useState<CalendarView>("days")
  return (
    <div className="stack">
      <Cal
        label="Birthday"
        view={view}
        onViewChange={setView}
        defaultFocusedValue={new CalendarDate(1990, 6, 15)}
      />
      <span className="note">view: {view}</span>
    </div>
  )
}

export const variants: Variants = {
  Single: { title: "Single date", description: "Click or press Enter or Space to select." },
  Multiple: {
    title: "Multiple dates",
    description: '`selectionMode="multiple"` toggles each date.',
  },
  Range: {
    title: "Date range",
    description:
      '`selectionMode="range"`: the first date is the anchor, the second ends the range; Escape cancels.',
  },
  RangeRules: {
    title: "Range rules",
    description:
      "`maxRangeLength={7}` and unavailable weekends: dates no range can end on are disabled while anchored.",
  },
  RangeShown: { title: "A committed range", hidden: true },
  TwoMonths: { title: "Two months", description: "`visibleMonths={2}`; paging moves both." },
  ThreeMonthsSinglePaging: {
    title: "Three months, one at a time",
    description: '`pageBehavior="single"` pages by one month, not by the visible span.',
  },
  MinMax: {
    title: "Minimum and maximum",
    description: "Dates outside the range are disabled; the pagers stop at the bounds.",
  },
  UnavailableWeekends: {
    title: "Unavailable dates",
    description: "`isDateUnavailable` strikes weekends: focusable, never selectable.",
  },
  MondayWeeks: { title: "Monday first", description: '`firstDayOfWeek="mon"`.' },
  Arabic: { title: "Arabic (RTL)", description: '`locale="ar-EG" dir="rtl"` mirrors the keys.' },
  ThaiBuddhist: {
    title: "Buddhist calendar",
    description: '`locale="th-TH"` with `createCalendar` from `@internationalized/date`.',
  },
  ReadOnly: { title: "Read-only", description: "The value is shown and cannot change." },
  Disabled: { title: "Disabled", description: "No date is focusable or selectable." },
  Invalid: {
    title: "Invalid",
    description: "A selected date that is out of range or unavailable marks the calendar invalid.",
  },
  MonthPicker: {
    title: "Month picker",
    description:
      '`minView="months"`: the value is a month (its day and time kept); the heading opens the years.',
  },
  YearPicker: { title: "Year picker", description: '`minView="years"`: pages of 12 years.' },
  MonthRange: {
    title: "Range of months",
    description: "Range mode in the months view: the band runs across the rows.",
  },
  DrillDown: {
    title: "Drill-down",
    description:
      "The heading goes up (days, months, years); a pick goes back down; Escape goes down one view.",
  },
  ControlledFocus: {
    title: "Controlled focused date",
    description: "`focusedValue` and `onFocusChange` let the page move the visible month.",
  },
}
