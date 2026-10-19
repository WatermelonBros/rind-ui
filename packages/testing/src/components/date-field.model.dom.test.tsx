// Model-based tests: the Date Field contract over the configurations of design §6 (task 7.1).
import {
  CalendarDate,
  CalendarDateTime,
  isWeekend,
  parseZonedDateTime,
  Time,
} from "@internationalized/date"
import { platforms } from "@rind-ui/core"
import { act, render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { dateFieldStepInvariants, testMachine } from "../index"
import { a11y, type Config, modelContract, oracle, Story } from "./date-field-model"

function config(name: string, cfg: Config) {
  describe(`date-field model: ${name}`, () => {
    let pageChanges = 0
    let oracleChanges = 0
    const steps = dateFieldStepInvariants({
      changes: () => pageChanges,
      expectedChanges: () => oracleChanges,
    })
    const contract = modelContract(cfg.platform === platforms.ios)
    testMachine(contract, {
      // Long keyboard paths: more than the 5 s default.
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: async () => {
        pageChanges = 0
        oracleChanges = 0
        const rendered = render(<Story cfg={cfg} onValueChange={() => pageChanges++} />)
        // A host Dialog settles (initial focus, part registration) before the first step.
        if (cfg.inDialog) {
          await screen.findByRole("dialog", { name: "Edit" })
          await act(async () => {})
        }
        return rendered
      },
      target: () => screen,
      anchor: [{ name: "Birthday" }],
      props: oracle(cfg, () => {
        oracleChanges++
      }) as never,
      invariants: steps.invariants,
      ...(cfg.platform ? { platforms: [cfg.platform] } : {}),
      a11y,
    } as never)
  })
}

config("en-US day", {})
config("picker closed", { picker: "closed" })
config("picker open", { picker: "open" })
// Modal: the field is inert while open, so only the closed picker has field steps.
config("picker closed, modal", { picker: "closed", modal: true })
config("picker closed, in a modal Dialog", { picker: "closed", inDialog: true })
config("en-GB day", { locale: "en-GB" })
config("de-DE minute, 24-hour", {
  locale: "de-DE",
  granularity: "minute",
  placeholderValue: new CalendarDateTime(2026, 10, 17),
})
config("en-US minute, 12-hour", {
  granularity: "minute",
  defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30),
})
config("zoned Europe/Lisbon", {
  granularity: "minute",
  defaultValue: parseZonedDateTime("2026-10-14T09:44[Europe/Lisbon]"),
})
// Time values (date-field "Time Values"): a Date Field with no date segments.
config("time, 12-hour", {
  maxGranularity: "hour",
  placeholderValue: new Time(),
  defaultValue: new Time(21, 30),
})
config("time, 24-hour, seconds", {
  locale: "de-DE",
  granularity: "second",
  placeholderValue: new Time(),
})
config("required", { required: true })
config("min and max", {
  defaultValue: new CalendarDate(2026, 10, 14),
  minValue: new CalendarDate(2026, 1, 1),
  maxValue: new CalendarDate(2026, 12, 31),
})
config("weekends unavailable", { isDateUnavailable: (d) => isWeekend(d, "en-US") })
config("read-only", { readOnly: true, defaultValue: new CalendarDate(2026, 10, 14) })
config("inside a Field (change mode)", { inField: true })
config("iOS (quirk: no spinbutton)", { platform: platforms.ios })
config("Android", { platform: platforms.android })
