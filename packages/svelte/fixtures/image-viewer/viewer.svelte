<script lang="ts">
import type { Scheduler } from "@rind-ui/core"
import { ImageViewer, type ImageViewerRootProps, RindProvider } from "../../src/index"

// The model's viewer (a virtual clock) or the parity viewer (a text button, the zoom text).
const {
  root = {},
  src,
  scheduler,
  parity = false,
}: {
  root?: Record<string, unknown>
  src: string
  scheduler?: Scheduler
  parity?: boolean
} = $props()
const rootProps = $derived(root as ImageViewerRootProps)
</script>

{#snippet viewer()}<ImageViewer.Root {...rootProps}
    ><ImageViewer.Viewport style={parity ? undefined : "width: 400px; height: 200px"}
      ><ImageViewer.Image {src} alt="Floor plan" /></ImageViewer.Viewport
    >{#if parity}<ImageViewer.ZoomOut text="−" /><ImageViewer.ZoomText />{:else}<ImageViewer.ZoomOut
      />{/if}<ImageViewer.ZoomIn /><ImageViewer.Reset /></ImageViewer.Root
  >{/snippet}

{#if scheduler}<RindProvider environment={{ scheduler }}>{@render viewer()}</RindProvider
  >{:else}{@render viewer()}{/if}
