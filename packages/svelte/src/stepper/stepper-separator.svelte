<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stepperContext, stepperItem } from "./context.svelte"
import type { StepperDivProps } from "./types"

const { child, children, ...rest }: StepperDivProps = $props()
const ctx = stepperContext.get()
const item = stepperItem.get()
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().separator(item.index())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
