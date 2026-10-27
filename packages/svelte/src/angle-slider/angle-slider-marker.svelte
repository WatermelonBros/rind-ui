<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { angleSliderContext } from "./context"
import type { AngleSliderMarkerProps } from "./types"

/** A tick at `value` degrees, placed by `--rind-angle-slider-marker-angle`. */
const { value, child, children, ...rest }: AngleSliderMarkerProps = $props()
const ctx = angleSliderContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().marker(value)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
