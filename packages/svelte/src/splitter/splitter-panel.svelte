<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { splitterContext } from "./context"
import type { SplitterPanelProps } from "./types"

/** Panel `index`: its size is `flex-grow` on a zero basis. */
const { index, child, children, ...rest }: SplitterPanelProps = $props()
const ctx = splitterContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().panel(index)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
