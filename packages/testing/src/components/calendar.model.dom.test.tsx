// Model-based tests: the Calendar contract over the configurations of design §5 (task 7.1).
import { CalendarDate, createCalendar, GregorianCalendar, isWeekend } from "@internationalized/date"
import { calendarContract, calendarMessages, platforms } from "@rind-ui/core"
import { Calendar, type CalendarRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

const clock = { now: () => Date.parse("2026-10-14T12:00:00Z"), timeZone: () => "UTC" }
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Config = Partial<CalendarRootProps>

// The oracle runs the real machine with the props it reads (gregorian display).
const oracle = (cfg: Config) => ({
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
  disabled: undefined,
  readOnly: cfg.readOnly,
  calendar: new GregorianCalendar(),
  formatLocale: cfg.locale ?? "en-US",
  messages: calendarMessages,
  id: "cal",
  focusCell: () => {},
})

function config(name: string, cfg: Config) {
  describe(`calendar model: ${name}`, () => {
    testMachine(calendarContract, {
      test: it,
      setup: () =>
        render(
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux, dateClock: clock }}
            dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
          >
            <Calendar.Root aria-label="Departure" firstDayOfWeek="sun" {...cfg}>
              <Calendar.Header>
                <Calendar.PrevTrigger />
                <Calendar.Heading />
                <Calendar.NextTrigger />
              </Calendar.Header>
              {Array.from({ length: cfg.visibleMonths ?? 1 }, (_, m) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: months are positions
                <Calendar.Grid key={m} month={m} />
              ))}
            </Calendar.Root>
          </RindProvider>,
        ),
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
// Display calendars: the oracle stays gregorian (paths and values are by day).
void createCalendar
