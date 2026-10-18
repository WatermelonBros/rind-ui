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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface ScrollAreaState {
  readonly state: ScrollAreaActivity
}

/** What `actionsRef` exposes. */
export interface ScrollAreaActions {
  /** Re-measures after a change the observers cannot see (a deep descendant resized). */
  measure(): void
}

type Orientation = "vertical" | "horizontal"

interface Ctx {
  readonly connect: ReturnType<typeof scrollAreaConnect>
  readonly send: Parameters<ReturnType<typeof scrollAreaConnect>["root"]>[0]
  readonly input: ScrollAreaConnectInput
  readonly register: (o: Orientation) => () => void
  readonly bars: ReadonlySet<Orientation>
}
const ScrollAreaContext = createContext<Ctx | null>(null)
const ScrollbarContext = createContext<Orientation>("vertical")
function useScrollArea(part: string): Ctx {
  const ctx = useContext(ScrollAreaContext)
  if (!ctx) throw new Error(`ScrollArea.${part} must be inside ScrollArea.Root`)
  return ctx
}

export type ScrollAreaRootProps = ComponentPropsWithRef<"div"> & {
  /** Default `hover`. */
  readonly type?: ScrollAreaType
  /** Default 600 ms. */
  readonly hideDelay?: number
  /** Default `page`. */
  readonly trackPress?: "page" | "jump"
  readonly actionsRef?: Ref<ScrollAreaActions>
  readonly render?: RenderProp<ScrollAreaState>
  /** The Viewport, Scrollbars and Corner. */
  readonly children?: ReactNode
}

function Root({
  type = "hover",
  hideDelay,
  trackPress,
  actionsRef,
  render,
  id,
  ...rest
}: ScrollAreaRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment()
  const areaEnv = useMemo(() => ({ ...env, scrollMetrics: domScrollMetrics(env) }), [env])
  const handle = useRef<{ measure(): void } | null>(null)
  const props: ScrollAreaMachineProps = {
    root: instance,
    type,
    hideDelay,
    trackPress,
    onTrack: (h) => {
      handle.current = h
    },
  }
  const { view, send } = useMachine(scrollAreaMachine, props, areaEnv)
  useImperativeHandle(actionsRef, () => ({ measure: () => handle.current?.measure() }), [])
  const [bars, setBars] = useState<ReadonlySet<Orientation>>(() => new Set())
  const register = useMemo(
    () => (o: Orientation) => {
      setBars((b) => new Set([...b, o]))
      return () =>
        setBars((b) => {
          const next = new Set(b)
          next.delete(o)
          return next
        })
    },
    [],
  )
  // The window's tracker installed while mounted (it records the pointer before a focus);
  // re-renders only while the Viewport has focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const modality = useModality(env.modality, view.context.viewportFocused)
  const input: ScrollAreaConnectInput = {
    instance,
    state: view.state as ScrollAreaActivity,
    context: view.context,
    type,
    modality,
  }
  const ctx: Ctx = {
    connect: scrollAreaConnect(input),
    send,
    input,
    register,
    bars,
  }
  const own = normalizeProps(ctx.connect.root(send))
  // The Root's id is the instance's: a consumer id names the instance, the part id stays ours.
  return (
    <ScrollAreaContext value={ctx}>
      {renderPart("div", mergeProps(own, rest), render, { state: input.state })}
    </ScrollAreaContext>
  )
}

export type ScrollAreaViewportProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<ScrollAreaState>
}

/** The native scroll container. */
function Viewport({ render, ...rest }: ScrollAreaViewportProps) {
  const { connect, send, input } = useScrollArea("Viewport")
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const tabStop = input.context.tabStop && rest.tabIndex === undefined
  useEffect(() => warnUnnamedTabStop(tabStop, named), [tabStop, named])
  const props = mergeProps(normalizeProps(connect.viewport(send, named)), rest)
  return renderPart("div", props, render, { state: input.state })
}

export type ScrollAreaContentProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<ScrollAreaState>
}

/** Your content, measured; the only element between the Viewport and your children. */
function Content({ render, ...rest }: ScrollAreaContentProps) {
  const { connect, input } = useScrollArea("Content")
  return renderPart("div", mergeProps(normalizeProps(connect.content()), rest), render, {
    state: input.state,
  })
}

export type ScrollAreaScrollbarProps = ComponentPropsWithRef<"div"> & {
  /** Default `vertical`. */
  readonly orientation?: Orientation
  readonly render?: RenderProp<ScrollAreaState>
}

function Scrollbar({ orientation = "vertical", render, ...rest }: ScrollAreaScrollbarProps) {
  const { connect, send, input, register } = useScrollArea("Scrollbar")
  useIsoLayoutEffect(() => register(orientation), [register, orientation])
  const props = mergeProps(normalizeProps(connect.scrollbar(send, orientation)), rest)
  return (
    <ScrollbarContext value={orientation}>
      {renderPart("div", props, render, { state: input.state })}
    </ScrollbarContext>
  )
}

export type ScrollAreaThumbProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<ScrollAreaState>
}

function Thumb({ render, ...rest }: ScrollAreaThumbProps) {
  const { connect, input } = useScrollArea("Thumb")
  const orientation = useContext(ScrollbarContext)
  return renderPart("div", mergeProps(normalizeProps(connect.thumb(orientation)), rest), render, {
    state: input.state,
  })
}

export type ScrollAreaCornerProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<ScrollAreaState>
}

/** Rendered only when both Scrollbars are. */
function Corner({ render, ...rest }: ScrollAreaCornerProps) {
  const { connect, input, bars } = useScrollArea("Corner")
  if (!bars.has("vertical") || !bars.has("horizontal")) return null
  return renderPart("div", mergeProps(normalizeProps(connect.corner()), rest), render, {
    state: input.state,
  })
}

/** A native scroll container with custom-drawn scrollbars (native scrolling kept). */
export const ScrollArea = { Root, Viewport, Content, Scrollbar, Thumb, Corner }
