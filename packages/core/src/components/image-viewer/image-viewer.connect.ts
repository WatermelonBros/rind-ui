// Image Viewer parts (add-image-viewer design §4): a focusable group named by the image's
// alt, with instructions as its description; never a live region (the zoom is announced
// once per keyboard burst). Positions are inline styles from the geometry, so the parts work
// unthemed; the page keeps its scroll and pinch while the image is at fit.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { imageBox, imageTransformCss } from "../image-cropper/geometry"
import type { ViewerPlacement } from "./image-viewer.geometry"
import type { ImageViewerMessages } from "./image-viewer.messages"

export type ImageViewerPart =
  | "root"
  | "viewport"
  | "image"
  | "zoom-in"
  | "zoom-out"
  | "reset"
  | "zoom-text"

export interface ImageViewerConnectInput {
  readonly instance: string
  readonly state: "loading" | "idle" | "panning" | "settling"
  readonly placement: ViewerPlacement
  readonly minZoom: number
  readonly maxZoom: number
  readonly label: string
  readonly ids: { readonly instructions: string }
  readonly messages: ImageViewerMessages
  readonly locale: string
}

const px = (n: number) => `${n}px`

export function imageViewerConnect(input: ImageViewerConnectInput) {
  const p = input.placement
  const zoomed = p.zoom > input.minZoom
  const shared = {
    "data-state": input.state,
    "data-zoomed": dataFlag(zoomed),
    "data-panning": dataFlag(input.state === "panning"),
    "data-zoom": String(Math.round(p.zoom * 100) / 100),
  }
  const part = (name: ImageViewerPart): PartProps =>
    scopeAttrs("image-viewer", name, input.instance)
  const box = imageBox(p.natural, p.viewport)
  const button = (name: ImageViewerPart, label: string, disabled: boolean): PartProps => ({
    ...part(name),
    type: "button",
    "aria-label": label,
    // aria-disabled, not disabled: pressing ZoomIn up to the limit must not drop its focus.
    "aria-disabled": disabled ? "true" : undefined,
    "data-disabled": dataFlag(disabled),
  })
  return {
    zoomText: input.messages.zoomText(p.zoom, input.locale),
    root: (): PartProps => ({
      ...part("root"),
      ...shared,
      style: {
        "--rind-image-zoom": String(p.zoom),
        "--rind-image-offset-x": px(p.offset.x),
        "--rind-image-offset-y": px(p.offset.y),
      },
    }),
    viewport: (focus: { readonly focused: boolean; readonly modality: Modality }): PartProps => ({
      ...part("viewport"),
      ...shared,
      ...focusAttrs(focus.focused, focus.modality),
      role: "group",
      tabindex: 0,
      "aria-roledescription": input.messages.roleDescription,
      "aria-label": input.label,
      "aria-describedby": input.ids.instructions,
      style: {
        position: "relative",
        overflow: "hidden",
        // At fit the page keeps its own scroll and pinch; zoomed, gestures belong to the image.
        touchAction: zoomed ? "none" : "pan-x pan-y pinch-zoom",
        userSelect: "none",
      },
    }),
    image: (): PartProps => ({
      ...part("image"),
      alt: "",
      "aria-hidden": "true",
      draggable: "false",
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
    instructions: (): PartProps => ({ id: input.ids.instructions, style: visuallyHiddenStyle }),
    instructionsText: input.messages.instructions,
    zoomIn: (): PartProps => button("zoom-in", input.messages.zoomIn, p.zoom >= input.maxZoom),
    zoomOut: (): PartProps => button("zoom-out", input.messages.zoomOut, p.zoom <= input.minZoom),
    reset: (): PartProps =>
      button(
        "reset",
        input.messages.reset,
        p.zoom === input.minZoom && p.offset.x === 0 && p.offset.y === 0,
      ),
    zoomTextPart: (): PartProps => ({ ...part("zoom-text"), "aria-hidden": "true" }),
  }
}
