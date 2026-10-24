<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { imageCropper } from "./context"
import type { ImageCropperImageProps } from "./types"

const { child, ...rest }: ImageCropperImageProps = $props()
const ctx = imageCropper.get()
// An image already decoded before hydration fires no load event.
const loaded = (img: HTMLImageElement) => {
  if (img.complete && img.naturalWidth > 0) {
    ctx.send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
  }
}
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().image()), {
        onload: (e: Event) => {
          const img = e.currentTarget as HTMLImageElement
          ctx.send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
        },
      }),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <img {...attrs(merged)} {@attach loaded} />
{/if}
