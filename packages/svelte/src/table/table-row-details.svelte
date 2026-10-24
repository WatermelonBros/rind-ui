<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tableHost, useLeafColumns } from "./context.svelte"
import type { TableRowDetailsProps } from "./types"

const { rowId, colSpan, cellProps, child, children, ...rest }: TableRowDetailsProps = $props()
const ctx = tableHost.get()
const el = elementRef("tr")
const span = useLeafColumns(
  () => el.current,
  () => colSpan,
)
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().rowDetails(rowId)), el.props, rest)),
)
</script>

{#snippet cell()}
  <td colspan={span.current} {...cellProps}>{@render children?.(ctx.state())}</td>
{/snippet}

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <tr {...attrs(merged)}>{@render cell()}</tr>
{/if}
