/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type MessageOverrides,
  type SkeletonMessages,
  skeletonConnect,
  skeletonMachine,
  skeletonMessages,
  warnStatusPlacement,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  children as resolve,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    skeleton: SkeletonMessages
  }
}

export interface SkeletonState {
  readonly loading: boolean
}

interface Ctx {
  readonly connect: Accessor<ReturnType<typeof skeletonConnect>>
  readonly messages: Accessor<SkeletonMessages>
  readonly state: SkeletonState
}
const SkeletonContext = createContext<Ctx>()
function useSkeleton(part: string): Ctx {
  const ctx = useContext(SkeletonContext)
  if (!ctx) throw new Error(`Skeleton.${part} must be inside Skeleton.Root`)
  return ctx
}

type Attributes<E extends HTMLElement> = Omit<JSX.HTMLAttributes<E>, "children">

export type SkeletonRootProps = Attributes<HTMLDivElement> & {
  /** Default `true`: the whole area is loading. */
  readonly loading?: boolean | undefined
  /** Announce politely on `loading → loaded`: `true` for `messages.loaded`, or the text. */
  readonly announceOnLoad?: boolean | string | undefined
  /** Default `true`: Items carry `data-animate` while loading. */
  readonly animate?: boolean | undefined
  readonly messages?: MessageOverrides<SkeletonMessages> | undefined
  readonly render?: RenderProp<SkeletonState> | undefined
  readonly children?: JSX.Element
}

function Root(props: SkeletonRootProps) {
  const [local, rest] = splitProps(props, [
    "loading",
    "announceOnLoad",
    "animate",
    "messages",
    "render",
    "id",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const messages = useMessages("skeleton", skeletonMessages, () => local.messages)
  const locale = useLocale(() => undefined)
  const env = useEnvironment(announcerCapability)
  const { view } = useMachine(
    skeletonMachine,
    () => ({
      loading: local.loading ?? true,
      announceOnLoad: local.announceOnLoad,
      messages: messages(),
      id: instance(),
      lang: locale().locale,
    }),
    env,
  )
  const isLoading = () => view().state === "loading"
  const connect = createMemo(() =>
    skeletonConnect({
      instance: instance(),
      loading: isLoading(),
      animate: local.animate ?? true,
    }),
  )
  const state = reactive<SkeletonState>(() => ({ loading: isLoading() }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(connect().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  const children = () => local.children
  return (
    <SkeletonContext.Provider value={{ connect, messages, state }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </SkeletonContext.Provider>
  )
}

export type SkeletonStatusProps = Attributes<HTMLSpanElement> & {
  readonly render?: RenderProp<SkeletonState> | undefined
  readonly children?: JSX.Element
}

/** The loading text, visually hidden, outside Content; renders nothing when loaded. */
function Status(props: SkeletonStatusProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSkeleton("Status")
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() =>
    createEffect(() => {
      // The element mounts again on reload.
      const node = el()
      if (node) warnStatusPlacement(node)
    }),
  )
  const own = createMemo(() => ctx.connect().status())
  const merged = createMemo(() => mergeProps({ ...normalizeProps(own() ?? {}), ref: setEl }, rest))
  const children = (): JSX.Element => {
    const given = local.children
    return given ?? ctx.messages().loading
  }
  return (
    <Show when={own() !== null && own() !== undefined}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <span {...p}>{children()}</span>
      ))}
    </Show>
  )
}

export type SkeletonContentProps = Attributes<HTMLDivElement> & {
  readonly render?: RenderProp<SkeletonState> | undefined
  readonly children?: JSX.Element
}

/** The loading region: `aria-busy` while loading. */
function Content(props: SkeletonContentProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSkeleton("Content")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().content()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type SkeletonItemProps = Attributes<HTMLSpanElement> & {
  /** Overrides the Root's state for this Item. */
  readonly loading?: boolean | undefined
  /** Overrides the Root's `animate`. */
  readonly animate?: boolean | undefined
  /** Stale content, hidden from assistive technology and inert while loading; none: a placeholder. */
  readonly children?: JSX.Element
  readonly render?: RenderProp<SkeletonState> | undefined
}

/** A placeholder, or a wrapper hiding stale content while loading. */
function Item(props: SkeletonItemProps) {
  const [local, rest] = splitProps(props, ["loading", "animate", "render", "children"])
  const ctx = useSkeleton("Item")
  // Resolved once: also tells whether there are any children, without building them twice.
  const content = resolve(() => local.children)
  const hasChildren = () => {
    const value = content()
    return value !== undefined && value !== null && value !== false && !isEmpty(value)
  }
  const own = createMemo(() =>
    ctx.connect().item({
      loading: local.loading,
      animate: local.animate,
      hasChildren: hasChildren(),
    }),
  )
  const merged = createMemo(() => mergeProps(normalizeProps(own()), rest))
  const state = reactive<SkeletonState>(() => ({ loading: own()["data-state"] === "loading" }))
  return renderPart(local.render, merged, state, content, (p) => <span {...p}>{content()}</span>)
}

const isEmpty = (value: unknown) => Array.isArray(value) && value.length === 0

/** Placeholders for content that is loading, with the loading state exposed once. */
/** The parts, by name: `skeleton.parts.ts` re-exports them as the `Skeleton` namespace. */
export { Content, Item, Root, Status }
