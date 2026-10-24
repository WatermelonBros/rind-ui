// Markup parity with React: empty, a date, a date-time, a time, in a form, a picker, a range.
import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { clock } from "../../fixtures/date-field-model"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Calendar, DateField, RindProvider } from "../index"

type P = Record<string, unknown>
const vue =
  (p: P, picker = false) =>
  () =>
    h(RindProvider, { environment: { dateClock: clock } }, () =>
      h(DateField.Root, { id: "date", locale: "en-US", ...p }, () => [
        h(DateField.Label, null, () => "Birthday"),
        picker
          ? h(DateField.Control, null, () => [
              h(DateField.Input),
              h(DateField.Trigger, null, () => "▾"),
              h(DateField.ClearTrigger, null, () => "×"),
            ])
          : h(DateField.Input),
        h(DateField.Description, null, () => "When you were born."),
        ...(picker
          ? [
              h(DateField.Portal, null, () =>
                h(DateField.Positioner, null, () =>
                  h(DateField.Content, null, () =>
                    h(DateField.Calendar, null, () => [
                      h(Calendar.Header, null, () => [
                        h(Calendar.PrevTrigger),
                        h(Calendar.Heading),
                        h(Calendar.NextTrigger),
                      ]),
                      h(Calendar.Grid),
                    ]),
                  ),
                ),
              ),
            ]
          : []),
      ]),
    )
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
// React's `readOnly` is the Vue Field's `readonly`.
const vueProps = (p: P): P => {
  const { readOnly, ...rest } = p
  return readOnly === undefined ? rest : { ...rest, readonly: readOnly }
}

describe("Vue DateField matches React", () => {
  it("empty, a date, a date-time, a time, in a form, read-only", async () => {
    for (const p of [
      {},
      { defaultValue: new CalendarDate(2026, 10, 14) },
      { granularity: "minute", defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30) },
      { maxGranularity: "hour", defaultValue: new Time(21, 30) },
      { name: "date", required: true },
      { readOnly: true, defaultValue: new CalendarDate(2026, 10, 14) },
    ] as P[]) {
      await serverParity(react(p), vue(vueProps(p)))
      await clientParity(react(p), vue(vueProps(p)))
    }
  })
  it("a picker, closed and open", async () => {
    for (const p of [
      {},
      { defaultOpen: true, defaultValue: new CalendarDate(2026, 10, 14) },
    ] as P[]) {
      await clientParity(react(p, true), vue(p, true))
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
      await serverParity(react(p), vue(p))
      await clientParity(react(p), vue(p))
    }
  })
})
