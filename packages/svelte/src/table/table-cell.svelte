<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tableHost } from "./context.svelte"
import type { TableCellProps } from "./types"

const { child, children, ...rest }: TableCellProps = $props()
const ctx = tableHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().cell()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <td {...attrs(merged)}>{@render children?.(ctx.state())}</td>
{/if}
