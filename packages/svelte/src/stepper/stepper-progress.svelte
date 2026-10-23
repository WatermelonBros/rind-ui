<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stepperContext } from "./context.svelte"
import type { StepperSpanProps } from "./types"

const { child, children, ...rest }: StepperSpanProps = $props()
const ctx = stepperContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().progress()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().progressText}{/if}</span>
{/if}
