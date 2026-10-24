<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tableHost } from "./context.svelte"
import type { TableRowHeaderProps } from "./types"

const { rowSpan, child, children, ...rest }: TableRowHeaderProps = $props()
const ctx = tableHost.get()
const merged = $derived(
  stripMarker(
    mergeProps(normalizeProps(ctx.api().rowHeader({ rowSpan })), { rowspan: rowSpan }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <th {...attrs(merged)}>{@render children?.(ctx.state())}</th>
{/if}
