<script lang="ts">
import { CalendarDate } from "@internationalized/date"
import { DateField } from "@rind-ui/svelte"

// A fixed date: the example's output never depends on today.
const fixed = new CalendarDate(2026, 10, 14)
</script>

<DateField.Root name="birthday" defaultValue={fixed}>
  <DateField.Label>Birthday</DateField.Label>
  <DateField.Input />
</DateField.Root>
