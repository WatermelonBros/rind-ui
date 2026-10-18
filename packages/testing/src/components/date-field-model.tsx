// The Date Field model-test helper (task 7.1): the oracle props and the story, shared by
// date-field.model.dom.test.tsx and date-field.broken.dom.test.tsx.
import { CalendarDate, type DateValue, GregorianCalendar } from "@internationalized/date"
import { type DateFieldProps, dateFieldContract, platforms } from "@rind-ui/core"
import { Calendar, DateField, type DateFieldRootProps, Field, RindProvider } from "@rind-ui/react"
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
  /** Render the picker parts (the popover closed, or open from the start). */
  readonly picker?: "closed" | "open"
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
  const { inField, platform, picker, ...root } = cfg
  const field = (
    <DateField.Root
      name="date"
      {...root}
      {...(onValueChange ? { onValueChange } : {})}
      {...(picker === "open" ? { defaultOpen: true } : {})}
    >
      {inField ? null : <DateField.Label>Birthday</DateField.Label>}
      {picker ? <PickerParts /> : <DateField.Input />}
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

/** The picker parts around the Input: a Control, a trigger and the Calendar in a popover. */
function PickerParts() {
  return (
    <>
      <DateField.Control>
        <DateField.Input />
        <DateField.Trigger>
          <span aria-hidden="true">▾</span>
        </DateField.Trigger>
      </DateField.Control>
      <DateField.Portal>
        <DateField.Positioner>
          <DateField.Content>
            <DateField.Calendar>
              <Calendar.Header>
                <Calendar.PrevTrigger />
                <Calendar.Heading />
                <Calendar.NextTrigger />
              </Calendar.Header>
              <Calendar.Grid />
            </DateField.Calendar>
          </DateField.Content>
        </DateField.Positioner>
      </DateField.Portal>
    </>
  )
}

type EnvLike = {
  focused(): { compose(updates: readonly string[], commit?: string): Promise<void> }
}

/**
 * As in the Number Input and Text Field models: the DOM adapter's `type` clicks a text input
 * first (a pointer step, no ring by design), so typing into the focused segment is a
 * committed composition of the text there.
 */
const typed = async (env: EnvLike, text: string) =>
  env.focused().compose(
    [...text].map((_, i) => text.slice(0, i + 1)),
    text,
  )

/** The contract the model tests walk (iOS: no `valued`, the quirk drops the value attributes). */
export function modelContract(ios = false): typeof dateFieldContract {
  const base = dateFieldContract
  const contract = {
    ...base,
    actions: { ...base.actions, typeFocused: { ...base.actions.typeFocused, keyboard: typed } },
    ...(ios ? { traits: base.traits.filter((t) => t !== "valued") } : {}),
  }
  // Sound: the same contract with one action's keyboard implementation replaced.
  return contract as unknown as typeof dateFieldContract
}
