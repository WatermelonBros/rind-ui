<script lang="ts">
import SingleRoot from "./date-field-single-root.svelte"
import DateRangeRoot from "./date-range-root.svelte"
import type { DateFieldRootProps, DateFieldSingleRootProps, DateRangeFieldRootProps } from "./types"

// Single mode (default), or a range of two ends with `selectionMode="range"`.
let { value = $bindable(), open = $bindable(), ...props }: DateFieldRootProps = $props()
</script>

{#if props.selectionMode === "range"}
  <DateRangeRoot {...props as DateRangeFieldRootProps} bind:value={value as never} bind:open />
{:else}
  <SingleRoot {...props as DateFieldSingleRootProps} bind:value={value as never} bind:open />
{/if}
