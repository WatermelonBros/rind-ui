// Markup parity with React: a value, a range, two months, the month and year views, disabled.
import { Component } from "@angular/core"
import { CalendarDate } from "@internationalized/date"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { clock } from "../../fixtures/calendar-model"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Calendar } from "./calendar"

interface P {
  readonly defaultValue?: CalendarDate | { start: CalendarDate; end: CalendarDate }
  readonly selectionMode?: "single" | "multiple" | "range"
  readonly visibleMonths?: number
  readonly firstDayOfWeek?: "sun" | "mon"
  readonly locale?: string
  readonly minView?: "days" | "months" | "years"
  readonly defaultView?: "days" | "months" | "years"
  readonly disabled?: boolean
  readonly minValue?: CalendarDate
}
/** The configuration the next fixture renders. */
let current: P = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, Calendar],
  template: `<ng-container rindProvider [environment]="env">
    <div
      rindCalendarRoot
      id="cal"
      aria-label="Departure"
      [defaultValue]="p.defaultValue"
      [selectionMode]="p.selectionMode ?? 'single'"
      [visibleMonths]="p.visibleMonths ?? 1"
      [firstDayOfWeek]="p.firstDayOfWeek"
      [locale]="p.locale"
      [minView]="p.minView ?? 'days'"
      [defaultView]="p.defaultView"
      [disabled]="p.disabled ?? false"
      [minValue]="p.minValue ?? null"
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
class Fixture {
  readonly p = current
  readonly months = Array.from({ length: current.visibleMonths ?? 1 }, (_, m) => m)
  readonly env = { dateClock: clock }
}

const react = (p: P) =>
  r(
    R.RindProvider,
    { environment: { dateClock: clock } },
    r(
      R.Calendar.Root,
      { id: "cal", "aria-label": "Departure", ...p } as never,
      r(
        R.Calendar.Header,
        null,
        r(R.Calendar.PrevTrigger),
        r(R.Calendar.Heading),
        r(R.Calendar.NextTrigger),
      ),
      ...Array.from({ length: p.visibleMonths ?? 1 }, (_, m) =>
        r(R.Calendar.Grid, { key: m, month: m }),
      ),
    ),
  )

describe("Angular Calendar matches React", () => {
  for (const p of [
    {},
    { defaultValue: new CalendarDate(2026, 10, 20) },
    {
      selectionMode: "range",
      defaultValue: { start: new CalendarDate(2026, 10, 3), end: new CalendarDate(2026, 10, 9) },
    },
    { visibleMonths: 2, firstDayOfWeek: "mon", locale: "en-GB" },
    { minView: "months" },
    { defaultView: "years" },
    { disabled: true, minValue: new CalendarDate(2026, 10, 5) },
  ] as P[]) {
    it(JSON.stringify(p), async () => {
      current = p
      await both(react(p), Fixture)
    })
  }
})
