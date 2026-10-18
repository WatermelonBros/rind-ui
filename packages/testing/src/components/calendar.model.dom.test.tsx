// Model-based tests: the Calendar contract over the configurations of design §5 (task 7.1).
import { CalendarDate, createCalendar, isWeekend } from "@internationalized/date"
import { calendarContract } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { testMachine } from "../index"
import { a11y, type Config, oracle, Story } from "./calendar-model"

function config(name: string, cfg: Config) {
  describe(`calendar model: ${name}`, () => {
    testMachine(calendarContract, {
      // Long keyboard paths on a loaded machine: more than the 5 s default.
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () => render(<Story cfg={cfg} />),
      target: () => screen,
      anchor: [{ name: "Departure" }],
      props: oracle(cfg) as never,
      a11y,
    } as never)
  })
}

config("en-US, one month", {})
config("en-GB, Monday weeks", { locale: "en-GB", firstDayOfWeek: "mon" })
config("two months, single paging", { visibleMonths: 2, pageBehavior: "single" })
config("multiple selection", { selectionMode: "multiple" })
config("min and max", {
  minValue: new CalendarDate(2026, 10, 5),
  maxValue: new CalendarDate(2026, 11, 20),
})
config("weekends unavailable", { isDateUnavailable: (d) => isWeekend(d, "en-US") })
config("read-only", { readOnly: true })
config("range", { selectionMode: "range" })
config("range, 2–7 days", { selectionMode: "range", minRangeLength: 2, maxRangeLength: 7 })
config("range, weekends unavailable (contiguous)", {
  selectionMode: "range",
  isDateUnavailable: (d) => isWeekend(d, "en-US"),
})
config("range, weekends unavailable (non-contiguous)", {
  selectionMode: "range",
  isDateUnavailable: (d) => isWeekend(d, "en-US"),
  allowsNonContiguousRanges: true,
})
// Display calendars: the oracle stays gregorian (paths and values are by day).
void createCalendar
