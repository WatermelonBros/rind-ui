import type {
  ChangeDetails,
  CropData,
  Flip,
  HandlePosition,
  ImageCropperEvent,
  ImageCropperMessages,
  MessageOverrides,
  Rect,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLImgAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "image-cropper": ImageCropperMessages
  }
}

/** What every part's children receive. */
export interface ImageCropperRenderState {
  /** The crop in natural pixels. */
  readonly data: CropData | null
  readonly zoom: number
  readonly rotation: number
  readonly flip: Flip
  readonly dragging: boolean
}

/** The change details every value callback receives: the crop in natural pixels too. */
export interface ImageCropperChangeDetails extends ChangeDetails<ImageCropperEvent> {
  readonly data: CropData | null
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ImageCropperRenderState>]> | undefined
  readonly children?: Snippet<[ImageCropperRenderState]> | undefined
}

export type ImageCropperRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Controlled crop (`bind:crop`), viewport px. */
  crop?: Rect | undefined
  readonly defaultCrop?: Rect | undefined
  /** `details.data`: the crop in natural pixels (`rect`, `corners`). */
  readonly onCropChange?: ((crop: Rect, details: ImageCropperChangeDetails) => void) | undefined
  /** `bind:zoom`. */
  zoom?: number | undefined
  readonly defaultZoom?: number | undefined
  readonly onZoomChange?: ((zoom: number, details: ImageCropperChangeDetails) => void) | undefined
  /** Degrees, any angle (`bind:rotation`). */
  rotation?: number | undefined
  readonly defaultRotation?: number | undefined
  readonly onRotationChange?:
    | ((rotation: number, details: ImageCropperChangeDetails) => void)
    | undefined
  /** `bind:flip`. */
  flip?: Flip | undefined
  readonly defaultFlip?: Flip | undefined
  readonly onFlipChange?: ((flip: Flip, details: ImageCropperChangeDetails) => void) | undefined
  /** Smallest zoom (default 1). */
  readonly minZoom?: number | undefined
  /** Largest zoom (default 5). */
  readonly maxZoom?: number | undefined
  /** Per wheel notch and per + / − (default 0.1). */
  readonly zoomStep?: number | undefined
  /** Pinch responsiveness (default 2). */
  readonly zoomSensitivity?: number | undefined
  /** Width / height; free when omitted. */
  readonly aspectRatio?: number | undefined
  /** A circle implies aspect 1. */
  readonly cropShape?: "rectangle" | "circle" | undefined
  /** Viewport px (default 40). */
  readonly minWidth?: number | undefined
  /** Viewport px (default 40). */
  readonly minHeight?: number | undefined
  /** Viewport px (default Infinity). */
  readonly maxWidth?: number | undefined
  /** Viewport px (default Infinity). */
  readonly maxHeight?: number | undefined
  /** The crop stays; drags and arrows pan the image. */
  readonly fixedCropArea?: boolean | undefined
  /** Arrow step, px (default 1). */
  readonly nudgeStep?: number | undefined
  /** Shift+arrow step, px (default 10). */
  readonly nudgeStepShift?: number | undefined
  /** Ctrl/Cmd+arrow step, px (default 50). */
  readonly nudgeStepCtrl?: number | undefined
  readonly messages?: MessageOverrides<ImageCropperMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type ImageCropperPartProps = Part<HTMLAttributes<HTMLDivElement>>
export type ImageCropperImageProps = Omit<HTMLImgAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<ImageCropperRenderState>]> | undefined
}
export type ImageCropperHandleProps = ImageCropperPartProps & {
  /** The edge or corner it resizes: n, s, e, w, ne, nw, se or sw. */
  readonly position: HandlePosition
}
export type ImageCropperGridProps = ImageCropperPartProps & {
  /** Which thirds lines it draws. */
  readonly axis: "horizontal" | "vertical"
}
