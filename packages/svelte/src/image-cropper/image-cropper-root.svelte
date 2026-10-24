<script lang="ts">
// Image Cropper parts: wiring only. The machine owns the crop, zoom, rotation and flip, connect
// every attribute; core's crop gestures read the pointer, wheel and pinch on the viewport.
import {
  announcerCapability,
  type ChangeDetails,
  type CropData,
  cropData,
  cropPlacementOf,
  type Flip,
  type ImageCropperEvent,
  imageCropperConnect,
  imageCropperMachine,
  imageCropperMessages,
  partId,
  type Rect,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { imageCropper } from "./context"
import type { ImageCropperRootProps } from "./types"

let {
  crop = $bindable(),
  defaultCrop,
  onCropChange,
  zoom = $bindable(),
  defaultZoom,
  onZoomChange,
  rotation = $bindable(),
  defaultRotation,
  onRotationChange,
  flip = $bindable(),
  defaultFlip,
  onFlipChange,
  minZoom,
  maxZoom,
  zoomStep,
  zoomSensitivity,
  aspectRatio,
  cropShape = "rectangle",
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  fixedCropArea = false,
  nudgeStep = 1,
  nudgeStepShift = 10,
  nudgeStepCtrl = 50,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: ImageCropperRootProps = $props()
const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const loc = useLocale(() => ownLocale)
const messages = useMessages("image-cropper", imageCropperMessages, () => ownMessages)
// The machine reports the natural-pixel crop of the placement it is about to write, so the
// value callbacks always get the current data (never the previous render's).
let latestData: CropData | null = null
const machineEnv = {
  ...env,
  onData: (data: CropData) => {
    latestData = data
  },
}
const details = (d: ChangeDetails<ImageCropperEvent>) => ({ ...d, data: latestData })
const machineProps = () => ({
  id: instance,
  crop,
  defaultCrop,
  onCropChange: (v: Rect, d: ChangeDetails<ImageCropperEvent>) => {
    onCropChange?.(v, details(d))
    if (crop !== undefined) crop = v
  },
  zoom,
  defaultZoom,
  onZoomChange: (v: number, d: ChangeDetails<ImageCropperEvent>) => {
    onZoomChange?.(v, details(d))
    if (zoom !== undefined) zoom = v
  },
  rotation,
  defaultRotation,
  onRotationChange: (v: number, d: ChangeDetails<ImageCropperEvent>) => {
    onRotationChange?.(v, details(d))
    if (rotation !== undefined) rotation = v
  },
  flip,
  defaultFlip,
  onFlipChange: (v: Flip, d: ChangeDetails<ImageCropperEvent>) => {
    onFlipChange?.(v, details(d))
    if (flip !== undefined) flip = v
  },
  minZoom,
  maxZoom,
  zoomStep,
  zoomSensitivity,
  aspectRatio,
  cropShape,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  fixedCropArea,
  messages: messages(),
  lang: loc.current.locale,
})
const machine = useMachine(imageCropperMachine, machineProps, machineEnv)
const view = $derived(machine.view)
const placement = $derived(cropPlacementOf(view.values, view.context))
const ready = $derived(view.state !== "loading")
const api = $derived(
  imageCropperConnect({
    instance,
    state: view.state as "loading" | "idle" | "dragging" | "settling",
    placement,
    crop: view.values.crop,
    shape: cropShape,
    fixed: fixedCropArea,
    dragging: view.state === "dragging" && view.context.drag?.target !== "image",
    panning: view.state === "dragging" && view.context.drag?.target === "image",
    ready,
    ids: { instructions: partId("image-cropper", instance, "instructions") },
    messages: messages(),
    locale: loc.current.locale,
  }),
)
const cropperState = $derived({
  data: ready ? cropData(placement, view.values.crop) : null,
  zoom: view.values.zoom,
  rotation: view.values.rotation,
  flip: view.values.flip,
  dragging: view.state === "dragging",
})
imageCropper.set({
  api: () => api,
  state: () => cropperState,
  send: machine.send,
  steps: () => ({ base: nudgeStep, shift: nudgeStepShift, ctrl: nudgeStepCtrl }),
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#snippet content()}{@render children?.(cropperState)}<span {...attrs(normalizeProps(api.instructions()))}
    >{api.instructionsText}</span
  >{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: cropperState })}
{:else}
  <div {...attrs(merged)}>{@render content()}</div>
{/if}
