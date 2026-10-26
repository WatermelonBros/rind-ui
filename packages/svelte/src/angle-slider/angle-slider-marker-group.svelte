<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { angleSliderContext } from "./context"
import type { AngleSliderPartProps } from "./types"

/** Holds the markers. */
const { child, children, ...rest }: AngleSliderPartProps = $props()
const ctx = angleSliderContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().markerGroup()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
