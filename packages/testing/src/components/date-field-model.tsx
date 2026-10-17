// The Date Field model-test helper (task 7.1): the oracle props and the story, shared by
// date-field.model.dom.test.tsx and date-field.broken.dom.test.tsx.
import { CalendarDate, type DateValue, GregorianCalendar } from "@internationalized/date"
import { type DateFieldProps, platforms } from "@rind-ui/core"
import { DateField, type DateFieldRootProps, Field, RindProvider } from "@rind-ui/react"
import axe from "axe-core"
import type { ReactNode } from "react"
import { currentRun, fixedDateClock } from "../index"

export const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")
/** Today on the clock: the placeholder both the page and the oracle step from. */
export const PLACEHOLDER = new CalendarDate(2026, 10, 17)

export const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

export type Config = Partial<DateFieldRootProps> & {
  readonly inField?: boolean
  readonly platform?: (typeof platforms)[keyof typeof platforms]
}

/** The oracle runs the real machine with the props it reads (gregorian display). */
export const oracle = (cfg: Config, onValueChange?: () => void): DateFieldProps => ({
  value: undefined,
  defaultValue: (cfg.defaultValue as DateValue | null | undefined) ?? null,
  onValueChange,
  placeholderValue: (cfg.placeholderValue as DateValue | undefined) ?? PLACEHOLDER,
  locale: cfg.locale ?? "en-US",
  calendar: new GregorianCalendar(),
  granularity: cfg.granularity,
  hourCycle: cfg.hourCycle,
  hideTimeZone: cfg.hideTimeZone,
  shouldForceLeadingZeros: cfg.shouldForceLeadingZeros,
  disabled: cfg.disabled,
  readOnly: cfg.readOnly,
  focusSegment: () => {},
  id: "date",
})

/** The model's story: the field in a form (Reset button), under the run's platform and direction. */
export function Story({
  cfg,
  onValueChange,
  children,
}: {
  readonly cfg: Config
  readonly onValueChange?: () => void
  readonly children?: ReactNode
}) {
  const { inField, platform, ...root } = cfg
  const field = (
    <DateField.Root name="date" {...root} {...(onValueChange ? { onValueChange } : {})}>
      {inField ? null : <DateField.Label>Birthday</DateField.Label>}
      <DateField.Input />
    </DateField.Root>
  )
  return (
    <RindProvider
      environment={{
        platform: platform ?? currentRun()?.platform ?? platforms.linux,
        dateClock: clock,
      }}
      dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
    >
      <form onSubmit={(e) => e.preventDefault()}>
        {inField ? (
          <Field.Root validationMode="change">
            <Field.Label>Birthday</Field.Label>
            {field}
            <Field.ErrorMessage />
          </Field.Root>
        ) : (
          field
        )}
        <button type="reset">Reset</button>
      </form>
      {children}
    </RindProvider>
  )
}
