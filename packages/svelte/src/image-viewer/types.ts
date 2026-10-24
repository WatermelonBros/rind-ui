import type {
  ChangeDetails,
  ImageViewerEvent,
  ImageViewerMessages,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLImgAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "image-viewer": ImageViewerMessages
  }
}

/** What every part's children receive. */
export interface ImageViewerRenderState {
  readonly zoom: number
  readonly zoomed: boolean
  readonly panning: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ImageViewerRenderState>]> | undefined
  readonly children?: Snippet<[ImageViewerRenderState]> | undefined
}

export type ImageViewerRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Controlled zoom (`bind:zoom`; 1 = the image fitted). */
  zoom?: number | undefined
  readonly defaultZoom?: number | undefined
  readonly onZoomChange?:
    | ((zoom: number, details: ChangeDetails<ImageViewerEvent>) => void)
    | undefined
  readonly minZoom?: number | undefined
  readonly maxZoom?: number | undefined
  /** + / − and the buttons (default 0.5). */
  readonly step?: number | undefined
  /** A double click toggles fit and this (default 2). */
  readonly doubleClickZoom?: number | undefined
  /** A plain wheel scrolls the page (default) or zooms; ctrl-wheel and pinch always zoom. */
  readonly wheel?: "page" | "zoom" | undefined
  readonly messages?: MessageOverrides<ImageViewerMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type ImageViewerViewportProps = Part<HTMLAttributes<HTMLDivElement>>
export type ImageViewerImageProps = Omit<HTMLImgAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<ImageViewerRenderState>]> | undefined
}
export type ImageViewerControlProps = Omit<HTMLButtonAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<ImageViewerRenderState>]> | undefined
  readonly children?: Snippet<[ImageViewerRenderState]> | undefined
  /** Visible text naming the button (it replaces the messages' name, label-in-name). */
  readonly text?: string | undefined
}
export type ImageViewerZoomTextProps = Part<HTMLAttributes<HTMLSpanElement>>
