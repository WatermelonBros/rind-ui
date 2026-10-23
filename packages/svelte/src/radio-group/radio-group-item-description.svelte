<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { radioGroupContext, radioItemContext } from "./context"
import type { RadioGroupItemDescriptionProps } from "./types"

const { child, children, ...rest }: RadioGroupItemDescriptionProps = $props()
const ctx = radioGroupContext.get()
const item = radioItemContext.get()
$effect(() =>
  untrack(() => {
    item.setDescriptionRendered(true)
    return () => item.setDescriptionRendered(false)
  }),
)
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(ctx.api().itemDescription(item.key(), { disabled: item.disabled() })),
      rest,
    ),
  ),
)
const current = $derived({ checked: ctx.value() === item.key(), disabled: item.disabled() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <p {...attrs(merged)}>{@render children?.(current)}</p>
{/if}
