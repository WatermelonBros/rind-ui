/** @jsxImportSource solid-js */
import { CalendarDate } from "@internationalized/date"
import type { CalendarValue } from "@rind-ui/core"
import { Calendar } from "@rind-ui/solid"
import { createSignal } from "solid-js"

export function Single() {
  const [value, setValue] = createSignal<CalendarValue>(null)
  return (
    <div class="stack">
      {/* A fixed month: the example's markup never depends on today. */}
      <Calendar.Root
        aria-label="Departure"
        visibleMonths={1}
        value={value()}
        onValueChange={(v) => setValue(v)}
        defaultFocusedValue={new CalendarDate(2026, 10, 14)}
      >
        <Calendar.Header>
          <Calendar.PrevTrigger />
          <Calendar.Heading />
          <Calendar.NextTrigger />
        </Calendar.Header>
        <Calendar.Grid month={0} />
      </Calendar.Root>
      <span class="note">selected: {value() ? String(value()) : "none"}</span>
    </div>
  )
}
