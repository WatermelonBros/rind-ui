"use client"

// Carousel (add-carousel): a named region over a scroll-snap Viewport. The machine owns the page
// and autoplay; here the slides are counted through the item registry, a page change scrolls
// the Viewport to the page's first slide, and a user's scroll settles the page (our own
// scrolls are ignored until they arrive).

import {
  type AutoplayReason,
  announcerCapability,
  type CarouselEvent,
  type CarouselLayout,
  type CarouselMessages,
  type CarouselState,
  type ChangeDetails,
  carouselConnect,
  carouselIndicatorKeyEvent,
  carouselMachine,
  carouselMessages,
  clampPage,
  createItemRegistry,
  describeKey,
  firstSlideOf,
  type ItemRegistry,
  type MessageOverrides,
  pageCount,
  partId,
  visibilityCapability,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    carousel: CarouselMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** A scroll with no `scrollend` (older engines) settles after this quiet time. */
const SETTLE_MS = 120

/** What every part's `render` receives. */
export interface CarouselRenderState {
  /** The current page (0-based). */
  readonly page: number
  readonly pages: number
  readonly autoplay: "off" | "playing" | "paused"
}

type Api = ReturnType<typeof carouselConnect>

interface Ctx {
  readonly api: Api
  readonly state: CarouselRenderState
  readonly send: (event: CarouselEvent) => void
  readonly registry: ItemRegistry
  readonly viewport: { current: HTMLElement | null }
  readonly root: { current: HTMLElement | null }
  readonly orientation: "horizontal" | "vertical"
  readonly dir: "ltr" | "rtl"
  readonly onScroll: () => void
}
const CarouselContext = createContext<Ctx | null>(null)
function useCarousel(part: string): Ctx {
  const ctx = useContext(CarouselContext)
  if (!ctx) throw new Error(`Carousel.${part} must be inside Carousel.Root`)
  return ctx
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the carousel's state. */
  readonly render?: RenderProp<CarouselRenderState>
}

export type CarouselRootProps = PartProps<"section"> & {
  /** Controlled page (0-based). */
  readonly page?: number
  /** Uncontrolled page. Default 0. */
  readonly defaultPage?: number
  /** Every change; `details.event.reason` says how. */
  readonly onPageChange?: (page: number, details: ChangeDetails<CarouselEvent>) => void
  /** Slides before they register (server-rendered indicators). */
  readonly slideCount?: number
  /** Slides shown at once. Default 1. */
  readonly slidesPerPage?: number
  /** Slides a step moves: `"page"` (default) or a number. */
  readonly slidesPerMove?: "page" | number
  /** Next on the last page goes to the first. */
  readonly loop?: boolean
  /** The scroll axis. Default horizontal. */
  readonly orientation?: "horizontal" | "vertical"
  /** The gap between slides (`--rind-carousel-spacing`). Default "0px". */
  readonly spacing?: string
  /** Advance by itself; needs an AutoplayTrigger. */
  readonly autoplay?: boolean
  /** Ms per page. Default 5000. */
  readonly autoplayDelay?: number
  /** Pause while the pointer is over it. Default true. */
  readonly pauseOnHover?: boolean
  /** Started or stopped. */
  readonly onAutoplayChange?: (
    playing: boolean,
    details: { readonly reason: AutoplayReason },
  ) => void
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<CarouselMessages>
  /** Default: the provider's direction (which way is next for the indicators' arrows). */
  readonly dir?: "ltr" | "rtl"
}

/** The scroll position that puts `slide` at the Viewport's snap start. */
function startOf(viewport: HTMLElement, slide: Element, vertical: boolean, rtl: boolean) {
  const v = viewport.getBoundingClientRect()
  const s = slide.getBoundingClientRect()
  if (vertical) return s.top - v.top + viewport.scrollTop
  return (rtl ? s.right - v.right : s.left - v.left) + viewport.scrollLeft
}

function Root({
  page,
  defaultPage,
  onPageChange,
  slideCount,
  slidesPerPage = 1,
  slidesPerMove = "page",
  loop = false,
  orientation = "horizontal",
  spacing = "0px",
  autoplay,
  autoplayDelay,
  pauseOnHover,
  onAutoplayChange,
  messages: ownMessages,
  dir: ownDir,
  render,
  id,
  ref,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: CarouselRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability, visibilityCapability)
  const messages = useMessages("carousel", carouselMessages, ownMessages)
  const { locale, dir } = useLocale(undefined, ownDir)
  const viewport = useRef<HTMLElement | null>(null)
  const root = useRef<HTMLElement | null>(null)
  const vertical = orientation === "vertical"
  const layoutRef = useRef<CarouselLayout>({ slides: 0 })
  const slideEl = (index: number) =>
    viewport.current?.querySelector(
      `[data-scope="carousel"][data-part="slide"][data-instance="${instance}"][data-index="${index}"]`,
    ) ?? null
  /** The page our own scrollToPage is heading to: its scroll events are not the user's. */
  const pending = useRef<number | null>(null)
  const scrollRef = useRef((p: number, smooth: boolean) => {
    void p
    void smooth
  })
  scrollRef.current = (p, smooth) => {
    const el = viewport.current
    const slide = slideEl(firstSlideOf(layoutRef.current, p))
    if (!el || !slide) return
    const at = startOf(el, slide, vertical, dir === "rtl")
    if (Math.abs(at - (vertical ? el.scrollTop : el.scrollLeft)) < 1) return
    pending.current = p
    el.scrollTo({ [vertical ? "top" : "left"]: at, behavior: smooth ? "smooth" : "auto" })
  }
  const [machineEnv] = useState(() => ({
    ...env,
    scrollToPage: (p: number, smooth: boolean) => scrollRef.current(p, smooth),
  }))
  const machineProps = {
    id: instance,
    page,
    defaultPage,
    onPageChange,
    slideCount,
    slidesPerPage,
    slidesPerMove,
    loop,
    autoplay,
    autoplayDelay,
    pauseOnHover,
    onAutoplayChange,
    messages,
    lang: locale,
  }
  const { view, send } = useMachine(carouselMachine, machineProps, machineEnv)
  const slides = view.context.slides
  const layout: CarouselLayout = { slides, perPage: slidesPerPage, perMove: slidesPerMove }
  layoutRef.current = layout
  const pages = pageCount(layout)
  const current = clampPage(view.values.page ?? 0, pages)
  const [registry] = useState(() =>
    createItemRegistry((items) => send({ type: "COUNT", slides: items.length })),
  )
  useIsoLayoutEffect(() => registry.flush())
  const api = carouselConnect(
    {
      instance,
      state: view.state as CarouselState,
      page: current,
      pages,
      slides,
      slidesPerPage,
      slidesPerMove,
      loop,
      orientation,
      spacing,
      delay: autoplayDelay ?? 5000,
      scrolling: view.context.scrolling,
      messages,
      ariaLabel,
      ariaLabelledBy,
      ids: {
        viewport: partId("carousel", instance, "viewport"),
        slide: (i) => partId("carousel", instance, `slide-${i}`),
      },
    },
    env,
  )
  // A scroll the user made: START once, then END at the nearest page when it settles.
  const settle = useRef<{ timer: unknown; started: boolean }>({
    timer: null,
    started: false,
  })
  const onSettled = () => {
    const s = settle.current
    if (s.timer !== null) env.scheduler.clearTimeout(s.timer)
    s.timer = null
    const el = viewport.current
    if (!el) return
    const pos = vertical ? el.scrollTop : el.scrollLeft
    let nearest = 0
    let best = Number.POSITIVE_INFINITY
    for (let p = 0; p < pageCount(layoutRef.current); p++) {
      const slide = slideEl(firstSlideOf(layoutRef.current, p))
      if (!slide) continue
      const d = Math.abs(startOf(el, slide, vertical, dir === "rtl") - pos)
      if (d < best) {
        best = d
        nearest = p
      }
    }
    const ours = pending.current
    pending.current = null
    // Our own scroll arrived where it was sent: nothing to report.
    if (ours === nearest && !s.started) return
    s.started = false
    send({ type: "SCROLL.END", page: nearest })
  }
  const onScroll = () => {
    const s = settle.current
    if (pending.current === null && !s.started) {
      s.started = true
      send({ type: "SCROLL.START" })
    }
    if (s.timer !== null) env.scheduler.clearTimeout(s.timer)
    s.timer = env.scheduler.setTimeout(onSettled, SETTLE_MS)
  }
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const end = () => settledRef.current()
    el.addEventListener("scrollend", end)
    return () => {
      el.removeEventListener("scrollend", end)
      const t = settle.current.timer
      if (t !== null) env.scheduler.clearTimeout(t)
    }
  }, [env])
  const state: CarouselRenderState = {
    page: current,
    pages,
    autoplay: view.state === "stopped" ? "off" : (view.state as "playing" | "paused"),
  }
  const ctx: Ctx = {
    api,
    state,
    send,
    registry,
    viewport,
    root,
    orientation,
    dir,
    onScroll,
  }
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(api.root()), {
        onPointerEnter: (e: { pointerType: string }) => {
          if (e.pointerType === "mouse") send({ type: "HOLD", hold: "hover" })
        },
        onPointerLeave: (e: { pointerType: string }) => {
          if (e.pointerType === "mouse") send({ type: "RELEASE", hold: "hover" })
        },
        // Focus arriving from outside: a reader tabbed in, autoplay stops for good. Not on the
        // AutoplayTrigger: its press toggles, and a stop first would make that press restart it.
        onFocus: (e: FocusEvent<HTMLElement>) => {
          const from = e.relatedTarget
          if (from instanceof Node && e.currentTarget.contains(from)) return
          if (e.target instanceof Element && e.target.closest('[data-part="autoplay-trigger"]'))
            return
          send({ type: "STOP", reason: "focus" })
        },
      }),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(root, ref),
    },
    rest,
  )
  return (
    <CarouselContext value={ctx}>
      {renderPart("section", { ...props, children }, render, state)}
    </CarouselContext>
  )
}

/** The scroll-snap container; scrolling natively settles the page. */
function Viewport({ render, ref, ...rest }: PartProps<"div">) {
  const ctx = useCarousel("Viewport")
  return renderPart(
    "div",
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api.viewport()), { onScroll: ctx.onScroll }),
        ref: composeRefs(ctx.viewport, ref),
      },
      rest,
    ),
    render,
    ctx.state,
  )
}

export type CarouselSlideProps = PartProps<"div"> & {
  /** The slide's position (0-based). */
  readonly index: number
}

/** A group named "2 of 6"; off the current page it is inert. */
function Slide({ index, render, ref, ...rest }: CarouselSlideProps) {
  const ctx = useCarousel("Slide")
  const el = useRef<HTMLElement | null>(null)
  const { registry } = ctx
  useIsoLayoutEffect(() => {
    const node = el.current
    if (!node) return
    return registry.register({ key: String(index), textValue: String(index), element: node })
  }, [registry, index])
  return renderPart(
    "div",
    mergeProps({ ...normalizeProps(ctx.api.slide(index)), ref: composeRefs(el, ref) }, rest),
    render,
    ctx.state,
  )
}

/** Lays out the triggers. */
function Control({ render, ...rest }: PartProps<"div">) {
  const ctx = useCarousel("Control")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.control()), rest), render, ctx.state)
}

/** Focus state with the modality it arrived by. */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return { focused, setFocused, modality }
}

function trigger(
  part: "PrevTrigger" | "NextTrigger" | "AutoplayTrigger",
  props: (api: Api, b: Parameters<Api["prevTrigger"]>[0]) => ReturnType<Api["prevTrigger"]>,
  event: CarouselEvent,
) {
  return function CarouselTrigger({ render, ref, ...rest }: PartProps<"button">) {
    const ctx = useCarousel(part)
    const el = useRef<HTMLElement | null>(null)
    const tag = useRenderedTag("button", render, el)
    const { focused, setFocused, modality } = useFocus()
    const own = normalizeProps(props(ctx.api, { tag, focused, modality }))
    const disabled = own["aria-disabled"] === "true"
    return renderPart(
      "button",
      mergeProps(
        {
          ...joinHandlers(own, {
            // At an end without loop the button stays focusable (aria-disabled) and does nothing.
            onClick: () => {
              if (!disabled) ctx.send(event)
            },
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
          }),
          ref: composeRefs(el, ref),
        },
        rest,
      ),
      render,
      ctx.state,
    )
  }
}

/** The previous page. */
const PrevTrigger = trigger("PrevTrigger", (api, b) => api.prevTrigger(b), {
  type: "PREV",
  reason: "trigger",
})
/** The next page. */
const NextTrigger = trigger("NextTrigger", (api, b) => api.nextTrigger(b), {
  type: "NEXT",
  reason: "trigger",
})
/** Stops and starts autoplay; named by what it does. */
const AutoplayTrigger = trigger("AutoplayTrigger", (api, b) => api.autoplayTrigger(b), {
  type: "TOGGLE",
})

export type CarouselIndicatorGroupProps = Omit<PartProps<"div">, "children"> & {
  /** The indicators, or a function of the state rendering one per page. */
  readonly children?: ReactNode | ((state: CarouselRenderState) => ReactNode)
}

/** A tablist of pages: one tab stop, arrows move and select. */
function IndicatorGroup({ render, children, ...rest }: CarouselIndicatorGroupProps) {
  const ctx = useCarousel("IndicatorGroup")
  const props = mergeProps(normalizeProps(ctx.api.indicatorGroup()), rest)
  return renderPart(
    "div",
    { ...props, children: typeof children === "function" ? children(ctx.state) : children },
    render,
    ctx.state,
  )
}

export type CarouselIndicatorProps = PartProps<"button"> & {
  /** The page (0-based). */
  readonly index: number
}

/** One page (`index`). */
function Indicator({ index, render, ref, ...rest }: CarouselIndicatorProps) {
  const ctx = useCarousel("Indicator")
  const env = useEnvironment()
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const { focused, setFocused, modality } = useFocus()
  const own = normalizeProps(ctx.api.indicator(index, { tag, focused, modality }))
  return renderPart(
    "button",
    mergeProps(
      {
        ...joinHandlers(own, {
          onClick: () => ctx.send({ type: "GO", page: index, reason: "indicator" }),
          onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
            const event = carouselIndicatorKeyEvent(describeKey(e.nativeEvent, env), {
              page: ctx.state.page,
              pages: ctx.state.pages,
              orientation: ctx.orientation,
              dir: ctx.dir,
            })
            if (event?.type !== "GO") return
            e.preventDefault()
            ctx.send(event)
            // The roving tab stop follows the selection.
            const group = e.currentTarget.closest('[data-part="indicator-group"]')
            group
              ?.querySelector<HTMLElement>(`[data-part="indicator"][data-index="${event.page}"]`)
              ?.focus()
          },
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        }),
        ref: composeRefs(el, ref),
      },
      rest,
    ),
    render,
    ctx.state,
  )
}

/** "3 / 6" (hidden from assistive technology). */
function Status({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useCarousel("Status")
  const props = mergeProps(normalizeProps(ctx.api.status()), rest)
  return renderPart(
    "span",
    { ...props, children: children ?? ctx.api.statusText },
    render,
    ctx.state,
  )
}

/** The parts, by name: `carousel.parts.ts` re-exports them as the `Carousel` namespace. */
export {
  AutoplayTrigger,
  Control,
  Indicator,
  IndicatorGroup,
  NextTrigger,
  PrevTrigger,
  Root,
  Slide,
  Status,
  Viewport,
}
