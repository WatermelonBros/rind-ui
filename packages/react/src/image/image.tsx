"use client"

import {
  checkImageAltGiven,
  checkImgCount,
  type ImageStatus,
  type ImageStatusProps,
  imageConnect,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react"
import { type ImageHost, useImageStatusRoot, useStatusImage } from "../image-status"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

export interface ImageState {
  readonly status: ImageStatus
}

interface ImageContextValue {
  readonly api: ReturnType<typeof imageConnect>
  readonly host: ImageHost
  readonly state: ImageState
  readonly fallback: boolean
}
const ImageContext = createContext<ImageContextValue | null>(null)

function useImage(part: string) {
  const ctx = useContext(ImageContext)
  if (!ctx) throw new Error(`Image.${part} must be inside Image.Root`)
  return ctx
}

export type ImageRootProps = ComponentPropsWithRef<"span"> & {
  /**
   * Required: the text alternative, or `""` for a decorative image. It names the `<img>`
   * while the image loads and Root when there is no image to show.
   */
  readonly alt: string
  /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
  readonly fallbackDelay?: number | undefined
  /** Every status change (observed, not controlled). */
  readonly onStatusChange?: ImageStatusProps["onStatusChange"]
  readonly render?: RenderProp<ImageState>
}

function Root({
  alt,
  fallbackDelay,
  onStatusChange,
  render,
  id,
  ref,
  children,
  ...rest
}: ImageRootProps) {
  const instance = useRootId(id)
  const { status, fallback, host } = useImageStatusRoot({ fallbackDelay, onStatusChange }, () =>
    checkImageAltGiven(alt, instance),
  )
  // `alt` is a required string in the types; untyped callers can still omit it.
  const api = imageConnect({ instance, status, alt: typeof alt === "string" ? alt : undefined })
  const state: ImageState = { status }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <ImageContext value={{ api, host, state, fallback }}>
      {renderPart("span", { ...props, children }, render, state)}
    </ImageContext>
  )
}

/** `img` props without `alt`: the text alternative is Root's. */
type ImgElementProps = Omit<ComponentPropsWithRef<"img">, "alt">

export type ImageImgProps = ImgElementProps & {
  /** Typed as `img` props: a callback reads `props.src` and `props.alt` without casts. */
  readonly render?:
    | ReactElement
    | ((props: ComponentPropsWithRef<"img">, state: ImageState) => ReactNode)
}

function Img({ render, ...rest }: ImageImgProps) {
  const ctx = useImage("Img")
  const props = useStatusImage(
    ctx.host,
    (has) => normalizeProps(ctx.api.img(has)),
    rest,
    checkImgCount,
  )
  // The part's props are `img` props (built above from them), so the typed callback is a
  // RenderProp over the same object.
  return renderPart("img", props, render as RenderProp<ImageState> | undefined, ctx.state)
}

export type ImageFallbackProps = ComponentPropsWithRef<"span"> & {
  readonly render?: RenderProp<ImageState>
}

function Fallback({ render, ...rest }: ImageFallbackProps) {
  const ctx = useImage("Fallback")
  if (!ctx.fallback) return null
  return renderPart("span", mergeProps(normalizeProps(ctx.api.fallback()), rest), render, ctx.state)
}

/** A content image with fallbacks; one accessible name (`alt`) in every status. */
/** The parts, by name: `image.parts.ts` re-exports them as the `Image` namespace. */
export { Fallback, Img, Root }
