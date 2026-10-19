// Model-based tests: the range Date Field's pair contract over the coordinator's graph
// (date-field "Range Mode — Pair Invariants"), every modality the actions declare. Classes:
// date, date-time, time, overnight time, RTL (date-family-consolidation 3.2).
import { parseDate, parseDateTime, parseTime } from "@internationalized/date"
import { dateFieldMessages, dateRangeArgs, dateRangeFieldContract, platforms } from "@rind-ui/core"
import { Calendar, DateField, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, dateRangeStepInvariants, domEnv, fixedDateClock, testMachine } from "../index"

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
function Stay({
  children,
  initial,
  kind = DATE,
}: {
  readonly children?: React.ReactNode
  readonly initial?: Iso | undefined
  readonly kind?: Kind
}) {
  return (
    // The run's platform: the driver's select-all key is the page's (⌘A on Apple, else Ctrl+A).
    <RindProvider
      environment={{ dateClock: clock, platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
    >
      {children}
      <DateField.Root
        selectionMode="range"
        locale="en-US"
        startName="from"
        endName="to"
        onValueChange={() => changes++}
        {...kind.props}
        {...(kind.picker === "open" ? { defaultOpen: true } : {})}
        {...(initial
          ? { defaultValue: { start: kind.parse(initial.start), end: kind.parse(initial.end) } }
          : {})}
      >
        <DateField.Label>Stay</DateField.Label>
        {kind.picker ? <RangePickerParts /> : <DateField.Input />}
      </DateField.Root>
    </RindProvider>
  )
}

/** The picker parts around the Input: a Control, a trigger and the range Calendar. */
function RangePickerParts() {
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
  describe(`date range model: ${name}`, () => {
    testMachine(dateRangeFieldContract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => {
        dateRangeArgs.current = args
        changes = 0
        const view = render(<Stay initial={args.initial} kind={kind} />)
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

/**
 * A broken coordinator (spec scenario "Broken coordinator pushes the start back"): whenever
 * the end shows a date before the start, the start's segments are rewritten to the end's.
 */
function PushStartBack() {
  useLayoutEffect(() => {
    const read = (edge: string) =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(`[data-part="${edge}"] input[data-editable]`),
      )
    const observer = new MutationObserver(() => {
      const [start, end] = [read("start"), read("end")]
      const iso = (s: HTMLInputElement[]) => s.map((x) => x.getAttribute("aria-valuenow"))
      const [a, b] = [iso(start), iso(end)]
      if (b.some((x) => x === null) || a.some((x) => x === null)) return
      const key = (v: (string | null)[]) =>
        `${v[2]}-${v[0]?.padStart(2, "0")}-${v[1]?.padStart(2, "0")}`
      if (key(b) >= key(a)) return
      observer.disconnect()
      for (const [i, x] of start.entries()) x.setAttribute("aria-valuenow", b[i] ?? "")
      observer.observe(document.body, { subtree: true, attributes: true })
    })
    observer.observe(document.body, { subtree: true, attributes: true })
    return () => observer.disconnect()
  })
  return null
}

describe("date range model: broken coordinator", () => {
  it("fails naming date-range-other-end-untouched", { timeout: 60_000 }, async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(dateRangeFieldContract, {
      test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
      setup: () => {
        const initial = { start: "2026-10-16", end: "2026-10-20" }
        dateRangeArgs.current = { start: "2026-10-16", end: "2026-10-14", initial }
        return render(
          <Stay initial={initial}>
            <PushStartBack />
          </Stay>,
        )
      },
      target: () => domEnv({ timeout: 300 }),
      anchor: [{ name: "Stay" }],
      modalities: ["keyboard"],
      props: { messages: dateFieldMessages } as never,
    } as never)
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.join("\n")).toMatch(/date-range-other-end-untouched/)
  })
})
