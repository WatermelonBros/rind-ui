// The Calendar model-test helper (task 7.1): the oracle props, the story and the clock,
// shared by calendar.model.dom.test.tsx and calendar.broken.dom.test.tsx.
import { CalendarDate, GregorianCalendar } from "@internationalized/date"
import { calendarMessages, platforms } from "@rind-ui/core"
import { Calendar, type CalendarRootProps, RindProvider } from "@rind-ui/react"
import axe from "axe-core"
import type { ReactNode } from "react"
import { currentRun, fixedDateClock } from "../index"

export const clock = fixedDateClock("2026-10-14T12:00:00Z")
export const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

export type Config = Partial<CalendarRootProps>

// The oracle runs the real machine with the props it reads (gregorian display).
export const oracle = (cfg: Config) => ({
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

/** The model's story: the Calendar under the run's platform and direction, with a fixed clock. */
export function Story({ cfg, children }: { readonly cfg: Config; readonly children?: ReactNode }) {
  return (
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
      {children}
    </RindProvider>
  )
}
