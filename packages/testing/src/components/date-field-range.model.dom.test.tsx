// Model-based tests: the range Date Field's pair contract over the coordinator's graph
// (date-field "Range Mode — Pair Invariants"), every modality the actions declare.
import { parseDate } from "@internationalized/date"
import { dateFieldMessages, dateRangeArgs, dateRangeFieldContract, platforms } from "@rind-ui/core"
import { DateField, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, dateRangeStepInvariants, domEnv, fixedDateClock, testMachine } from "../index"

const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")

let changes = 0
const steps = dateRangeStepInvariants({ changes: () => changes })

type Iso = { readonly start: string; readonly end: string }
function Stay({
  children,
  initial,
}: {
  readonly children?: React.ReactNode
  readonly initial?: Iso | undefined
}) {
  return (
    // The run's platform: the driver's select-all key is the page's (⌘A on Apple, else Ctrl+A).
    <RindProvider
      environment={{ dateClock: clock, platform: currentRun()?.platform ?? platforms.linux }}
    >
      {children}
      <DateField.Root
        selectionMode="range"
        locale="en-US"
        startName="from"
        endName="to"
        onValueChange={() => changes++}
        {...(initial
          ? { defaultValue: { start: parseDate(initial.start), end: parseDate(initial.end) } }
          : {})}
      >
        <DateField.Label>Stay</DateField.Label>
        <DateField.Input />
      </DateField.Root>
    </RindProvider>
  )
}

// With a default value each one-step path edits one end with the other shown.
for (const [name, args] of [
  ["in order", { start: "2026-10-14", end: "2026-10-16" }],
  [
    "in order, from a range",
    { start: "2026-10-14", end: "2026-10-16", initial: { start: "2026-10-10", end: "2026-10-20" } },
  ],
  [
    "inverted, from a range",
    { start: "2026-10-22", end: "2026-10-14", initial: { start: "2026-10-16", end: "2026-10-20" } },
  ],
] as const) {
  describe(`date range model: ${name}`, () => {
    testMachine(dateRangeFieldContract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => {
        dateRangeArgs.current = args
        changes = 0
        const view = render(<Stay initial={"initial" in args ? args.initial : undefined} />)
        steps.reset()
        return view
      },
      invariants: steps.invariants,
      target: () => screen,
      anchor: [{ name: "Stay" }],
      props: {
        value: undefined,
        defaultValue: undefined,
        onValueChange: undefined,
        isDateUnavailable: undefined,
        allowsNonContiguousRanges: undefined,
        allowsOvernight: undefined,
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
