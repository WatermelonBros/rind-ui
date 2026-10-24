<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { createAttachmentKey } from "svelte/attachments"
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
// An attachment key in the props, so it lands on a `child`-rendered element too.
const attach = createAttachmentKey()
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().image()), {
        onload: (e: Event) => {
          const img = e.currentTarget as HTMLImageElement
          ctx.send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
        },
      }),
      { [attach]: loaded },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <img {...attrs(merged)} />
{/if}
