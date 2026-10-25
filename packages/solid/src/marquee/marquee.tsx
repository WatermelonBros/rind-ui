/** @jsxImportSource solid-js */
import {
  type ChangeDetails,
  type MarqueeEvent,
  type MarqueeMessages,
  type MarqueeOrientation,
  type MarqueeState,
  type MessageOverrides,
  marqueeConnect,
  marqueeCopies,
  marqueeDuration,
  marqueeMachine,
  marqueeMessages,
  marqueeSpeed,
  mirror,
  observeMarquee,
  partId,
  retime,
  reveal,
  untabbable,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    marquee: MarqueeMessages
  }
}

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** What every part's `render` receives. */
export interface MarqueeRenderState {
  readonly state: MarqueeState
  /** The user pause (a hover pause is `state` "paused" with this false). */
  readonly paused: boolean
  readonly orientation: MarqueeOrientation
  readonly reverse: boolean
}

type Api = ReturnType<typeof marqueeConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: MarqueeEvent) => void
  readonly state: MarqueeRenderState
  readonly orientation: Accessor<MarqueeOrientation>
  readonly reverse: Accessor<boolean>
  readonly copies: Accessor<number>
}
const MarqueeContext = createContext<Ctx>()
function useMarquee(part: string): Ctx {
  const ctx = useContext(MarqueeContext)
  if (!ctx) throw new Error(`Marquee.${part} must be inside Marquee.Root`)
  return ctx
}

export type MarqueeRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly children?: JSX.Element | ((state: MarqueeRenderState) => JSX.Element)
  /** Controlled user pause. */
  readonly paused?: boolean | undefined
  /** Uncontrolled initial user pause. */
  readonly defaultPaused?: boolean | undefined
  /** `details.reason`: "trigger" or "focus". */
  readonly onPausedChange?:
    | ((paused: boolean, details: ChangeDetails<MarqueeEvent>) => void)
    | undefined
  /** A mouse or pen over the Viewport pauses until it leaves (never touch). Default true. */
  readonly pauseOnHover?: boolean | undefined
  /** CSS px per second (default 50); below 1 counts as 1. */
  readonly speed?: number | undefined
  readonly orientation?: MarqueeOrientation | undefined
  /** Moves toward the inline end (or down). */
  readonly reverse?: boolean | undefined
  /** Enough copies to fill the Viewport (at most 32). */
  readonly autoFill?: boolean | undefined
  readonly messages?: MessageOverrides<MarqueeMessages> | undefined
  readonly render?: RenderProp<MarqueeRenderState> | undefined
}

function Root(props: MarqueeRootProps) {
  const [own, rest] = splitProps(props, [
    "paused",
    "defaultPaused",
    "onPausedChange",
    "pauseOnHover",
    "speed",
    "orientation",
    "reverse",
    "autoFill",
    "messages",
    "render",
    "children",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => rest.id)
  const messages = useMessages("marquee", marqueeMessages, () => own.messages)
  const { view, send } = useMachine(
    marqueeMachine,
    () => ({
      paused: own.paused,
      defaultPaused: own.defaultPaused,
      ...(own.onPausedChange ? { onPausedChange: own.onPausedChange } : {}),
      pauseOnHover: own.pauseOnHover ?? true,
    }),
    {},
  )
  // Read after hydration, then followed: the server and the first client render agree.
  afterMount(() => {
    send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    onCleanup(
      env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
    )
  })
  afterMount(() => {
    if (process.env.NODE_ENV === "production") return
    createEffect(() => {
      const speed = own.speed
      if (speed === undefined) return
      if (marqueeSpeed(speed) !== speed) {
        console.warn(`[rind-ui] marquee: speed ${speed} is below 1 or not finite; using 1`)
      }
    })
  })
  const orientation = createMemo(() => own.orientation ?? "horizontal")
  const reverse = createMemo(() => own.reverse === true)
  const autoFill = () => own.autoFill === true
  const mstate = () => view().state as MarqueeState
  const api = createMemo(() =>
    marqueeConnect({
      instance: instance(),
      state: mstate(),
      paused: view().values.paused,
      orientation: orientation(),
      reverse: reverse(),
      autoFill: autoFill(),
      duration: marqueeDuration(view().context.size, own.speed),
      ids: { viewport: partId("marquee", instance(), "viewport") },
      messages: messages(),
    }),
  )
  const state = reactive<MarqueeRenderState>(() => ({
    state: mstate(),
    paused: view().values.paused,
    orientation: orientation(),
    reverse: reverse(),
  }))
  const copies = createMemo(() => marqueeCopies(mstate(), view().context.size, autoFill()))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <MarqueeContext.Provider value={{ api, send, state, orientation, reverse, copies }}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </MarqueeContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<MarqueeRenderState> | undefined
  readonly children?: JSX.Element | ((state: MarqueeRenderState) => JSX.Element)
}

export type MarqueePauseTriggerProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function PauseTrigger(props: MarqueePauseTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useMarquee("PauseTrigger")
  const env = useEnvironment()
  // Tracking from mount, so the press that focuses it is already known as a pointer one.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(
        normalizeProps(ctx.api().pauseTrigger({ focused: focused(), modality: modality() })),
        {
          onClick: () => ctx.send({ type: "TRIGGER.PRESS", modality: env.modality.modality() }),
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        },
      ),
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

const copiesIn = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>(':scope > [data-part="content"]'))

export type MarqueeViewportProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Viewport(props: MarqueeViewportProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useMarquee("Viewport")
  const env = useEnvironment()
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const { send } = ctx
  const axis = createMemo(() => (ctx.orientation() === "horizontal" ? "x" : "y"))
  const duration = createMemo(() => {
    const style = ctx.api().viewport()["style"] as Record<string, string> | undefined
    return Number.parseFloat(style?.["--rind-marquee-duration"] ?? "") * 1000
  })
  // Measure the viewport and the original copy, once per frame on change.
  afterMount(() => {
    createEffect(() => {
      const viewport = el()
      const a = axis()
      const first = viewport?.querySelector<HTMLElement>(':scope > [data-part="content"]')
      if (!viewport || !first) return
      onCleanup(
        observeMarquee(viewport, first, a, env.scheduler, (size) =>
          send({ type: "MEASURED", ...size }),
        ),
      )
    })
  })
  // A new duration keeps the progress, a new direction keeps the position.
  let last = { duration: untrack(duration), reverse: untrack(ctx.reverse) }
  createEffect(() => {
    const now = { duration: duration(), reverse: ctx.reverse() }
    const prev = last
    last = now
    const viewport = untrack(el)
    if (!viewport) return
    const copies = copiesIn(viewport)
    if (prev.duration !== now.duration) retime(copies, prev.duration, now.duration)
    if (prev.reverse !== now.reverse) mirror(copies, now.duration)
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().viewport()), {
          onPointerEnter: (e: PointerEvent) => {
            if (e.pointerType !== "touch") send({ type: "POINTER.ENTER" })
          },
          onPointerLeave: (e: PointerEvent) => {
            if (e.pointerType !== "touch") send({ type: "POINTER.LEAVE" })
          },
          onFocusIn: (e: FocusEvent) => {
            const modality = env.modality.modality()
            send({ type: "FOCUS.ENTER", modality })
            if (modality !== "keyboard" && modality !== "virtual") return
            const viewport = e.currentTarget as HTMLElement
            reveal(e.target as Element, viewport, copiesIn(viewport), {
              axis: axis(),
              dir: getComputedStyle(viewport).direction === "rtl" ? "rtl" : "ltr",
              reversed: ctx.reverse(),
              durationMs: duration(),
            })
          },
        }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

type ContentProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** One hidden copy: same element and children, no tab stop inside (kept as content changes). */
function Copy(props: {
  readonly index: number
  readonly render: RenderProp<MarqueeRenderState> | undefined
  readonly content: () => JSX.Element
  readonly rest: Record<string | symbol, unknown>
}) {
  const ctx = useMarquee("Content")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  afterMount(() => {
    const node = el()
    if (node) onCleanup(untabbable(node))
  })
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().content(props.index)), props.rest, { ref: setEl }),
  )
  return renderPart(props.render, merged, ctx.state, props.content, (p) => (
    <div {...p}>{props.content()}</div>
  ))
}

function Content(props: ContentProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useMarquee("Content")
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() => {
    if (process.env.NODE_ENV === "production") return
    if (el()?.querySelector("[id]")) {
      console.warn("[rind-ui] marquee: an element with an id is in the Content; copies repeat it")
    }
  })
  // The consumer's id (and ref) stay on the original only.
  const [, shared] = splitProps(rest, ["id", "ref"])
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().content(0)), rest, { ref: setEl }),
  )
  // Read afresh by each copy: every copy builds its own nodes.
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
      <For each={Array.from({ length: Math.max(0, ctx.copies() - 1) }, (_, i) => i + 1)}>
        {(index) => (
          <Copy
            index={index}
            render={local.render}
            content={children}
            rest={shared as Record<string | symbol, unknown>}
          />
        )}
      </For>
    </>
  )
}

/** The parts, by name: `marquee.parts.ts` re-exports them as the `Marquee` namespace. */
export { Content, PauseTrigger, Root, Viewport }
