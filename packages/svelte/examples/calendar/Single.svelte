<script lang="ts">
import { CalendarDate } from "@internationalized/date"
import type { CalendarValue } from "@rind-ui/core"
import { Calendar } from "@rind-ui/svelte"

let value = $state<CalendarValue>(null)
</script>

<div class="stack">
  <!-- A fixed month: the example's markup never depends on today. -->
  <Calendar.Root
    bind:value
    aria-label="Departure"
    visibleMonths={1}
    defaultFocusedValue={new CalendarDate(2026, 10, 14)}
  >
    <Calendar.Header>
      <Calendar.PrevTrigger />
      <Calendar.Heading />
      <Calendar.NextTrigger />
    </Calendar.Header>
    <Calendar.Grid month={0} />
  </Calendar.Root>
  <span class="note">selected: {value ? String(value) : "none"}</span>
</div>
