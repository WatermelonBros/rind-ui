<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tableHost, useLeafColumns } from "./context.svelte"
import type { TableEmptyProps } from "./types"

const { colSpan, child, children, ...rest }: TableEmptyProps = $props()
const ctx = tableHost.get()
const el = elementRef("tr")
// Untracked: the count is read and written, and this effect must not depend on it.
$effect.pre(() =>
  untrack(() => {
    ctx.setEmpty(1)
    return () => ctx.setEmpty(-1)
  }),
)
const span = useLeafColumns(
  () => el.current,
  () => colSpan,
)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().empty()), el.props, rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <tr {...attrs(merged)}><td colspan={span.current}>{@render children?.(ctx.state())}</td></tr>
{/if}
