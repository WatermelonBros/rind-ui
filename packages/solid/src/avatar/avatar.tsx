/** @jsxImportSource solid-js */
import {
  type AvatarMessages,
  type AvatarProps,
  type AvatarStatus,
  avatarConnect,
  avatarGroupOverflowProps,
  avatarGroupProps,
  avatarMessages,
  checkAvatarGroupName,
  checkAvatarName,
  checkImageAlt,
  checkImageCount,
  isAvatarHidden,
  isAvatarNamed,
  visuallyHiddenStyle,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  type JSX,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { type ImageHost, useImageStatusRoot, useStatusImage } from "../image-status"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    avatar: AvatarMessages
  }
}

export interface AvatarState {
  readonly status: AvatarStatus
}

interface AvatarContextValue {
  readonly api: Accessor<ReturnType<typeof avatarConnect>>
  readonly host: ImageHost
  readonly state: AvatarState
  readonly fallback: Accessor<boolean>
  readonly name: Accessor<string | undefined>
}
const AvatarContext = createContext<AvatarContextValue>()

function useAvatar(part: string) {
  const ctx = useContext(AvatarContext)
  if (!ctx) throw new Error(`Avatar.${part} must be inside Avatar.Root`)
  return ctx
}

export type AvatarRootProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
  readonly fallbackDelay?: number | undefined
  /** Every status change (observed, not controlled). */
  readonly onStatusChange?: AvatarProps["onStatusChange"] | undefined
  readonly render?: RenderProp<AvatarState> | undefined
  readonly children?: JSX.Element
}

function Root(props: AvatarRootProps) {
  const [local, rest] = splitProps(props, [
    "fallbackDelay",
    "onStatusChange",
    "render",
    "id",
    "children",
  ])
  const instance = useRootId(() => local.id)
  // The element's own props, read by name.
  const own = rest as Readonly<Record<string, unknown>>
  const { status, fallback, host } = useImageStatusRoot(
    () => ({ fallbackDelay: local.fallbackDelay, onStatusChange: local.onStatusChange }),
    () => checkAvatarName(own, instance()),
  )
  const api = createMemo(() =>
    avatarConnect({
      instance: instance(),
      status: status(),
      named: isAvatarNamed(own),
      hidden: isAvatarHidden(own),
    }),
  )
  const state = reactive<AvatarState>(() => ({ status: status() }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  const name = () => {
    const label = rest["aria-label"]
    return typeof label === "string" ? label : undefined
  }
  const children = () => local.children
  return (
    <AvatarContext.Provider value={{ api, host, state, fallback, name }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <span {...p}>{children()}</span>
      ))}
    </AvatarContext.Provider>
  )
}

export type AvatarImageProps = JSX.ImgHTMLAttributes<HTMLImageElement> & {
  /** Renders another element with the part's props (spread them on it). */
  readonly render?: RenderProp<AvatarState> | undefined
}

function Image(props: AvatarImageProps) {
  const [local, attrs] = splitProps(props, ["render"])
  const ctx = useAvatar("Image")
  const merged = useStatusImage(
    ctx.host,
    (hasSource) => normalizeProps(ctx.api().image(hasSource)),
    attrs,
    checkImageCount,
  )
  afterMount(() => createEffect(() => checkImageAlt(attrs.alt, ctx.name())))
  return renderPart(
    local.render,
    merged,
    ctx.state,
    () => undefined,
    // biome-ignore lint/a11y/useAltText: the consumer's `alt` is in the part's props
    (p) => <img {...p} />,
  )
}

export type AvatarFallbackProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly render?: RenderProp<AvatarState> | undefined
  readonly children?: JSX.Element
}

function Fallback(props: AvatarFallbackProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAvatar("Fallback")
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

export type AvatarGroupProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

function Group(props: AvatarGroupProps) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const instance = useRootId(() => local.id)
  // A development check, once.
  afterMount(() => checkAvatarGroupName(rest as Readonly<Record<string, unknown>>))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(avatarGroupProps(instance())),
        ...(local.id === undefined ? {} : { id: local.id }),
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type AvatarGroupOverflowProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** How many avatars are not shown. */
  readonly count: number
  readonly messages?: Partial<AvatarMessages> | undefined
  readonly render?: RenderProp<{ readonly count: number }> | undefined
}

function GroupOverflow(props: AvatarGroupOverflowProps) {
  const [local, rest] = splitProps(props, ["count", "messages", "render", "id"])
  const instance = useRootId(() => local.id)
  const messages = useMessages("avatar", avatarMessages, () => local.messages)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(avatarGroupOverflowProps(instance())),
        ...(local.id === undefined ? {} : { id: local.id }),
      },
      rest,
    ),
  )
  const state = reactive(() => ({ count: local.count }))
  // The VisuallyHidden part's markup.
  const hidden = normalizeProps({ "data-visually-hidden": "", style: visuallyHiddenStyle })
  const children = () => (
    <>
      <span aria-hidden="true">+{local.count}</span>
      <span {...hidden}>{messages().overflowLabel(local.count)}</span>
    </>
  )
  return renderPart(local.render, merged, state, children, (p) => <span {...p}>{children()}</span>)
}

/** A person or entity as an image with a fallback; one accessible name in every status. */
/** The parts, by name: `avatar.parts.ts` re-exports them as the `Avatar` namespace. */
export { Fallback, Group, GroupOverflow, Image, Root }
