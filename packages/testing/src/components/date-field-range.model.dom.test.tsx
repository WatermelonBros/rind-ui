// Model-based tests: the range Date Field's pair contract over the coordinator's graph
// (date-field "Range Mode — Pair Invariants"), every modality the actions declare.
import { dateFieldMessages, dateRangeArgs, dateRangeFieldContract } from "@rind-ui/core"
import { DateField, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { fixedDateClock, testMachine } from "../index"

const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")

function Stay() {
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <DateField.Root selectionMode="range" locale="en-US" startName="from" endName="to">
        <DateField.Label>Stay</DateField.Label>
        <DateField.Input />
      </DateField.Root>
    </RindProvider>
  )
}

for (const [name, args] of [
  ["in order", { start: "2026-10-14", end: "2026-10-16" }],
  ["inverted", { start: "2026-10-16", end: "2026-10-14" }],
] as const) {
  describe(`date range model: ${name}`, () => {
    testMachine(dateRangeFieldContract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => {
        dateRangeArgs.current = args
        return render(<Stay />)
      },
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
