<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { sliderContext } from "./context"
import type { SliderMarkerProps } from "./types"

/** A tick at `value`: `data-state` under-value, at-value or over-value. */
const { value, child, children, ...rest }: SliderMarkerProps = $props()
const ctx = sliderContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().marker(value)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
