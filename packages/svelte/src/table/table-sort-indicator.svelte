<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useIcon } from "../provider"
import { tableHost, useSortColumn } from "./context.svelte"
import type { TableSortIndicatorProps } from "./types"

const { ascending, descending, none, child, children, ...rest }: TableSortIndicatorProps = $props()
const ctx = tableHost.get()
const column = useSortColumn("SortIndicator")
const icons = {
  ascending: useIcon("caret-up"),
  descending: useIcon("caret-down"),
  none: useIcon("caret-up-down"),
}
const direction = $derived.by(() => {
  const sort = ctx.state().sort
  return sort && sort.column === column.id() ? sort.direction : "none"
})
const own = $derived(
  direction === "ascending"
    ? (ascending ?? children)
    : direction === "descending"
      ? (descending ?? children)
      : (none ?? children),
)
// Else the provider's icon for the direction; else nothing (the theme draws the shape).
const Icon = $derived(icons[direction]())
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().sortIndicator(column.id())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if own}{@render own(ctx.state())}{:else if Icon}<Icon />{/if}</span>
{/if}
