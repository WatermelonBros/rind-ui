<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs } from "../normalize-props"
import ToggleIndicator from "../toggle/toggle-indicator.svelte"
import { itemContext } from "./context"
import type { ToggleGroupItemIndicatorProps } from "./types"

// Decorative: its children while the item is pressed, `fallback` otherwise.
const props: ToggleGroupItemIndicatorProps = $props()
const item = itemContext.maybe()
const merged = $derived.by(() => {
  const { child: _c, children: _ch, fallback: _f, ...rest } = props
  return item ? stripMarker(mergeProps(item.indicator(), rest)) : {}
})
const current = $derived(item?.state())
</script>

{#if !item || !current}
  <!-- A lone item is a single toggle: its own indicator. -->
  <ToggleIndicator {...props} />
{:else if props.child}
  {@render props.child({ props: merged, state: current })}
{:else}
  <span {...attrs(merged)}>{@render (current.pressed ? props.children : props.fallback)?.(current)}</span>
{/if}
