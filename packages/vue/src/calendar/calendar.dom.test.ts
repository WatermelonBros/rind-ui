// Markup parity with React: a value, a range, two months, the month and year views, disabled.
import { CalendarDate } from "@internationalized/date"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { clock } from "../../fixtures/calendar-model"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Calendar, RindProvider } from "../index"

type P = Record<string, unknown>
const months = (p: P) => (p["visibleMonths"] as number | undefined) ?? 1
const vue = (p: P) => () =>
  h(RindProvider, { environment: { dateClock: clock } }, () =>
    h(Calendar.Root, { id: "cal", "aria-label": "Departure", ...p }, () => [
      h(Calendar.Header, null, () => [
        h(Calendar.PrevTrigger),
        h(Calendar.Heading),
        h(Calendar.NextTrigger),
      ]),
      ...Array.from({ length: months(p) }, (_, m) => h(Calendar.Grid, { key: m, month: m })),
    ]),
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

describe("Vue Calendar matches React", () => {
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
      await serverParity(react(p), vue(p))
      await clientParity(react(p), vue(p))
    }
  })
})
