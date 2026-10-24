/** @jsxImportSource solid-js */
import {
  checkImageAltGiven,
  checkImgCount,
  type ImageStatus,
  type ImageStatusProps,
  imageConnect,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createMemo,
  type JSX,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { type ImageHost, useImageStatusRoot, useStatusImage } from "../image-status"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"

export interface ImageState {
  readonly status: ImageStatus
}

interface ImageContextValue {
  readonly api: Accessor<ReturnType<typeof imageConnect>>
  readonly host: ImageHost
  readonly state: ImageState
  readonly fallback: Accessor<boolean>
}
const ImageContext = createContext<ImageContextValue>()

function useImage(part: string) {
  const ctx = useContext(ImageContext)
  if (!ctx) throw new Error(`Image.${part} must be inside Image.Root`)
  return ctx
}

export type ImageRootProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /**
   * Required: the text alternative, or `""` for a decorative image. It names the `<img>`
   * while the image loads and Root when there is no image to show.
   */
  readonly alt: string
  /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
  readonly fallbackDelay?: number | undefined
  /** Every status change (observed, not controlled). */
  readonly onStatusChange?: ImageStatusProps["onStatusChange"] | undefined
  readonly render?: RenderProp<ImageState> | undefined
  readonly children?: JSX.Element
}

function Root(props: ImageRootProps) {
  const [local, rest] = splitProps(props, [
    "alt",
    "fallbackDelay",
    "onStatusChange",
    "render",
    "id",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const { status, fallback, host } = useImageStatusRoot(
    () => ({ fallbackDelay: local.fallbackDelay, onStatusChange: local.onStatusChange }),
    () => checkImageAltGiven(local.alt, instance()),
  )
  // `alt` is a required string in the types; untyped callers can still omit it.
  const api = createMemo(() =>
    imageConnect({
      instance: instance(),
      status: status(),
      alt: typeof local.alt === "string" ? local.alt : undefined,
    }),
  )
  const state = reactive<ImageState>(() => ({ status: status() }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  const children = () => local.children
  return (
    <ImageContext.Provider value={{ api, host, state, fallback }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <span {...p}>{children()}</span>
      ))}
    </ImageContext.Provider>
  )
}

export type ImageImgProps = Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  /** Renders another element with the part's props (spread them on it). */
  readonly render?: RenderProp<ImageState> | undefined
}

function Img(props: ImageImgProps) {
  const [local, attrs] = splitProps(props, ["render"])
  const ctx = useImage("Img")
  const merged = useStatusImage(
    ctx.host,
    (has) => normalizeProps(ctx.api().img(has)),
    attrs,
    checkImgCount,
  )
  return renderPart(
    local.render,
    merged,
    ctx.state,
    () => undefined,
    // biome-ignore lint/a11y/useAltText: the part's props carry `alt` (Root's)
    (p) => <img {...p} />,
  )
}

export type ImageFallbackProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly render?: RenderProp<ImageState> | undefined
  readonly children?: JSX.Element
}

function Fallback(props: ImageFallbackProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useImage("Fallback")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().fallback()), rest))
  const children = () => local.children
  return (
    <Show when={ctx.fallback()}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <span {...p}>{children()}</span>
      ))}
    </Show>
  )
}

/** A content image with fallbacks; one accessible name (`alt`) in every status. */
/** The parts, by name: `image.parts.ts` re-exports them as the `Image` namespace. */
export { Fallback, Img, Root }
