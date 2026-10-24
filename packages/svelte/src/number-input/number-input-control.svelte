<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { useFieldBindingPeek } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stateOf, useApi } from "./api.svelte"
import { numberInputContext } from "./context"
import type { NumberInputControlProps } from "./types"

const { child, children, ...rest }: NumberInputControlProps = $props()
const ctx = numberInputContext.get()
const apiFor = useApi(ctx, useFieldBindingPeek())
const merged = $derived(stripMarker(mergeProps(normalizeProps(apiFor().control()), rest)))
const current = $derived(stateOf(ctx))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
