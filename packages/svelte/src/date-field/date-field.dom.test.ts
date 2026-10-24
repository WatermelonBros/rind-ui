// DOM parity with React: empty, a date, a date-time, a time, in a form, a picker, a range.
import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Parity from "../../fixtures/date-field/parity.svelte"
import { clock } from "../../fixtures/date-field-model"
import { clientParity } from "../../fixtures/parity"

type P = Record<string, unknown>
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
              ),
            ),
          )
        : null,
    ),
  )
// React's `readOnly` is the Svelte Field's `readonly`.
const own = (p: P): P => {
  const { readOnly, ...rest } = p
  return readOnly === undefined ? rest : { ...rest, readonly: readOnly }
}
const svelte = (p: P, picker = false) => ({ root: own(p), picker, clock }) as never

describe("Svelte DateField matches React", () => {
  it("empty, a date, a date-time, a time, in a form, read-only", async () => {
    for (const p of [
      {},
      { defaultValue: new CalendarDate(2026, 10, 14) },
      { granularity: "minute", defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30) },
      { maxGranularity: "hour", defaultValue: new Time(21, 30) },
      { name: "date", required: true },
      { readOnly: true, defaultValue: new CalendarDate(2026, 10, 14) },
    ] as P[]) {
      await clientParity(react(p), Parity, svelte(p))
    }
  })
  it("a picker, closed and open", async () => {
    for (const p of [
      {},
      { defaultOpen: true, defaultValue: new CalendarDate(2026, 10, 14) },
    ] as P[]) {
      await clientParity(react(p, true), Parity, svelte(p, true))
    }
  })
  it("a range", async () => {
    for (const p of [
      { selectionMode: "range", startName: "from", endName: "to" },
      {
        selectionMode: "range",
        defaultValue: {
          start: new CalendarDate(2026, 10, 14),
          end: new CalendarDate(2026, 10, 16),
        },
      },
    ] as P[]) {
      await clientParity(react(p), Parity, svelte(p))
    }
  })
})
