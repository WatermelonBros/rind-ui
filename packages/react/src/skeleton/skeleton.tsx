"use client"

import {
  type MessageOverrides,
  type SkeletonMessages,
  skeletonConnect,
  skeletonMachine,
  skeletonMessages,
  warnStatusPlacement,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
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
  readonly connect: ReturnType<typeof skeletonConnect>
  readonly messages: SkeletonMessages
  readonly loading: boolean
}
const SkeletonContext = createContext<Ctx | null>(null)
function useSkeleton(part: string): Ctx {
  const ctx = useContext(SkeletonContext)
  if (!ctx) throw new Error(`Skeleton.${part} must be inside Skeleton.Root`)
  return ctx
}

export type SkeletonRootProps = ComponentPropsWithRef<"div"> & {
  /** Default `true`: the whole area is loading. */
  readonly loading?: boolean
  /** Announce politely on `loading → loaded`: `true` for `messages.loaded`, or the text. */
  readonly announceOnLoad?: boolean | string
  /** Default `true`: Items carry `data-animate` while loading. */
  readonly animate?: boolean
  readonly messages?: MessageOverrides<SkeletonMessages>
  readonly render?: RenderProp<SkeletonState>
}

function Root({
  loading = true,
  announceOnLoad,
  animate = true,
  messages: ownMessages,
  render,
  id,
  ...rest
}: SkeletonRootProps) {
  const instance = useRootId(id)
  const messages = useMessages("skeleton", skeletonMessages, ownMessages)
  const { locale } = useLocale()
  const { view } = useMachine(skeletonMachine, {
    loading,
    announceOnLoad,
    messages,
    id: instance,
    lang: locale,
  })
  const isLoading = view.state === "loading"
  const ctx = useMemo(
    () => ({
      connect: skeletonConnect({ instance, loading: isLoading, animate }),
      messages,
      loading: isLoading,
    }),
    [instance, isLoading, animate, messages],
  )
  const props = mergeProps(
    { ...normalizeProps(ctx.connect.root()), ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <SkeletonContext value={ctx}>
      {renderPart("div", props, render, { loading: isLoading })}
    </SkeletonContext>
  )
}

export type SkeletonStatusProps = ComponentPropsWithRef<"span"> & {
  readonly render?: RenderProp<SkeletonState>
}

/** The loading text, visually hidden, outside Content; renders nothing when loaded. */
function Status({ render, children, ref, ...rest }: SkeletonStatusProps) {
  const { connect, messages, loading } = useSkeleton("Status")
  const el = useRef<HTMLElement | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the element mounts again on reload
  useEffect(() => {
    if (el.current) warnStatusPlacement(el.current)
  }, [loading])
  const own = connect.status()
  if (!own) return null
  const props = mergeProps(
    { ...normalizeProps(own), ref: composeRefs(el, ref), children: children ?? messages.loading },
    rest,
  )
  return renderPart("span", props, render, { loading })
}

export type SkeletonContentProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<SkeletonState>
}

/** The loading region: `aria-busy` while loading. */
function Content({ render, ...rest }: SkeletonContentProps) {
  const { connect, loading } = useSkeleton("Content")
  return renderPart("div", mergeProps(normalizeProps(connect.content()), rest), render, {
    loading,
  })
}

export type SkeletonItemProps = ComponentPropsWithRef<"span"> & {
  /** Overrides the Root's state for this Item. */
  readonly loading?: boolean
  /** Overrides the Root's `animate`. */
  readonly animate?: boolean
  /** Stale content, hidden from assistive technology and inert while loading; none: a placeholder. */
  readonly children?: ReactNode
  readonly render?: RenderProp<SkeletonState>
}

/** A placeholder, or a wrapper hiding stale content while loading. */
function Item({ loading, animate, render, children, ...rest }: SkeletonItemProps) {
  const { connect } = useSkeleton("Item")
  const own = connect.item({
    loading,
    animate,
    hasChildren: children !== undefined && children !== null && children !== false,
  })
  const props = mergeProps(normalizeProps(own), rest)
  return renderPart("span", { ...props, children }, render, {
    loading: own["data-state"] === "loading",
  })
}

/** Placeholders for content that is loading, with the loading state exposed once. */
export const Skeleton = { Root, Status, Content, Item }
