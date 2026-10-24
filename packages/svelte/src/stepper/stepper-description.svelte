<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stepperContext, stepperItem } from "./context.svelte"
import type { StepperSpanProps } from "./types"

const { child, children, ...rest }: StepperSpanProps = $props()
const ctx = stepperContext.get()
const item = stepperItem.get()
$effect(() => {
  untrack(() => item.setDescribed(true))
  return () => untrack(() => item.setDescribed(false))
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().description(item.index())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
