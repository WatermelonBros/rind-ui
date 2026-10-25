// Markup parity with React: empty, a date, a date-time, a time, in a form, a picker, a range;
// the picker's CloseTrigger closes it.
import { ApplicationRef, Component } from "@angular/core"
import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"
import type { DateRangeFieldValue, FieldValue } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { clock } from "../../fixtures/date-field-model"
import { mount } from "../../fixtures/mount"
import { both, clientParity } from "../../fixtures/parity"
import { Calendar } from "../calendar/calendar"
import { RindProvider } from "../provider"
import { DateField } from "./index"

interface P {
  readonly defaultValue?: FieldValue | DateRangeFieldValue
  readonly granularity?: "minute"
  readonly maxGranularity?: "hour"
  readonly name?: string
  readonly required?: boolean
  readonly readOnly?: boolean
  readonly defaultOpen?: boolean
  readonly selectionMode?: "range"
  readonly startName?: string
  readonly endName?: string
}
/** The configuration the next fixture renders. */
let current: { p: P; picker: boolean } = { p: {}, picker: false }

const CONTENT = `<label rindDateFieldLabel>Birthday</label>
      @if (picker) {
        <div rindDateFieldControl>
          <div rindDateFieldInput></div>
          <button rindDateFieldTrigger>▾</button>
          <button rindDateFieldClearTrigger>×</button>
        </div>
      } @else {
        <div rindDateFieldInput></div>
      }
      <p rindDateFieldDescription>When you were born.</p>
      @if (picker) {
        <ng-template rindDateFieldPortal>
          <div rindDateFieldPositioner>
            <div rindDateFieldContent>
              <div rindDateFieldCalendar>
                <div rindCalendarHeader>
                  <button rindCalendarPrevTrigger></button>
                  <h2 rindCalendarHeading></h2>
                  <button rindCalendarNextTrigger></button>
                </div>
                <table rindCalendarGrid></table>
              </div>
              <button rindDateFieldCloseTrigger>Done</button>
            </div>
          </div>
        </ng-template>
      }`

@Component({
  selector: "rind-f",
  imports: [RindProvider, DateField, Calendar],
  template: `<ng-container rindProvider [environment]="env">
    @if (p.selectionMode) {
      <div
        rindDateFieldRoot
        selectionMode="range"
        id="date"
        locale="en-US"
        [defaultValue]="$any(p.defaultValue)"
        [startName]="p.startName"
        [endName]="p.endName"
      >
        ${CONTENT}
      </div>
    } @else {
      <div
        rindDateFieldRoot
        id="date"
        locale="en-US"
        [defaultValue]="$any(p.defaultValue) ?? null"
        [granularity]="p.granularity"
        [maxGranularity]="p.maxGranularity"
        [name]="p.name"
        [required]="p.required ?? false"
        [readonly]="p.readOnly ?? false"
        [defaultOpen]="p.defaultOpen"
      >
        ${CONTENT}
      </div>
    }
  </ng-container>`,
})
class Fixture {
  readonly p = current.p
  readonly picker = current.picker
  readonly env = { dateClock: clock }
}

const react = (p: P, picker = false) =>
  r(
    R.RindProvider,
    { environment: { dateClock: clock } },
    r(
      R.DateField.Root,
      { id: "date", locale: "en-US", ...p } as never,
      r(R.DateField.Label, null, "Birthday"),
      picker
        ? r(
            R.DateField.Control,
            null,
            r(R.DateField.Input),
            r(R.DateField.Trigger, null, "▾"),
            r(R.DateField.ClearTrigger, null, "×"),
          )
        : r(R.DateField.Input),
      r(R.DateField.Description, null, "When you were born."),
      picker
        ? r(
            R.DateField.Portal,
            null,
            r(
              R.DateField.Positioner,
              null,
              r(
                R.DateField.Content,
                null,
                r(
                  R.DateField.Calendar,
                  null,
                  r(
                    R.Calendar.Header,
                    null,
                    r(R.Calendar.PrevTrigger),
                    r(R.Calendar.Heading),
                    r(R.Calendar.NextTrigger),
                  ),
                  r(R.Calendar.Grid),
                ),
                r(R.DateField.CloseTrigger, null, "Done"),
              ),
            ),
          )
        : null,
    ),
  )

describe("Angular DateField matches React", () => {
  for (const p of [
    {},
    { defaultValue: new CalendarDate(2026, 10, 14) },
    { granularity: "minute", defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30) },
    { maxGranularity: "hour", defaultValue: new Time(21, 30) },
    { name: "date", required: true },
    { readOnly: true, defaultValue: new CalendarDate(2026, 10, 14) },
  ] as P[]) {
    it(`single ${JSON.stringify(p)}`, async () => {
      current = { p, picker: false }
      await both(react(p), Fixture)
    })
  }
  for (const p of [
    {},
    { defaultOpen: true, defaultValue: new CalendarDate(2026, 10, 14) },
  ] as P[]) {
    it(`a picker ${JSON.stringify(p)}`, async () => {
      current = { p, picker: true }
      await clientParity(react(p, true), Fixture)
    })
  }
  for (const p of [
    { selectionMode: "range", startName: "from", endName: "to" },
    {
      selectionMode: "range",
      defaultValue: { start: new CalendarDate(2026, 10, 14), end: new CalendarDate(2026, 10, 16) },
    },
  ] as P[]) {
    it(`a range ${JSON.stringify(p)}`, async () => {
      current = { p, picker: false }
      await both(react(p), Fixture)
    })
  }
})

describe("Angular DateField CloseTrigger", () => {
  it("closes the open picker", async () => {
    current = { p: { defaultOpen: true }, picker: true }
    const { ref } = await mount(Fixture)
    const content = "[data-scope=date-field][data-part=content]"
    expect(document.querySelector(content)).not.toBeNull()
    const done = [...document.querySelectorAll("button")].find((b) => b.textContent === "Done")
    expect(done).toBeDefined()
    done?.click()
    await ref.injector.get(ApplicationRef).whenStable()
    expect(document.querySelector(content)).toBeNull()
  })
})
