<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { sortableHost } from "./context"
import type { SortableIndicatorProps } from "./types"

const { child, children, ...rest }: SortableIndicatorProps = $props()
const ctx = sortableHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().indicator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <li {...attrs(merged)}>{@render children?.(ctx.state())}</li>
{/if}
