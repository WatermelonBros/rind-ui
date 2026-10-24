<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { imageViewer } from "./context"
import type { ImageViewerControlProps } from "./types"

// A control button: a no-op while aria-disabled (it keeps its focus at the limit). Visible
// `text` is the name (a "+" named "Zoom in" fails label-in-name); the messages' name is for
// an icon or nothing.
const { text, child, children, ...rest }: ImageViewerControlProps = $props()
const ctx = imageViewer.get()
const merged = $derived.by(() => {
  const own = ctx.api().zoomIn()
  return stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(text !== undefined ? { ...own, "aria-label": undefined } : own), {
        onclick: () => {
          if (own["aria-disabled"] !== "true")
            ctx.send({ type: "ZOOM.STEP", direction: 1, source: "button" })
        },
      }),
      rest,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...attrs(merged)}
    >{#if text !== undefined}{text}{:else}{@render children?.(ctx.state())}{/if}</button
  >
{/if}
