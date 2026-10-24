<script lang="ts">
import type { Scheduler } from "@rind-ui/core"
import { ImageCropper, type ImageCropperRootProps, RindProvider } from "../../src/index"

// The model's cropper (a virtual clock) or the parity cropper (handles and grids).
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
const rootProps = $derived(root as ImageCropperRootProps)
const POSITIONS = ["n", "e", "s", "w"] as const
</script>

{#snippet cropper()}<ImageCropper.Root aria-label="Avatar" {...rootProps}
    >{#if parity}<ImageCropper.Viewport
        ><ImageCropper.Image {src} alt="" /><ImageCropper.Selection
          >{#each POSITIONS as position (position)}<ImageCropper.Handle {position} />{/each}<ImageCropper.Grid
            axis="horizontal"
          /><ImageCropper.Grid axis="vertical" /></ImageCropper.Selection
        ></ImageCropper.Viewport
      >{:else}<ImageCropper.Viewport style="width: 400px; height: 300px"
        ><ImageCropper.Image {src} /><ImageCropper.Selection /></ImageCropper.Viewport
      >{/if}</ImageCropper.Root
  >{/snippet}

{#if scheduler}<RindProvider environment={{ scheduler }}>{@render cropper()}</RindProvider
  >{:else}{@render cropper()}{/if}
