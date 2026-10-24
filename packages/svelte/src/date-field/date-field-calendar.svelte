<script lang="ts">
import { useDateRange } from "./context"
import SingleCalendar from "./date-field-single-calendar.svelte"
import RangeCalendar from "./date-range-calendar.svelte"
import type { DatePickerCalendarProps } from "./types"

// The Calendar bound to the picker: its data come from the field, its view props are its own.
const props: DatePickerCalendarProps = $props()
const range = useDateRange()
</script>

{#if range}<RangeCalendar {...props} />{:else}<SingleCalendar {...props} />{/if}
