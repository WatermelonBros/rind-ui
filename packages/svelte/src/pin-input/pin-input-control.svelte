<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { useFieldBindingPeek } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { pinInputContext, stateOf, useApi } from "./context.svelte"
import type { PinInputControlProps } from "./types"

const { child, children, ...rest }: PinInputControlProps = $props()
const ctx = pinInputContext.get()
const apiFor = useApi(ctx, useFieldBindingPeek())
const merged = $derived(stripMarker(mergeProps(normalizeProps(apiFor().control()), rest)))
const current = $derived(stateOf(ctx))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
