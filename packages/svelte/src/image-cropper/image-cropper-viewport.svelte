<script lang="ts">
import { cropGestures } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { imageCropper } from "./context"
import type { ImageCropperPartProps } from "./types"

const { child, children, ...rest }: ImageCropperPartProps = $props()
const ctx = imageCropper.get()
const gestures = (viewport: HTMLElement) =>
  untrack(() =>
    cropGestures(viewport, {
      onSize: (s) => ctx.send({ type: "VIEWPORT.MEASURED", ...s }),
      onDragStart: (target, x, y) => ctx.send({ type: "DRAG.START", target, x, y }),
      onDragMove: (x, y, lockRatio) => ctx.send({ type: "DRAG.MOVE", x, y, lockRatio }),
      onDragEnd: () => ctx.send({ type: "DRAG.END" }),
      onWheel: (direction, at) => ctx.send({ type: "ZOOM.STEP", direction, at }),
      onPinchStart: (distance) => ctx.send({ type: "PINCH.START", distance }),
      onPinchMove: (distance, center) => ctx.send({ type: "PINCH.MOVE", distance, center }),
      onPinchEnd: () => ctx.send({ type: "PINCH.END" }),
    }),
  )
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().viewport()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach gestures}>{@render children?.(ctx.state())}</div>
{/if}
