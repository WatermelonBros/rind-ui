<script lang="ts">
import { zoomGestures } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { imageViewer } from "./context"
import type { ImageViewerViewportProps } from "./types"

const { child, children, ...rest }: ImageViewerViewportProps = $props()
const ctx = imageViewer.get()
const env = useEnvironment()
const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const gestures = (viewport: HTMLElement) =>
  untrack(() =>
    zoomGestures(viewport, {
      onSize: (s) => ctx.send({ type: "VIEWPORT.MEASURED", ...s }),
      onDragStart: (x, y) => ctx.send({ type: "DRAG.START", x, y }),
      onDragMove: (x, y) => ctx.send({ type: "DRAG.MOVE", x, y }),
      onDragEnd: () => ctx.send({ type: "DRAG.END" }),
      onZoomBy: (factor, at) => ctx.send({ type: "ZOOM.BY", factor, at }),
      onPinchStart: (distance) => ctx.send({ type: "PINCH.START", distance }),
      onPinchMove: (distance, center) => ctx.send({ type: "PINCH.MOVE", distance, center }),
      onPinchEnd: () => ctx.send({ type: "PINCH.END" }),
      onToggle: (at) => ctx.send({ type: "TOGGLE", at }),
      wheelZooms: ctx.wheelZooms,
    }),
  )
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().viewport({ focused, modality: modality.current })), {
        onfocus: (e: FocusEvent) => {
          if (e.target === e.currentTarget) focused = true
        },
        onblur: (e: FocusEvent) => {
          if (e.target === e.currentTarget) focused = false
        },
        onkeydown: (e: KeyboardEvent) => {
          if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return
          if (e.key === "+" || e.key === "=") {
            e.preventDefault()
            ctx.send({ type: "ZOOM.STEP", direction: 1, source: "key" })
          } else if (e.key === "-" || e.key === "_") {
            e.preventDefault()
            ctx.send({ type: "ZOOM.STEP", direction: -1, source: "key" })
          } else if (e.key === "0") {
            e.preventDefault()
            ctx.send({ type: "RESET", source: "key" })
          } else {
            const arrow = ARROWS[e.key]
            if (!arrow) return
            const [ax, ay] = arrow
            const room = ctx.room()
            // Nothing to pan on this axis: the page scrolls.
            if ((ax !== 0 ? room.width : room.height) <= 0) return
            e.preventDefault()
            const share = e.shiftKey ? 0.5 : 0.1
            const vp = ctx.viewport()
            ctx.send({ type: "PAN.KEY", dx: ax * vp.width * share, dy: ay * vp.height * share })
          }
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
  <div {...attrs(merged)} {@attach gestures}>{@render children?.(ctx.state())}</div>
{/if}
