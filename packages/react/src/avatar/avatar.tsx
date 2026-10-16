import {
  type AvatarMessages,
  type AvatarProps,
  type AvatarStatus,
  avatarConnect,
  avatarGroupOverflowProps,
  avatarGroupProps,
  avatarMachine,
  avatarMessages,
  checkAvatarGroupName,
  checkAvatarName,
  checkImageAlt,
  checkImageCount,
  fallbackVisible,
  imageSettled,
  isAvatarHidden,
  isAvatarNamed,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { VisuallyHidden } from "../visually-hidden"

declare module "../provider" {
  interface RindMessageScopes {
    avatar: AvatarMessages
  }
}

// useLayoutEffect warns on the server; it never runs there anyway.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface AvatarState {
  readonly status: AvatarStatus
}

type Send = ReturnType<typeof useMachine<typeof avatarMachine>>["send"]

interface AvatarContextValue {
  readonly api: ReturnType<typeof avatarConnect>
  readonly send: Send
  readonly state: AvatarState
  readonly fallback: boolean
  /** Numbers the image's sources: load and error events of a replaced one are dropped. */
  readonly source: RefObject<number>
  /** The registered Image re-reads its element (after the service started). */
  readonly register: RefObject<(() => void) | null>
  readonly images: RefObject<number>
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
  const { view, send } = useMachine(avatarMachine, { fallbackDelay, onStatusChange })
  const own = rest as Readonly<Record<string, unknown>> // the element's own props, read by name
  const api = avatarConnect({
    instance,
    status: view.state,
    named: isAvatarNamed(own),
    hidden: isAvatarHidden(own),
  })
  const source = useRef(0)
  const register = useRef<(() => void) | null>(null)
  const images = useRef(0)
  // After the service started (useMachine's effect runs first): the Image re-reads its
  // element, since a registration sent while the service was stopped (Strict Mode's remount)
  // is dropped; then the fallback rules for `idle`/`error` apply.
  // Once, after mount: the development check reads the props it mounted with.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    register.current?.()
    send({ type: "ROOT.MOUNT" })
    checkAvatarName(own, instance)
  }, [send])
  const state: AvatarState = { status: view.state }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  const label = rest["aria-label"]
  return (
    <AvatarContext
      value={{
        api,
        send,
        state,
        fallback: fallbackVisible(view.state, view.context.fallbackReady),
        source,
        register,
        images,
        name: typeof label === "string" ? label : undefined,
      }}
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

/** An empty source is no source: never written (browsers may refetch the page). */
const nonEmpty = <T,>(v: T | "" | undefined): T | undefined => (v === "" ? undefined : v)

function Image({
  src,
  srcSet,
  sizes,
  loading,
  onLoad,
  onError,
  render,
  ref,
  ...rest
}: AvatarImageProps) {
  const ctx = useAvatar("Image")
  const { send, source, images, register } = ctx
  const el = useRef<HTMLImageElement | null>(null)
  const url = nonEmpty(src)
  const set = nonEmpty(srcSet)
  const hasSource = url !== undefined || set !== undefined
  // Reads the element at commit: a load that fired before hydration is not missed.
  const read = (type: "IMAGE.MOUNT" | "IMAGE.SOURCE") => {
    const img = el.current
    if (!img) return
    const current = ++source.current
    const settled = hasSource ? imageSettled(img) : "loading"
    if (typeof settled === "string") {
      send({ type, hasSource, source: current, settled })
      return
    }
    send({ type, hasSource, source: current, settled: "loading" })
    settled.then((status) => send({ type: "IMAGE.SETTLED", status, source: current }))
  }
  const latest = useRef(read)
  latest.current = read
  useIsoLayoutEffect(() => {
    images.current++
    checkImageCount(images.current)
    register.current = () => latest.current("IMAGE.MOUNT")
    latest.current("IMAGE.MOUNT")
    return () => {
      images.current--
      register.current = null
      send({ type: "IMAGE.UNMOUNT" })
    }
  }, [send, images, register])
  const key = `${url ?? ""}\n${set ?? ""}\n${sizes ?? ""}`
  const first = useRef(true)
  // Re-reads the element when the source changes (`key`), not on the first commit.
  useIsoLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    latest.current("IMAGE.SOURCE")
  }, [key])
  useEffect(() => checkImageAlt(rest.alt, ctx.name), [rest.alt, ctx.name])
  const merged = mergeProps(
    {
      ...normalizeProps(ctx.api.image()),
      ref: composeRefs(el, ref),
      onLoad: () => send({ type: "IMAGE.LOAD", source: source.current }),
      onError: () => send({ type: "IMAGE.ERROR", source: source.current }),
    },
    { ...rest, ...(onLoad ? { onLoad } : {}), ...(onError ? { onError } : {}) },
  )
  // `src` last: React sets attributes in prop order, and Safari and Firefox start fetching
  // when `src` lands, ignoring a `srcSet`, `sizes` or `loading` set after it.
  const props = {
    ...merged,
    ...(set === undefined ? {} : { srcSet: set }),
    ...(sizes === undefined ? {} : { sizes }),
    ...(loading === undefined ? {} : { loading }),
    ...(url === undefined ? {} : { src: url }),
  }
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
