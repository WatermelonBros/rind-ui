<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stepperContext } from "./context.svelte"
import type { StepperListProps } from "./types"

const { child, children, ...rest }: StepperListProps = $props()
const ctx = stepperContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().list()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <ol {...attrs(merged)}>{@render children?.(ctx.state())}</ol>
{/if}
