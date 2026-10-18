// Model-based tests: the Date Field contract over the configurations of design §6 (task 7.1).
import {
  CalendarDate,
  CalendarDateTime,
  isWeekend,
  parseZonedDateTime,
} from "@internationalized/date"
import { platforms } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
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
      setup: () => {
        pageChanges = 0
        oracleChanges = 0
        return render(<Story cfg={cfg} onValueChange={() => pageChanges++} />)
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
