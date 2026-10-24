<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { radioGroupContext, radioItemContext } from "./context"
import type { RadioGroupItemIndicatorProps } from "./types"

// Mounted only while checked.
const { child, children, ...rest }: RadioGroupItemIndicatorProps = $props()
const ctx = radioGroupContext.get()
const item = radioItemContext.get()
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(ctx.api().itemIndicator(item.key(), { disabled: item.disabled() })),
      rest,
    ),
  ),
)
const current = $derived({ checked: true, disabled: item.disabled() })
</script>

{#if ctx.value() === item.key()}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <span {...attrs(merged)}>{@render children?.(current)}</span>
  {/if}
{/if}
