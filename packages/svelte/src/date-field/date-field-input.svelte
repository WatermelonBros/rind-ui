<script lang="ts">
import { dateField, useDateRange } from "./context"
import SingleInput from "./date-field-single-input.svelte"
import RangeInput from "./date-range-input.svelte"
import type { DateFieldInputProps } from "./types"

// The group: one field's segments, or in range mode both ends with a separator.
const props: DateFieldInputProps = $props()
const single = dateField.maybe() ?? null
const range = useDateRange()
</script>

{#if !single && range}
  <!-- The range group renders no per-field state: children and child do not apply. -->
  {@const { children: _c, child: _ch, ...rest } = props}
  <RangeInput {...rest} />
{:else}
  <SingleInput {...props} />
{/if}
