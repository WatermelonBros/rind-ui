"use client"

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
  type ComponentPropsWithRef,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
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

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly api: Api
  readonly send: (event: MarqueeEvent) => void
  readonly state: MarqueeRenderState
  readonly copies: number
  readonly ids: { readonly viewport: string }
}
const MarqueeContext = createContext<Ctx | null>(null)
function useMarquee(part: string): Ctx {
  const ctx = useContext(MarqueeContext)
  if (!ctx) throw new Error(`Marquee.${part} must be inside Marquee.Root`)
  return ctx
}

export type MarqueeRootProps = ComponentPropsWithRef<"div"> & {
  /** Controlled user pause. */
  readonly paused?: boolean
  /** Uncontrolled initial user pause. */
  readonly defaultPaused?: boolean
  /** `details.reason`: "trigger" or "focus". */
  readonly onPausedChange?: (paused: boolean, details: ChangeDetails<MarqueeEvent>) => void
  /** A mouse or pen over the Viewport pauses until it leaves (never touch). Default true. */
  readonly pauseOnHover?: boolean
  /** CSS px per second (default 50); below 1 counts as 1. */
  readonly speed?: number
  readonly orientation?: MarqueeOrientation
  /** Moves toward the inline end (or down). */
  readonly reverse?: boolean
  /** Enough copies to fill the Viewport (at most 32). */
  readonly autoFill?: boolean
  readonly messages?: MessageOverrides<MarqueeMessages>
  readonly render?: RenderProp<MarqueeRenderState>
}

function Root({
  paused,
  defaultPaused,
  onPausedChange,
  pauseOnHover = true,
  speed,
  orientation = "horizontal",
  reverse = false,
  autoFill = false,
  messages: ownMessages,
  render,
  id,
  ref,
  children,
  ...rest
}: MarqueeRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const messages = useMessages("marquee", marqueeMessages, ownMessages)
  const { view, send } = useMachine(
    marqueeMachine,
    {
      paused,
      defaultPaused,
      ...(onPausedChange ? { onPausedChange } : {}),
      pauseOnHover,
    },
    {},
  )
  // Read after hydration, then followed: the server and the first client render agree.
  useEffect(() => {
    send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    return env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced }))
  }, [env, send])
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || speed === undefined) return
    if (marqueeSpeed(speed) !== speed) {
      console.warn(`[rind-ui] marquee: speed ${speed} is below 1 or not finite; using 1`)
    }
  }, [speed])
  const state = view.state as MarqueeState
  const userPaused = view.values.paused
  const ids = { viewport: partId("marquee", instance, "viewport") }
  const api = marqueeConnect({
    instance,
    state,
    paused: userPaused,
    orientation,
    reverse,
    autoFill,
    duration: marqueeDuration(view.context.size, speed),
    ids,
    messages,
  })
  const renderState: MarqueeRenderState = { state, paused: userPaused, orientation, reverse }
  const ctx: Ctx = {
    api,
    send,
    state: renderState,
    copies: marqueeCopies(state, view.context.size, autoFill),
    ids,
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ref, ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <MarqueeContext value={ctx}>
      {renderPart("div", { ...props, children }, render, renderState)}
    </MarqueeContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<MarqueeRenderState>
}

function PauseTrigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useMarquee("PauseTrigger")
  const env = useEnvironment()
  // Tracking from mount, so the press that focuses it is already known as a pointer one.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.pauseTrigger({ focused, modality })), {
        onClick: () => ctx.send({ type: "TRIGGER.PRESS", modality: env.modality.modality() }),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref,
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

const copiesIn = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>(':scope > [data-part="content"]'))

function Viewport({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useMarquee("Viewport")
  const env = useEnvironment()
  const el = useRef<HTMLDivElement | null>(null)
  const { send } = ctx
  const { orientation, reverse } = ctx.state
  const axis = orientation === "horizontal" ? "x" : "y"
  const style = ctx.api.viewport()["style"] as Record<string, string> | undefined
  const duration = Number.parseFloat(style?.["--rind-marquee-duration"] ?? "") * 1000
  // Measure the viewport and the original copy, once per frame on change.
  useEffect(() => {
    const viewport = el.current
    const first = viewport?.querySelector<HTMLElement>(':scope > [data-part="content"]')
    if (!viewport || !first) return
    return observeMarquee(viewport, first, axis, env.scheduler, (size) =>
      send({ type: "MEASURED", ...size }),
    )
  }, [axis, env.scheduler, send])
  // Before paint: a new duration keeps the progress, a new direction keeps the position.
  const last = useRef({ duration, reverse })
  useIsoLayoutEffect(() => {
    const prev = last.current
    last.current = { duration, reverse }
    const viewport = el.current
    if (!viewport) return
    const copies = copiesIn(viewport)
    if (prev.duration !== duration) retime(copies, prev.duration, duration)
    if (prev.reverse !== reverse) mirror(copies, duration)
  }, [duration, reverse])
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.viewport()), {
        onPointerEnter: (e: React.PointerEvent) => {
          if (e.pointerType !== "touch") send({ type: "POINTER.ENTER" })
        },
        onPointerLeave: (e: React.PointerEvent) => {
          if (e.pointerType !== "touch") send({ type: "POINTER.LEAVE" })
        },
        onFocus: (e: React.FocusEvent<HTMLDivElement>) => {
          const modality = env.modality.modality()
          send({ type: "FOCUS.ENTER", modality })
          if (modality !== "keyboard" && modality !== "virtual") return
          const viewport = e.currentTarget
          reveal(e.target, viewport, copiesIn(viewport), {
            axis,
            dir: getComputedStyle(viewport).direction === "rtl" ? "rtl" : "ltr",
            reversed: reverse,
            durationMs: duration,
          })
        },
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("div", { ...props, children }, render, ctx.state)
}

/** One hidden copy: same element and children, no tab stop inside (kept as content changes). */
function Copy({
  index,
  render,
  children,
  rest,
}: {
  readonly index: number
  readonly render: RenderProp<MarqueeRenderState> | undefined
  readonly children: React.ReactNode
  readonly rest: Omit<PartProps<"div">, "render" | "children" | "ref">
}) {
  const ctx = useMarquee("Content")
  const el = useRef<HTMLDivElement | null>(null)
  useEffect(() => (el.current ? untabbable(el.current) : undefined), [])
  const props = mergeProps(normalizeProps(ctx.api.content(index)), rest, { ref: el })
  return renderPart("div", { ...props, children }, render, ctx.state)
}

function Content({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useMarquee("Content")
  const el = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (el.current?.querySelector("[id]")) {
      console.warn("[rind-ui] marquee: an element with an id is in the Content; copies repeat it")
    }
  }, [])
  // The consumer's id stays on the original only.
  const { id, ...shared } = rest
  const original = renderPart(
    "div",
    {
      ...mergeProps(normalizeProps(ctx.api.content(0)), rest, { ref: composeRefs(el, ref) }),
      children,
    },
    render,
    ctx.state,
  )
  return (
    <>
      {original}
      {Array.from({ length: ctx.copies - 1 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: copies are identical and positional.
        <Copy key={i + 1} index={i + 1} render={render} rest={shared}>
          {children}
        </Copy>
      ))}
    </>
  )
}

export const Marquee = { Root, PauseTrigger, Viewport, Content }
