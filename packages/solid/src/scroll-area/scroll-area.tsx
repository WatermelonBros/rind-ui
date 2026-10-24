/** @jsxImportSource solid-js */
import {
  domScrollMetrics,
  type ScrollAreaState as ScrollAreaActivity,
  type ScrollAreaConnectInput,
  type ScrollAreaProps as ScrollAreaMachineProps,
  type ScrollAreaType,
  scrollAreaConnect,
  scrollAreaMachine,
  warnUnnamedTabStop,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

export interface ScrollAreaState {
  readonly state: ScrollAreaActivity
}

/** What `actionsRef` exposes. */
export interface ScrollAreaActions {
  /** Re-measures after a change the observers cannot see (a deep descendant resized). */
  measure(): void
}

type Orientation = "vertical" | "horizontal"
type Connect = ReturnType<typeof scrollAreaConnect>

interface Ctx {
  readonly connect: Accessor<Connect>
  readonly send: Parameters<Connect["root"]>[0]
  readonly input: Accessor<ScrollAreaConnectInput>
  readonly state: ScrollAreaState
  readonly register: (o: Orientation) => () => void
  readonly bars: Accessor<ReadonlySet<Orientation>>
}
const ScrollAreaContext = createContext<Ctx>()
const ScrollbarContext = createContext<Accessor<Orientation>>()
function useScrollArea(part: string): Ctx {
  const ctx = useContext(ScrollAreaContext)
  if (!ctx) throw new Error(`ScrollArea.${part} must be inside ScrollArea.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<ScrollAreaState> | undefined
  readonly children?: JSX.Element | ((state: ScrollAreaState) => JSX.Element)
}

export type ScrollAreaRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Default `hover`. */
  readonly type?: ScrollAreaType | undefined
  /** Default 600 ms. */
  readonly hideDelay?: number | undefined
  /** Default `page`. */
  readonly trackPress?: "page" | "jump" | undefined
  /** Receives the actions once, when the Root is created. */
  readonly actionsRef?: ((actions: ScrollAreaActions) => void) | undefined
}

function Root(props: ScrollAreaRootProps) {
  const [own, rest] = splitProps(props, [
    "type",
    "hideDelay",
    "trackPress",
    "actionsRef",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment()
  const areaEnv = { ...env, scrollMetrics: domScrollMetrics(env) }
  let handle: { measure(): void } | null = null
  const type = () => own.type ?? "hover"
  const { view, send } = useMachine(
    scrollAreaMachine,
    (): ScrollAreaMachineProps => ({
      root: instance(),
      type: type(),
      hideDelay: own.hideDelay,
      trackPress: own.trackPress,
      onTrack: (h) => {
        handle = h
      },
    }),
    areaEnv,
  )
  own.actionsRef?.({ measure: () => handle?.measure() })
  const [bars, setBars] = createSignal<ReadonlySet<Orientation>>(new Set())
  const register = (o: Orientation) => {
    setBars((b) => new Set([...b, o]))
    return () =>
      setBars((b) => {
        const next = new Set(b)
        next.delete(o)
        return next
      })
  }
  // The window's tracker installed while mounted (it records the pointer before a focus);
  // re-renders only while the Viewport has focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const modality = useModality(env.modality, () => view().context.viewportFocused)
  const input = createMemo(
    (): ScrollAreaConnectInput => ({
      instance: instance(),
      state: view().state as ScrollAreaActivity,
      context: view().context,
      type: type(),
      modality: modality(),
    }),
  )
  const connect = createMemo(() => scrollAreaConnect(input()))
  const state = reactive<ScrollAreaState>(() => ({ state: input().state }))
  const ctx: Ctx = { connect, send, input, state, register, bars }
  // The Root's id is the instance's: a consumer id names the instance, the part id stays ours.
  const merged = createMemo(() => mergeProps(normalizeProps(connect().root(send)), rest))
  const children = () => resolveChildren(own.children, state)
  return (
    <ScrollAreaContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ScrollAreaContext.Provider>
  )
}

export type ScrollAreaViewportProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** The native scroll container. */
function Viewport(props: ScrollAreaViewportProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useScrollArea("Viewport")
  const named = () => rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  afterMount(() => {
    createEffect(() => {
      const tabStop =
        ctx.input().context.tabStop && rest.tabIndex === undefined && rest["tabindex"] === undefined
      warnUnnamedTabStop(tabStop, named())
    })
  })
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.connect().viewport(ctx.send, named())), rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type ScrollAreaContentProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** Your content, measured; the only element between the Viewport and your children. */
function Content(props: ScrollAreaContentProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useScrollArea("Content")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().content()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type ScrollAreaScrollbarProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Default `vertical`. */
  readonly orientation?: Orientation | undefined
}

function Scrollbar(props: ScrollAreaScrollbarProps) {
  const [local, rest] = splitProps(props, ["orientation", "render", "children"])
  const ctx = useScrollArea("Scrollbar")
  const orientation = () => local.orientation ?? "vertical"
  createEffect(() => onCleanup(ctx.register(orientation())))
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.connect().scrollbar(ctx.send, orientation())), rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <ScrollbarContext.Provider value={orientation}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ScrollbarContext.Provider>
  )
}

export type ScrollAreaThumbProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Thumb(props: ScrollAreaThumbProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useScrollArea("Thumb")
  const orientation = useContext(ScrollbarContext) ?? (() => "vertical" as const)
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.connect().thumb(orientation())), rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type ScrollAreaCornerProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** Rendered only when both Scrollbars are. */
function Corner(props: ScrollAreaCornerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useScrollArea("Corner")
  const both = () => ctx.bars().has("vertical") && ctx.bars().has("horizontal")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().corner()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <Show when={both()}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </Show>
  )
}

/** The parts, by name: `scroll-area.parts.ts` re-exports them as the `ScrollArea` namespace. */
export { Content, Corner, Root, Scrollbar, Thumb, Viewport }
