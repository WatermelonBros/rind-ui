<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { colorWheelContext } from "./context"
import type { ColorWheelLabelProps } from "./types"

/** Names the slider. */
const { id, child, children, ...rest }: ColorWheelLabelProps = $props()
const ctx = colorWheelContext.get()
const own = $derived(id ?? ctx.labelId())
useRegisterPart(ctx.registry, "label", () => own)
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().label()), id: own }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <label {...attrs(merged)}>{@render children?.(ctx.state())}</label>
{/if}
