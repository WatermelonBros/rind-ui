<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tourApi, tourHost } from "./context.svelte"
import type { TourProgressTextProps } from "./types"

const { child, children, ...rest }: TourProgressTextProps = $props()
const ctx = tourHost.get()
const api = $derived(tourApi(ctx).api)
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.progressText()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children()}{:else}{api.progressLabel()}{/if}</span>
{/if}
