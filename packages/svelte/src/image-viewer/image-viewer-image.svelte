<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { createAttachmentKey } from "svelte/attachments"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { imageViewer } from "./context"
import type { ImageViewerImageProps } from "./types"

const { alt, child, ...rest }: ImageViewerImageProps = $props()
const ctx = imageViewer.get()
// The alt names the viewport (the image itself is hidden: one name, on the focusable group).
$effect.pre(() => {
  const a = alt ?? ""
  untrack(() => ctx.setLabel(a))
})
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
