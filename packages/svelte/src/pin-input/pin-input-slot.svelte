<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { useFieldBindingPeek } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { pinInputContext, stateOf, useApi } from "./context.svelte"
import type { PinInputSlotProps } from "./types"

const { index, child, children, ...rest }: PinInputSlotProps = $props()
const ctx = pinInputContext.get()
const apiFor = useApi(ctx, useFieldBindingPeek())
ctx.slots.current += 1
$effect(() => () => {
  ctx.slots.current -= 1
})
const own = $derived(apiFor().slot(index))
const merged = $derived(stripMarker(mergeProps(normalizeProps(own), rest)))
// Connect's content for the slot (its character, or the mask), unless the consumer renders one.
const text = $derived(own["children"] as string | undefined)
const current = $derived({ ...stateOf(ctx), char: ctx.view().values.value[index] })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{#if children}{@render children(current)}{:else}{text}{/if}</div>
{/if}
