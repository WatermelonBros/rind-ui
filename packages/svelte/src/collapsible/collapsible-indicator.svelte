<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { collapsibleContext, stateOf, useApi } from "./service.svelte"
import type { CollapsibleIndicatorProps } from "./types"

const { child, children, ...rest }: CollapsibleIndicatorProps = $props()
const ctx = collapsibleContext.get()
const apiFor = useApi(ctx)
const merged = $derived(
  stripMarker(
    mergeProps(normalizeProps({ ...apiFor().indicator(), ...ctx.decoration.indicator?.() }), rest),
  ),
)
const current = $derived(stateOf(ctx))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <span {...attrs(merged)}>{@render children?.(current)}</span>
{/if}
