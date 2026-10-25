// The Calendar model-test helper (React's calendar-model.tsx, against the Angular parts): the
// oracle props, the story and the clock, shared by the calendar*.model tests.
import { Component } from "@angular/core"
import { CalendarDate, GregorianCalendar } from "@internationalized/date"
import { calendarContract, calendarMessages, platforms } from "@rind-ui/core"
import { currentRun, fixedDateClock, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, it } from "vitest"
import { Calendar } from "../src/calendar/calendar"
import { RindProvider } from "../src/provider"
import { mount } from "./mount"

export const clock = fixedDateClock("2026-10-14T12:00:00Z")
export const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

/** React's Root props, by name (the Angular inputs have the same names). */
export interface Config {
  readonly visibleMonths?: number
  readonly pageBehavior?: "visible" | "single"
  readonly minValue?: CalendarDate
  readonly maxValue?: CalendarDate
  readonly locale?: string
  readonly firstDayOfWeek?: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
  readonly selectionMode?: "single" | "multiple" | "range"
  readonly isDateUnavailable?: (date: CalendarDate) => boolean
  readonly minRangeLength?: number
  readonly maxRangeLength?: number
  readonly allowsNonContiguousRanges?: boolean
  readonly commitOnBlur?: "reset" | "clear" | "select"
  readonly readOnly?: boolean
  readonly defaultView?: "days" | "months" | "years"
  readonly minView?: "days" | "months" | "years"
  readonly maxView?: "days" | "months" | "years"
  readonly yearsPerPage?: number
  readonly columns?: number
  readonly isMonthUnavailable?: (month: CalendarDate) => boolean
  readonly isYearUnavailable?: (year: CalendarDate) => boolean
}

// The oracle runs the real machine with the props it reads (gregorian display).
export const oracle = (cfg: Config) => ({
  visibleMonths: cfg.visibleMonths ?? 1,
  pageBehavior: cfg.pageBehavior ?? "visible",
  minValue: (cfg.minValue as CalendarDate | undefined) ?? null,
  maxValue: (cfg.maxValue as CalendarDate | undefined) ?? null,
  locale: cfg.locale ?? "en-US",
  firstDayOfWeek: cfg.firstDayOfWeek ?? "sun",
  value: undefined,
  defaultValue: undefined,
  onValueChange: undefined,
  focusedValue: undefined,
  defaultFocusedValue: new CalendarDate(2026, 10, 14),
  onFocusedValueChange: undefined,
  selectionMode: cfg.selectionMode ?? "single",
  isDateUnavailable: cfg.isDateUnavailable,
  anchor: undefined,
  defaultAnchor: undefined,
  onAnchorChange: undefined,
  minRangeLength: cfg.minRangeLength,
  maxRangeLength: cfg.maxRangeLength,
  allowsNonContiguousRanges: cfg.allowsNonContiguousRanges,
  commitOnBlur: cfg.commitOnBlur,
  disabled: undefined,
  readOnly: cfg.readOnly,
  calendar: new GregorianCalendar(),
  formatLocale: cfg.locale ?? "en-US",
  messages: calendarMessages,
  id: "cal",
  focusCell: () => {},
  view: undefined,
  defaultView: cfg.defaultView ?? cfg.minView ?? "days",
  onViewChange: undefined,
  minView: cfg.minView ?? "days",
  maxView: cfg.maxView ?? "years",
  yearsPerPage: cfg.yearsPerPage,
  columns: cfg.columns,
  isMonthUnavailable: cfg.isMonthUnavailable,
  isYearUnavailable: cfg.isYearUnavailable,
})

/** The configuration the next story renders. */
let current: Config = {}

/** The model's story: the Calendar under the run's platform and direction, with a fixed clock. */
@Component({
  selector: "rind-f",
  imports: [RindProvider, Calendar],
  template: `<ng-container rindProvider [environment]="env" [dir]="dir">
    <div
      rindCalendarRoot
      aria-label="Departure"
      [firstDayOfWeek]="c.firstDayOfWeek ?? 'sun'"
      [visibleMonths]="c.visibleMonths ?? 1"
      [pageBehavior]="c.pageBehavior ?? 'visible'"
      [minValue]="c.minValue ?? null"
      [maxValue]="c.maxValue ?? null"
      [locale]="c.locale"
      [selectionMode]="c.selectionMode ?? 'single'"
      [isDateUnavailable]="c.isDateUnavailable"
      [minRangeLength]="c.minRangeLength"
      [maxRangeLength]="c.maxRangeLength"
      [allowsNonContiguousRanges]="c.allowsNonContiguousRanges ?? false"
      [commitOnBlur]="c.commitOnBlur ?? 'reset'"
      [readOnly]="c.readOnly ?? false"
      [defaultView]="c.defaultView"
      [minView]="c.minView ?? 'days'"
      [maxView]="c.maxView ?? 'years'"
      [yearsPerPage]="c.yearsPerPage"
      [columns]="c.columns"
      [isMonthUnavailable]="c.isMonthUnavailable"
      [isYearUnavailable]="c.isYearUnavailable"
    >
      <div rindCalendarHeader>
        <button rindCalendarPrevTrigger></button>
        <h2 rindCalendarHeading></h2>
        <button rindCalendarNextTrigger></button>
      </div>
      @for (m of months; track m) {
        <table rindCalendarGrid [month]="m"></table>
      }
    </div>
  </ng-container>`,
})
class Story {
  readonly c = current
  readonly months = Array.from({ length: current.visibleMonths ?? 1 }, (_, m) => m)
  readonly env = { platform: currentRun()?.platform ?? platforms.linux, dateClock: clock }
  readonly dir = currentRun()?.direction === "rtl" ? "rtl" : "ltr"
}

/** One configuration's model-based run (the calendar*.model tests, split as React's). */
export function config(name: string, cfg: Config) {
  describe(`angular calendar model: ${name}`, () => {
    testMachine(calendarContract, {
      // Long keyboard paths on a loaded machine: more than the 5 s default.
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () => {
        current = cfg
        return mount(Story)
      },
      target: () => screen,
      anchor: [{ name: "Departure" }],
      props: oracle(cfg) as never,
      a11y,
    } as never)
  })
}
