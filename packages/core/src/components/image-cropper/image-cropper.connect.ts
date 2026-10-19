// Image Cropper parts (add-image-cropper design §4): one focusable crop area (a slider with
// the "crop area" roledescription, its value the crop in natural pixels), everything else
// hidden from assistive technology; never a live region. Positions are inline styles from
// the geometry, so the parts work unthemed.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import {
  type CropPlacement,
  covers,
  cropData,
  type HandlePosition,
  imageBox,
  imageTransformCss,
  type Rect,
} from "./geometry"
import type { ImageCropperMessages } from "./image-cropper.messages"

export type ImageCropperPart = "root" | "viewport" | "image" | "selection" | "handle" | "grid"

export interface ImageCropperConnectInput {
  readonly instance: string
  readonly state: "loading" | "idle" | "dragging" | "settling"
  readonly placement: CropPlacement
  readonly crop: Rect
  readonly shape: "rectangle" | "circle"
  readonly fixed: boolean
  readonly dragging: boolean
  readonly panning: boolean
  readonly ready: boolean
  readonly ids: { readonly instructions: string }
  readonly messages: ImageCropperMessages
  readonly locale: string
}

const px = (n: number) => `${n}px`

/**
 * A handle's structural place: centred on its edge or corner of the selection, a 24 px hit
 * area by default (WCAG 2.5.8; `--rind-crop-handle-size`), so it works unthemed.
 */
function handleStyle(position: HandlePosition): Record<string, string> {
  const size = "var(--rind-crop-handle-size, 24px)"
  const x = position.includes("w") ? "0%" : position.includes("e") ? "100%" : "50%"
  const y = position.includes("n") ? "0%" : position.includes("s") ? "100%" : "50%"
  return {
    position: "absolute",
    left: x,
    top: y,
    width: size,
    height: size,
    transform: "translate(-50%, -50%)",
    touchAction: "none",
  }
}

export function imageCropperConnect(input: ImageCropperConnectInput) {
  const { placement: p, crop } = input
  const natural = input.ready ? cropData(p, crop).rect : { x: 0, y: 0, width: 0, height: 0 }
  const shared = {
    "data-state": input.state,
    "data-shape": input.shape,
    "data-dragging": dataFlag(input.dragging),
    "data-panning": dataFlag(input.panning),
  }
  const part = (name: ImageCropperPart): PartProps =>
    scopeAttrs("image-cropper", name, input.instance)
  const box = imageBox(p.natural, p.viewport)
  return {
    /** The crop in natural pixels (rounded). */
    natural,
    valueText: input.messages.valueText(natural, input.locale),
    root: (): PartProps => ({
      ...part("root"),
      ...shared,
      role: "group",
      "data-fixed": dataFlag(input.fixed),
      style: {
        "--rind-crop-x": px(crop.x),
        "--rind-crop-y": px(crop.y),
        "--rind-crop-width": px(crop.width),
        "--rind-crop-height": px(crop.height),
        "--rind-image-zoom": String(p.zoom),
        "--rind-image-rotation": `${p.rotation}deg`,
        "--rind-image-offset-x": px(p.offset.x),
        "--rind-image-offset-y": px(p.offset.y),
      },
    }),
    viewport: (): PartProps => ({
      ...part("viewport"),
      ...shared,
      style: { position: "relative", overflow: "hidden", touchAction: "none", userSelect: "none" },
    }),
    image: (): PartProps => ({
      ...part("image"),
      alt: "",
      "aria-hidden": "true",
      draggable: "false",
      "data-ready": dataFlag(input.ready),
      "data-flip-horizontal": dataFlag(p.flip.horizontal),
      "data-flip-vertical": dataFlag(p.flip.vertical),
      style: {
        position: "absolute",
        left: px(box.x),
        top: px(box.y),
        width: px(box.width),
        height: px(box.height),
        maxWidth: "none",
        transformOrigin: "center",
        transform: imageTransformCss(p),
        pointerEvents: "none",
      },
    }),
    selection: (focus: { readonly focused: boolean; readonly modality: Modality }): PartProps => ({
      ...part("selection"),
      ...shared,
      ...focusAttrs(focus.focused, focus.modality),
      role: "slider",
      tabindex: 0,
      "aria-label": input.messages.label,
      "aria-roledescription": input.messages.roleDescription,
      "aria-valuemin": 0,
      "aria-valuemax": Math.max(0, Math.round(p.natural.width - natural.width)),
      "aria-valuenow": Math.round(natural.x),
      "aria-valuetext": input.messages.valueText(natural, input.locale),
      "aria-describedby": input.ids.instructions,
      "data-x": String(Math.round(natural.x)),
      "data-y": String(Math.round(natural.y)),
      "data-width": String(Math.round(natural.width)),
      "data-height": String(Math.round(natural.height)),
      // The image covers the crop (always, by construction; the contract checks it).
      "data-covered": dataFlag(input.ready && covers(p, crop)),
      style: {
        position: "absolute",
        left: px(crop.x),
        top: px(crop.y),
        width: px(crop.width),
        height: px(crop.height),
        boxSizing: "border-box",
        touchAction: "none",
      },
    }),
    instructions: (): PartProps => ({ id: input.ids.instructions, style: visuallyHiddenStyle }),
    instructionsText: input.messages.instructions,
    handle: (position: HandlePosition): PartProps => ({
      ...part("handle"),
      "aria-hidden": "true",
      "data-position": position,
      "data-disabled": dataFlag(input.fixed),
      style: handleStyle(position),
    }),
    grid: (axis: "horizontal" | "vertical"): PartProps => ({
      ...part("grid"),
      "aria-hidden": "true",
      "data-axis": axis,
    }),
  }
}
