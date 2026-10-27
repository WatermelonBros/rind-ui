/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    carousel: CarouselMessages
  }
}

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
  readonly api: Accessor<Api>
  readonly state: CarouselRenderState
  readonly send: (event: CarouselEvent) => void
  readonly registry: ItemRegistry
  readonly setViewport: (el: HTMLElement | null) => void
  readonly orientation: Accessor<"horizontal" | "vertical">
  readonly dir: Accessor<"ltr" | "rtl">
  readonly onScroll: () => void
}
const CarouselContext = createContext<Ctx>()
function useCarousel(part: string): Ctx {
  const ctx = useContext(CarouselContext)
  if (!ctx) throw new Error(`Carousel.${part} must be inside Carousel.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the carousel's state. */
  readonly render?: RenderProp<CarouselRenderState> | undefined
  readonly children?: JSX.Element | ((state: CarouselRenderState) => JSX.Element)
}

export type CarouselRootProps = PartProps<JSX.HTMLAttributes<HTMLElement>> & {
  /** Controlled page (0-based). */
  readonly page?: number | undefined
  /** Uncontrolled page. Default 0. */
  readonly defaultPage?: number | undefined
  /** Every change; `details.event.reason` says how. */
  readonly onPageChange?:
    | ((page: number, details: ChangeDetails<CarouselEvent>) => void)
    | undefined
  /** Slides before they register (server-rendered indicators). */
  readonly slideCount?: number | undefined
  /** Slides shown at once. Default 1. */
  readonly slidesPerPage?: number | undefined
  /** Slides a step moves: `"page"` (default) or a number. */
  readonly slidesPerMove?: "page" | number | undefined
  /** Next on the last page goes to the first. */
  readonly loop?: boolean | undefined
  /** The scroll axis. Default horizontal. */
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** The gap between slides (`--rind-carousel-spacing`). Default "0px". */
  readonly spacing?: string | undefined
  /** Advance by itself; needs an AutoplayTrigger. */
  readonly autoplay?: boolean | undefined
  /** Ms per page. Default 5000. */
  readonly autoplayDelay?: number | undefined
  /** Pause while the pointer is over it. Default true. */
  readonly pauseOnHover?: boolean | undefined
  /** Started or stopped. */
  readonly onAutoplayChange?:
    | ((playing: boolean, details: { readonly reason: AutoplayReason }) => void)
    | undefined
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<CarouselMessages> | undefined
  /** Default: the provider's direction (which way is next for the indicators' arrows). */
  readonly dir?: "ltr" | "rtl" | undefined
}

/** The scroll position that puts `slide` at the Viewport's snap start. */
function startOf(viewport: HTMLElement, slide: Element, vertical: boolean, rtl: boolean) {
  const v = viewport.getBoundingClientRect()
  const s = slide.getBoundingClientRect()
  if (vertical) return s.top - v.top + viewport.scrollTop
  return (rtl ? s.right - v.right : s.left - v.left) + viewport.scrollLeft
}

function Root(props: CarouselRootProps) {
  const [own, rest] = splitProps(props, [
    "page",
    "defaultPage",
    "onPageChange",
    "slideCount",
    "slidesPerPage",
    "slidesPerMove",
    "loop",
    "orientation",
    "spacing",
    "autoplay",
    "autoplayDelay",
    "pauseOnHover",
    "onAutoplayChange",
    "messages",
    "dir",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability, visibilityCapability)
  const messages = useMessages("carousel", carouselMessages, () => own.messages)
  const loc = useLocale(
    () => undefined,
    () => own.dir,
  )
  const orientation = () => own.orientation ?? "horizontal"
  const vertical = () => orientation() === "vertical"
  const rtl = () => loc().dir === "rtl"
  let viewport: HTMLElement | null = null
  const slideEl = (index: number) =>
    viewport?.querySelector(
      `[data-scope="carousel"][data-part="slide"][data-instance="${untrack(instance)}"][data-index="${index}"]`,
    ) ?? null
  /** The page our own scrollToPage is heading to: its scroll events are not the user's. */
  let pending: number | null = null
  const machineProps = createMemo(() => ({
    id: instance(),
    page: own.page,
    defaultPage: own.defaultPage,
    onPageChange: own.onPageChange,
    slideCount: own.slideCount,
    slidesPerPage: own.slidesPerPage ?? 1,
    slidesPerMove: own.slidesPerMove ?? "page",
    loop: own.loop === true,
    autoplay: own.autoplay,
    autoplayDelay: own.autoplayDelay,
    pauseOnHover: own.pauseOnHover,
    onAutoplayChange: own.onAutoplayChange,
    messages: messages(),
    lang: loc().locale,
  }))
  const { view, send } = useMachine(carouselMachine, machineProps, {
    ...env,
    scrollToPage: (p: number, smooth: boolean) => {
      const el = viewport
      const slide = slideEl(firstSlideOf(untrack(layout), p))
      if (!el || !slide) return
      const v = untrack(vertical)
      const at = startOf(el, slide, v, untrack(rtl))
      if (Math.abs(at - (v ? el.scrollTop : el.scrollLeft)) < 1) return
      pending = p
      el.scrollTo({ [v ? "top" : "left"]: at, behavior: smooth ? "smooth" : "auto" })
    },
  })
  const layout = createMemo<CarouselLayout>(() => ({
    slides: view().context.slides,
    perPage: own.slidesPerPage ?? 1,
    perMove: own.slidesPerMove ?? "page",
  }))
  const pages = createMemo(() => pageCount(layout()))
  const current = createMemo(() => clampPage(view().values.page ?? 0, pages()))
  const registry = createItemRegistry((items) => send({ type: "COUNT", slides: items.length }))
  const api = createMemo(() =>
    carouselConnect(
      {
        instance: instance(),
        state: view().state as CarouselState,
        page: current(),
        pages: pages(),
        slides: view().context.slides,
        slidesPerPage: own.slidesPerPage ?? 1,
        slidesPerMove: own.slidesPerMove ?? "page",
        loop: own.loop === true,
        orientation: orientation(),
        spacing: own.spacing ?? "0px",
        delay: own.autoplayDelay ?? 5000,
        scrolling: view().context.scrolling,
        messages: messages(),
        ariaLabel: rest["aria-label"],
        ariaLabelledBy: rest["aria-labelledby"],
        ids: {
          viewport: partId("carousel", instance(), "viewport"),
          slide: (i) => partId("carousel", instance(), `slide-${i}`),
        },
      },
      env,
    ),
  )
  // A scroll the user made: START once, then END at the nearest page when it settles.
  let timer: unknown = null
  let started = false
  const onSettled = () => {
    if (timer !== null) env.scheduler.clearTimeout(timer)
    timer = null
    const el = viewport
    if (!el) return
    const v = untrack(vertical)
    const pos = v ? el.scrollTop : el.scrollLeft
    let nearest = 0
    let best = Number.POSITIVE_INFINITY
    const l = untrack(layout)
    for (let p = 0; p < pageCount(l); p++) {
      const slide = slideEl(firstSlideOf(l, p))
      if (!slide) continue
      const d = Math.abs(startOf(el, slide, v, untrack(rtl)) - pos)
      if (d < best) {
        best = d
        nearest = p
      }
    }
    const ours = pending
    pending = null
    // Our own scroll arrived where it was sent: nothing to report.
    if (ours === nearest && !started) return
    started = false
    send({ type: "SCROLL.END", page: nearest })
  }
  const onScroll = () => {
    if (pending === null && !started) {
      started = true
      send({ type: "SCROLL.START" })
    }
    if (timer !== null) env.scheduler.clearTimeout(timer)
    timer = env.scheduler.setTimeout(onSettled, SETTLE_MS)
  }
  afterMount(() => {
    const el = viewport
    if (el) {
      el.addEventListener("scrollend", onSettled)
      onCleanup(() => el.removeEventListener("scrollend", onSettled))
    }
    onCleanup(() => {
      if (timer !== null) env.scheduler.clearTimeout(timer)
    })
  })
  const state = reactive<CarouselRenderState>(() => ({
    page: current(),
    pages: pages(),
    autoplay: view().state === "stopped" ? "off" : (view().state as "playing" | "paused"),
  }))
  const ctx: Ctx = {
    api,
    state,
    send,
    registry,
    setViewport: (el) => {
      viewport = el
    },
    orientation,
    dir: () => loc().dir,
    onScroll,
  }
  const merged = createMemo(() => {
    // The name is the region's own (connect puts aria-label/labelledby on the Root).
    const { "aria-label": _l, "aria-labelledby": _lb, ...attrs } = rest as Record<string, unknown>
    return mergeProps(
      joinHandlers(normalizeProps(api().root()), {
        onPointerEnter: (e: PointerEvent) => {
          if (e.pointerType === "mouse") send({ type: "HOLD", hold: "hover" })
        },
        onPointerLeave: (e: PointerEvent) => {
          if (e.pointerType === "mouse") send({ type: "RELEASE", hold: "hover" })
        },
        // Focus arriving from outside: a reader tabbed in, autoplay stops for good. Not on the
        // AutoplayTrigger: its press toggles, and a stop first would make that press restart it.
        onFocusIn: (e: FocusEvent) => {
          const from = e.relatedTarget
          if (from instanceof Node && (e.currentTarget as Element).contains(from)) return
          if (e.target instanceof Element && e.target.closest('[data-part="autoplay-trigger"]'))
            return
          send({ type: "STOP", reason: "focus" })
        },
      }),
      attrs,
    )
  })
  const children = () => resolveChildren(own.children, state)
  return (
    <CarouselContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <section {...p}>{children()}</section>
      ))}
    </CarouselContext.Provider>
  )
}

type DivProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** The scroll-snap container; scrolling natively settles the page. */
function Viewport(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCarousel("Viewport")
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().viewport()), { onScroll: ctx.onScroll }),
        ref: ctx.setViewport,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type CarouselSlideProps = DivProps & {
  /** The slide's position (0-based). */
  readonly index: number
}

/** A group named "2 of 6"; off the current page it is inert. */
function Slide(props: CarouselSlideProps) {
  const [local, rest] = splitProps(props, ["index", "render", "children"])
  const ctx = useCarousel("Slide")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  afterMount(() => {
    const node = el()
    if (!node) return
    onCleanup(
      ctx.registry.register({
        key: String(local.index),
        textValue: String(local.index),
        element: node,
      }),
    )
  })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().slide(local.index)), ref: setEl }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Lays out the triggers. */
function Control(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCarousel("Control")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().control()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Focus state with the modality it arrived by. */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return { focused, setFocused, modality }
}

type ButtonProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>
type ButtonInput = Parameters<Api["prevTrigger"]>[0]

function trigger(
  part: "PrevTrigger" | "NextTrigger" | "AutoplayTrigger",
  partProps: (api: Api, b: ButtonInput) => ReturnType<Api["prevTrigger"]>,
  event: CarouselEvent,
) {
  return function CarouselTrigger(props: ButtonProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useCarousel(part)
    const [el, setEl] = createSignal<Element | null>(null)
    const tag = useRenderedTag(
      () => "button",
      () => local.render,
      el,
    )
    const { focused, setFocused, modality } = useFocus()
    const merged = createMemo(() => {
      const own = normalizeProps(
        partProps(ctx.api(), { tag: tag(), focused: focused(), modality: modality() }),
      )
      const disabled = own["aria-disabled"] === "true"
      return mergeProps(
        {
          ...joinHandlers(own, {
            // At an end without loop the button stays focusable (aria-disabled) and does nothing.
            onClick: () => {
              if (!disabled) ctx.send(event)
            },
            onFocusIn: () => setFocused(true),
            onFocusOut: () => setFocused(false),
          }),
          ref: setEl,
        },
        rest,
      )
    })
    const children = () => resolveChildren(local.children, ctx.state)
    return renderPart(local.render, merged, ctx.state, children, (p) => (
      <button {...p}>{children()}</button>
    ))
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

export type CarouselIndicatorGroupProps = DivProps

/** A tablist of pages: one tab stop, arrows move and select. Children may be a function of the
 * state, rendering one Indicator per page. */
function IndicatorGroup(props: CarouselIndicatorGroupProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCarousel("IndicatorGroup")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().indicatorGroup()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type CarouselIndicatorProps = ButtonProps & {
  /** The page (0-based). */
  readonly index: number
}

/** One page (`index`). */
function Indicator(props: CarouselIndicatorProps) {
  const [local, rest] = splitProps(props, ["index", "render", "children"])
  const ctx = useCarousel("Indicator")
  const env = useEnvironment()
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = useRenderedTag(
    () => "button",
    () => local.render,
    el,
  )
  const { focused, setFocused, modality } = useFocus()
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx
              .api()
              .indicator(local.index, { tag: tag(), focused: focused(), modality: modality() }),
          ),
          {
            onClick: () => ctx.send({ type: "GO", page: local.index, reason: "indicator" }),
            onKeyDown: (e: KeyboardEvent) => {
              const event = carouselIndicatorKeyEvent(describeKey(e, env), {
                page: ctx.state.page,
                pages: ctx.state.pages,
                orientation: ctx.orientation(),
                dir: ctx.dir(),
              })
              if (event?.type !== "GO") return
              e.preventDefault()
              ctx.send(event)
              // The roving tab stop follows the selection.
              const group = (e.currentTarget as Element).closest('[data-part="indicator-group"]')
              group
                ?.querySelector<HTMLElement>(`[data-part="indicator"][data-index="${event.page}"]`)
                ?.focus()
            },
            onFocusIn: () => setFocused(true),
            onFocusOut: () => setFocused(false),
          },
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type CarouselStatusProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

/** "3 / 6" (hidden from assistive technology). */
function Status(props: CarouselStatusProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCarousel("Status")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().status()), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.api().statusText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
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
