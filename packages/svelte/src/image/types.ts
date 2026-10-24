import type { ImageStatus, ImageStatusProps } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLImgAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface ImageState {
  readonly status: ImageStatus
}

export type ImageRootProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /**
   * Required: the text alternative, or `""` for a decorative image. It names the `<img>`
   * while the image loads and Root when there is no image to show.
   */
  readonly alt: string
  /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
  readonly fallbackDelay?: number | undefined
  /** Every status change (observed, not controlled). */
  readonly onStatusChange?: ImageStatusProps["onStatusChange"]
  readonly child?: Snippet<[ChildArgs<ImageState>]> | undefined
  readonly children?: Snippet<[ImageState]> | undefined
}
/** `img` attributes without `alt`: the text alternative is Root's. */
export type ImageImgProps = Omit<HTMLImgAttributes, "alt" | "children"> & {
  readonly child?: Snippet<[ChildArgs<ImageState>]> | undefined
}
export type ImageFallbackProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<ImageState>]> | undefined
  readonly children?: Snippet<[ImageState]> | undefined
}
