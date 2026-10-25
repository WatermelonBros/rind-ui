/** @jsxImportSource solid-js */
// Model-based tests (React's, against the Solid parts): the Date Field contract in range mode.
import { parseDate, parseDateTime, parseTime } from "@internationalized/date"
import { dateFieldMessages, dateRangeArgs, dateRangeFieldContract, platforms } from "@rind-ui/core"
import { currentRun, dateRangeStepInvariants, fixedDateClock, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { pickerParts } from "../../fixtures/date-field-model"
import { mount } from "../../fixtures/mount"
import { DateField, type DateRangeFieldRootProps, RindProvider } from "../index"

const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")

let changes = 0
const steps = dateRangeStepInvariants({ changes: () => changes })

type Iso = { readonly start: string; readonly end: string }
/** A class of the pair: how its ISO texts parse and the props the ends share. */
interface Kind {
  readonly parse: (
    iso: string,
  ) => ReturnType<typeof parseDate | typeof parseDateTime | typeof parseTime>
  readonly props?: {
    readonly granularity?: "minute"
    readonly maxGranularity?: "hour"
    readonly allowsOvernight?: boolean
    readonly locale?: string
  }
  /** Render the picker parts: the popover closed, or open from the start. */
  readonly picker?: "closed" | "open"
}
const DATE: Kind = { parse: parseDate }
const stay =
  (initial: Iso | undefined, kind: Kind = DATE) =>
  (): JSX.Element => (
    // The run's platform: the driver's select-all key is the page's (⌘A on Apple, else Ctrl+A).
    <RindProvider
      environment={{ dateClock: clock, platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
    >
      <DateField.Root
        {...({
          selectionMode: "range",
          locale: "en-US",
          startName: "from",
          endName: "to",
          onValueChange: () => changes++,
          ...kind.props,
          ...(kind.picker === "open" ? { defaultOpen: true } : {}),
          ...(initial
            ? { defaultValue: { start: kind.parse(initial.start), end: kind.parse(initial.end) } }
            : {}),
        } as DateRangeFieldRootProps)}
      >
        <DateField.Label>Stay</DateField.Label>
        {kind.picker ? pickerParts() : <DateField.Input />}
      </DateField.Root>
    </RindProvider>
  )

const DATE_TIME: Kind = { parse: parseDateTime, props: { granularity: "minute" } }
const TIME: Kind = { parse: parseTime, props: { maxGranularity: "hour" } }
const OVERNIGHT: Kind = {
  parse: parseTime,
  props: { maxGranularity: "hour", allowsOvernight: true },
}
const RTL: Kind = { parse: parseDate, props: { locale: "he-IL" } }

type Args = Iso & { readonly initial?: Iso }
const classes: readonly (readonly [string, Args, Kind, ("ltr" | "rtl")?])[] = [
  ["in order", { start: "2026-10-14", end: "2026-10-16" }, DATE],
  // The picker (date-field "Picker — Picker Invariants"): open, the calendar follows each edit.
  [
    "picker closed, in order, from a range",
    { start: "2026-10-14", end: "2026-10-16", initial: { start: "2026-10-10", end: "2026-10-20" } },
    { ...DATE, picker: "closed" },
  ],
  [
    "picker open, in order, from a range",
    { start: "2026-10-14", end: "2026-10-16", initial: { start: "2026-10-10", end: "2026-10-20" } },
    { ...DATE, picker: "open" },
  ],
  [
    "in order, from a range",
    { start: "2026-10-14", end: "2026-10-16", initial: { start: "2026-10-10", end: "2026-10-20" } },
    DATE,
  ],
  // With a default value each one-step path edits one end with the other shown.
  [
    "inverted, from a range",
    { start: "2026-10-22", end: "2026-10-14", initial: { start: "2026-10-16", end: "2026-10-20" } },
    DATE,
  ],
  // Each typed end differs from its initial value in one segment (the day period), so a step
  // is one derived change: the change-count invariant counts per step.
  [
    "date-time, inverted, from a range",
    {
      start: "2026-10-14T21:00",
      end: "2026-10-14T05:30",
      initial: { start: "2026-10-14T09:00", end: "2026-10-14T17:30" },
    },
    DATE_TIME,
  ],
  [
    "time, inverted, from a range",
    { start: "21:00", end: "05:30", initial: { start: "09:00", end: "17:30" } },
    TIME,
  ],
  ["time, in order", { start: "09:15", end: "17:45" }, TIME],
  [
    "overnight time, from a range",
    { start: "21:00", end: "05:30", initial: { start: "09:00", end: "17:30" } },
    OVERNIGHT,
  ],
  [
    "RTL, inverted, from a range",
    { start: "2026-10-22", end: "2026-10-14", initial: { start: "2026-10-16", end: "2026-10-20" } },
    RTL,
    "rtl",
  ],
]

for (const [name, args, kind, dir] of classes) {
  describe(`solid date range model: ${name}`, () => {
    testMachine(dateRangeFieldContract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => {
        dateRangeArgs.current = args
        changes = 0
        const view = mount(stay(args.initial, kind))
        steps.reset()
        return view
      },
      invariants: steps.invariants,
      target: () => screen,
      anchor: [{ name: "Stay" }],
      ...(dir ? { directions: [dir] } : {}),
      props: {
        value: undefined,
        defaultValue: undefined,
        onValueChange: undefined,
        isDateUnavailable: undefined,
        allowsNonContiguousRanges: undefined,
        allowsOvernight: kind.props?.allowsOvernight,
        required: undefined,
        messages: dateFieldMessages,
      } as never,
    } as never)
  })
}
