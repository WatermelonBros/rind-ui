/** @jsxImportSource solid-js */
// Markup parity with React: a value, a range, two months, the month and year views, disabled.
import { CalendarDate } from "@internationalized/date"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { clock } from "../../fixtures/calendar-model"
import { clientParity } from "../../fixtures/parity"
import { Calendar, type CalendarRootProps, RindProvider } from "../index"

type P = Record<string, unknown>
const months = (p: P) => (p["visibleMonths"] as number | undefined) ?? 1
const solid = (p: P): JSX.Element => (
  <RindProvider environment={{ dateClock: clock }}>
    <Calendar.Root id="cal" aria-label="Departure" {...(p as CalendarRootProps)}>
      <Calendar.Header>
        <Calendar.PrevTrigger />
        <Calendar.Heading />
        <Calendar.NextTrigger />
      </Calendar.Header>
      <For each={Array.from({ length: months(p) }, (_, m) => m)}>
        {(m) => <Calendar.Grid month={m} />}
      </For>
    </Calendar.Root>
  </RindProvider>
)
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
      ...Array.from({ length: months(p) }, (_, m) => r(R.Calendar.Grid, { key: m, month: m })),
    ),
  )

describe("Solid Calendar matches React", () => {
  it("value, range, two months, views, disabled", async () => {
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
      await clientParity(react(p), () => solid(p))
    }
  })
})
