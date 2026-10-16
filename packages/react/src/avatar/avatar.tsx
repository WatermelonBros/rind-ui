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
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
} from "react"
import { type ImageHost, useImageStatusRoot, useStatusImage } from "../image-status"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { VisuallyHidden } from "../visually-hidden"

declare module "../provider" {
  interface RindMessageScopes {
    avatar: AvatarMessages
  }
}

export interface AvatarState {
  readonly status: AvatarStatus
}

interface AvatarContextValue {
  readonly api: ReturnType<typeof avatarConnect>
  readonly host: ImageHost
  readonly state: AvatarState
  readonly fallback: boolean
  readonly name: string | undefined
}
const AvatarContext = createContext<AvatarContextValue | null>(null)

function useAvatar(part: string) {
  const ctx = useContext(AvatarContext)
  if (!ctx) throw new Error(`Avatar.${part} must be inside Avatar.Root`)
  return ctx
}

export type AvatarRootProps = ComponentPropsWithRef<"span"> & {
  /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
  readonly fallbackDelay?: number | undefined
  /** Every status change (observed, not controlled). */
  readonly onStatusChange?: AvatarProps["onStatusChange"]
  readonly render?: RenderProp<AvatarState>
}

function Root({
  fallbackDelay,
  onStatusChange,
  render,
  id,
  ref,
  children,
  ...rest
}: AvatarRootProps) {
  const instance = useRootId(id)
  const own = rest as Readonly<Record<string, unknown>> // the element's own props, read by name
  const { status, fallback, host } = useImageStatusRoot({ fallbackDelay, onStatusChange }, () =>
    checkAvatarName(own, instance),
  )
  const api = avatarConnect({
    instance,
    status,
    named: isAvatarNamed(own),
    hidden: isAvatarHidden(own),
  })
  const state: AvatarState = { status }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  const label = rest["aria-label"]
  return (
    <AvatarContext
      value={{ api, host, state, fallback, name: typeof label === "string" ? label : undefined }}
    >
      {renderPart("span", { ...props, children }, render, state)}
    </AvatarContext>
  )
}

export type AvatarImageProps = ComponentPropsWithRef<"img"> & {
  /** Typed as `img` props (mui/base-ui#5102): a callback reads `props.src` without casts. */
  readonly render?:
    | ReactElement
    | ((props: ComponentPropsWithRef<"img">, state: AvatarState) => ReactNode)
}

function Image({ render, ...rest }: AvatarImageProps) {
  const ctx = useAvatar("Image")
  const props = useStatusImage(ctx.host, normalizeProps(ctx.api.image()), rest, checkImageCount)
  useEffect(() => checkImageAlt(rest.alt, ctx.name), [rest.alt, ctx.name])
  // The part's props are `img` props (built above from them), so the typed callback is a
  // RenderProp over the same object.
  return renderPart("img", props, render as RenderProp<AvatarState> | undefined, ctx.state)
}

export type AvatarFallbackProps = ComponentPropsWithRef<"span"> & {
  readonly render?: RenderProp<AvatarState>
}

function Fallback({ render, ...rest }: AvatarFallbackProps) {
  const ctx = useAvatar("Fallback")
  if (!ctx.fallback) return null
  return renderPart("span", mergeProps(normalizeProps(ctx.api.fallback()), rest), render, ctx.state)
}

export type AvatarGroupProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<undefined>
}

function Group({ render, id, ...rest }: AvatarGroupProps) {
  const instance = useRootId(id)
  const own = rest as Readonly<Record<string, unknown>> // the element's own props, read by name
  // biome-ignore lint/correctness/useExhaustiveDependencies: a development check, once
  useEffect(() => checkAvatarGroupName(own), [])
  const props = mergeProps(
    { ...normalizeProps(avatarGroupProps(instance)), ...(id === undefined ? {} : { id }) },
    rest,
  )
  return renderPart("div", props, render, undefined)
}

export type AvatarGroupOverflowProps = Omit<ComponentPropsWithRef<"span">, "children"> & {
  /** How many avatars are not shown. */
  readonly count: number
  readonly messages?: Partial<AvatarMessages>
  readonly render?: RenderProp<{ readonly count: number }>
}

function GroupOverflow({
  count,
  messages: ownMessages,
  render,
  id,
  ...rest
}: AvatarGroupOverflowProps) {
  const instance = useRootId(id)
  const messages = useMessages("avatar", avatarMessages, ownMessages)
  const props = mergeProps(
    { ...normalizeProps(avatarGroupOverflowProps(instance)), ...(id === undefined ? {} : { id }) },
    rest,
  )
  const children = (
    <>
      <span aria-hidden="true">+{count}</span>
      <VisuallyHidden>{messages.overflowLabel(count)}</VisuallyHidden>
    </>
  )
  return renderPart("span", { ...props, children }, render, { count })
}

/** A person or entity as an image with a fallback; one accessible name in every status. */
export const Avatar = { Root, Image, Fallback, Group, GroupOverflow }
