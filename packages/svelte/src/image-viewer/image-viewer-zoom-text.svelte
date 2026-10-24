<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { imageViewer } from "./context"
import type { ImageViewerZoomTextProps } from "./types"

const { child, children, ...rest }: ImageViewerZoomTextProps = $props()
const ctx = imageViewer.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().zoomTextPart()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}
    >{#if children}{@render children(ctx.state())}{:else}{ctx.api().zoomText}{/if}</span
  >
{/if}
