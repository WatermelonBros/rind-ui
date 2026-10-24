// The Date Field model-test helper (React's date-field-model.tsx, against the Vue parts): the
// oracle props, the story and the settle step.
import { CalendarDate, GregorianCalendar } from "@internationalized/date"
import { type DateFieldProps, dateFieldContract, type FieldValue, platforms } from "@rind-ui/core"
import { currentRun, fixedDateClock } from "@rind-ui/testing"
import { screen, waitFor } from "@testing-library/dom"
import axe from "axe-core"
import { expect } from "vitest"
import { h, nextTick } from "vue"
import { Calendar, DateField, Field, RindProvider } from "../src/index"

export const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")
/** Today on the clock: the placeholder both the page and the oracle step from. */
export const PLACEHOLDER = new CalendarDate(2026, 10, 17)

export const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

/** React's Root props, by name. */
export interface Config {
  readonly defaultValue?: FieldValue | null
  readonly placeholderValue?: FieldValue
  readonly locale?: string
  readonly granularity?: DateFieldProps["granularity"]
  readonly maxGranularity?: "year" | "hour"
  readonly hourCycle?: 12 | 24
  readonly hideTimeZone?: boolean
  readonly shouldForceLeadingZeros?: boolean
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly minValue?: FieldValue
  readonly maxValue?: FieldValue
  readonly isDateUnavailable?: (date: CalendarDate) => boolean
  readonly modal?: boolean
  readonly inField?: boolean
  readonly platform?: (typeof platforms)[keyof typeof platforms]
  /** Render the picker parts (the popover closed, or open from the start). */
  readonly picker?: "closed" | "open"
}

/** The oracle runs the real machine with the props it reads (gregorian display). */
export const oracle = (cfg: Config, onValueChange?: () => void): DateFieldProps => ({
  value: undefined,
  defaultValue: cfg.defaultValue ?? null,
  onValueChange,
  placeholderValue: cfg.placeholderValue ?? PLACEHOLDER,
  locale: cfg.locale ?? "en-US",
  calendar: new GregorianCalendar(),
  granularity: cfg.granularity,
  maxGranularity: cfg.maxGranularity,
  hourCycle: cfg.hourCycle,
  hideTimeZone: cfg.hideTimeZone,
  shouldForceLeadingZeros: cfg.shouldForceLeadingZeros,
  disabled: cfg.disabled,
  readOnly: cfg.readOnly,
  focusSegment: () => {},
  id: "date",
})

/** The picker parts around the Input: a Control, a trigger and the Calendar in a popover. */
export const pickerParts = () => [
  h(DateField.Control, null, () => [
    h(DateField.Input),
    h(DateField.Trigger, null, () => h("span", { "aria-hidden": "true" }, "▾")),
  ]),
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

/** The model's story: the field in a form (Reset button), under the run's platform and direction. */
export const story = (cfg: Config, onValueChange?: () => void) => () => {
  const { inField, platform, picker, readOnly, ...root } = cfg
  const field = h(
    DateField.Root,
    {
      name: "date",
      ...root,
      ...(readOnly === undefined ? {} : { readonly: readOnly }),
      ...(onValueChange ? { onValueChange } : {}),
      ...(picker === "open" ? { defaultOpen: true } : {}),
    } as Record<string, unknown>,
    () => [
      inField ? null : h(DateField.Label, null, () => "Birthday"),
      ...(picker ? pickerParts() : [h(DateField.Input)]),
    ],
  )
  return h(
    RindProvider,
    {
      environment: {
        platform: platform ?? currentRun()?.platform ?? platforms.linux,
        dateClock: clock,
      },
      dir: currentRun()?.direction === "rtl" ? "rtl" : "ltr",
    },
    () =>
      h("form", { onSubmit: (e: Event) => e.preventDefault() }, [
        inField
          ? h(Field.Root, { validationMode: "change" }, () => [
              h(Field.Label, null, () => "Birthday"),
              field,
              h(Field.ErrorMessage),
            ])
          : field,
        h("button", { type: "reset" }, "Reset"),
      ]),
  )
}

/**
 * An open picker settles (first placement, initial focus in the content) before the first
 * step, then focus is dropped: the model starts in idle with nothing focused.
 */
export async function settle(cfg: Config) {
  if (cfg.picker !== "open") return
  const content = await screen.findByRole("dialog")
  await waitFor(() => expect(content.contains(document.activeElement)).toBe(true))
  ;(document.activeElement as HTMLElement | null)?.blur()
  await nextTick()
}

type EnvLike = {
  focused(): { compose(updates: readonly string[], commit?: string): Promise<void> }
}

/**
 * The DOM adapter's `type` clicks a text input first (a pointer step, no ring by design), so
 * typing into the focused segment is a committed composition of the text there.
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
