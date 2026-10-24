<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tourApi, tourHost } from "./context.svelte"
import type { TourArrowProps } from "./types"

const { child, children, ...rest }: TourArrowProps = $props()
const ctx = tourHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(tourApi(ctx).api.arrow()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
