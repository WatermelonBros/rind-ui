// Carousel parts (add-carousel): wiring only. The machine owns the page and autoplay; here the
// slides are counted through the item registry, a page change scrolls the Viewport to the
// page's first slide, and a user's scroll settles the page (our own scrolls are ignored).
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
  type PartProps,
  pageCount,
  partId,
  visibilityCapability,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    carousel: CarouselMessages
  }
}

/** A scroll with no `scrollend` (older engines) settles after this quiet time. */
const SETTLE_MS = 120

/** What every part's slot receives. */
export interface CarouselRenderState {
  /** The current page (0-based). */
  readonly page: number
  readonly pages: number
  readonly autoplay: "off" | "playing" | "paused"
}

type Api = ReturnType<typeof carouselConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => CarouselRenderState
  readonly send: (event: CarouselEvent) => void
  readonly registry: ItemRegistry
  readonly viewport: ShallowRef<HTMLElement | null>
  readonly orientation: () => "horizontal" | "vertical"
  readonly dir: () => "ltr" | "rtl"
  readonly onScroll: () => void
}

const CarouselKey: InjectionKey<Ctx> = Symbol("rind-ui.carousel")
function useCarousel(part: string): Ctx {
  const ctx = inject(CarouselKey, null)
  if (!ctx) throw new Error(`Carousel.${part} must be inside Carousel.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: CarouselRenderState) => VNodeChild }>

/** The scroll position that puts `slide` at the Viewport's snap start. */
function startOf(viewport: HTMLElement, slide: Element, vertical: boolean, rtl: boolean) {
  const v = viewport.getBoundingClientRect()
  const s = slide.getBoundingClientRect()
  if (vertical) return s.top - v.top + viewport.scrollTop
  return (rtl ? s.right - v.right : s.left - v.left) + viewport.scrollLeft
}

/** A named region over a scroll-snap Viewport of slides grouped into pages. */
const Root = defineComponent({
  name: "CarouselRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Controlled page, 0-based (`v-model:page`). */
    page: { type: Number, default: undefined },
    /** Uncontrolled page. Default 0. */
    defaultPage: { type: Number, default: undefined },
    /** Slides before they register (server-rendered indicators). */
    slideCount: { type: Number, default: undefined },
    /** Slides shown at once. Default 1. */
    slidesPerPage: { type: Number, default: 1 },
    /** Slides a step moves: `"page"` (default) or a number. */
    slidesPerMove: { type: [String, Number] as PropType<"page" | number>, default: "page" },
    /** Next on the last page goes to the first. */
    loop: Boolean,
    /** The scroll axis. Default horizontal. */
    orientation: {
      type: String as PropType<"horizontal" | "vertical">,
      default: "horizontal",
    },
    /** The gap between slides (`--rind-carousel-spacing`). Default "0px". */
    spacing: { type: String, default: "0px" },
    /** Advance by itself; needs an AutoplayTrigger. */
    autoplay: Boolean,
    /** Ms per page. Default 5000. */
    autoplayDelay: { type: Number, default: undefined },
    /** Pause while the pointer is over it. Default true. */
    pauseOnHover: { type: Boolean, default: undefined },
    /** Default: the provider's direction (which way is next for the indicators' arrows). */
    dir: String as PropType<"ltr" | "rtl">,
    /** Overrides the strings (also through the provider). */
    messages: Object as PropType<MessageOverrides<CarouselMessages>>,
  },
  emits: {
    /** Every change; `details.event.reason` says how. */
    pageChange: (_page: number, _details: ChangeDetails<CarouselEvent>) => true,
    "update:page": (_page: number) => true,
    /** Started or stopped. */
    autoplayChange: (_playing: boolean, _details: { readonly reason: AutoplayReason }) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability, visibilityCapability)
    const messages = useMessages("carousel", carouselMessages, () => props.messages)
    const loc = useLocale(
      () => undefined,
      () => props.dir,
    )
    const viewport = shallowRef<HTMLElement | null>(null)
    const vertical = () => props.orientation === "vertical"
    let layout: CarouselLayout = { slides: 0 }
    const slideEl = (index: number) =>
      viewport.value?.querySelector(
        `[data-scope="carousel"][data-part="slide"][data-instance="${instance()}"][data-index="${index}"]`,
      ) ?? null
    /** The page our own scrollToPage is heading to: its scroll events are not the user's. */
    let pending: number | null = null
    const machineEnv = {
      ...env,
      scrollToPage: (p: number, smooth: boolean) => {
        const el = viewport.value
        const slide = slideEl(firstSlideOf(layout, p))
        if (!el || !slide) return
        const at = startOf(el, slide, vertical(), loc.value.dir === "rtl")
        if (Math.abs(at - (vertical() ? el.scrollTop : el.scrollLeft)) < 1) return
        pending = p
        el.scrollTo({ [vertical() ? "top" : "left"]: at, behavior: smooth ? "smooth" : "auto" })
      },
    }
    const machineProps = () => ({
      id: instance(),
      page: props.page,
      defaultPage: props.defaultPage,
      onPageChange: (p: number, d: ChangeDetails<CarouselEvent>) => {
        emit("pageChange", p, d)
        emit("update:page", p)
      },
      slideCount: props.slideCount,
      slidesPerPage: props.slidesPerPage,
      slidesPerMove: props.slidesPerMove,
      loop: props.loop,
      autoplay: props.autoplay,
      autoplayDelay: props.autoplayDelay,
      pauseOnHover: props.pauseOnHover,
      onAutoplayChange: (playing: boolean, d: { readonly reason: AutoplayReason }) =>
        emit("autoplayChange", playing, d),
      messages: messages.value,
      lang: loc.value.locale,
    })
    const { view, send } = useMachine(carouselMachine, machineProps, machineEnv)
    const registry = createItemRegistry((items) => send({ type: "COUNT", slides: items.length }))
    // After the slides' own mount/update hooks: the count arrives in the same tick.
    onMounted(() => registry.flush())
    onUpdated(() => registry.flush())
    const pages = () => {
      layout = {
        slides: view.value.context.slides,
        perPage: props.slidesPerPage,
        perMove: props.slidesPerMove,
      }
      return pageCount(layout)
    }
    const api = computed(() => {
      const total = pages()
      return carouselConnect(
        {
          instance: instance(),
          state: view.value.state as CarouselState,
          page: clampPage(view.value.values.page ?? 0, total),
          pages: total,
          slides: view.value.context.slides,
          slidesPerPage: props.slidesPerPage,
          slidesPerMove: props.slidesPerMove,
          loop: props.loop,
          orientation: props.orientation,
          spacing: props.spacing,
          delay: props.autoplayDelay ?? 5000,
          scrolling: view.value.context.scrolling,
          messages: messages.value,
          ariaLabel: attrs["aria-label"] as string | undefined,
          ariaLabelledBy: attrs["aria-labelledby"] as string | undefined,
          ids: {
            viewport: partId("carousel", instance(), "viewport"),
            slide: (i) => partId("carousel", instance(), `slide-${i}`),
          },
        },
        env,
      )
    })
    // A scroll the user made: START once, then END at the nearest page when it settles.
    let timer: unknown = null
    let started = false
    const onSettled = () => {
      if (timer !== null) env.scheduler.clearTimeout(timer as never)
      timer = null
      const el = viewport.value
      if (!el) return
      const pos = vertical() ? el.scrollTop : el.scrollLeft
      let nearest = 0
      let best = Number.POSITIVE_INFINITY
      for (let p = 0; p < pageCount(layout); p++) {
        const slide = slideEl(firstSlideOf(layout, p))
        if (!slide) continue
        const d = Math.abs(startOf(el, slide, vertical(), loc.value.dir === "rtl") - pos)
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
      if (timer !== null) env.scheduler.clearTimeout(timer as never)
      timer = env.scheduler.setTimeout(onSettled, SETTLE_MS)
    }
    watch(
      viewport,
      (el, _old, onCleanup) => {
        if (!el) return
        el.addEventListener("scrollend", onSettled)
        onCleanup(() => el.removeEventListener("scrollend", onSettled))
      },
      { flush: "post" },
    )
    onBeforeUnmount(() => {
      if (timer !== null) env.scheduler.clearTimeout(timer as never)
    })
    const state = (): CarouselRenderState => ({
      page: api.value.page,
      pages: api.value.pages,
      autoplay: view.value.state === "stopped" ? "off" : (view.value.state as "playing" | "paused"),
    })
    provide(CarouselKey, {
      api: () => api.value,
      state,
      send,
      registry,
      viewport,
      orientation: () => props.orientation,
      dir: () => loc.value.dir,
      onScroll,
    })
    return () => {
      const { "aria-label": _l, "aria-labelledby": _lb, ...rest } = attrs
      void [_l, _lb]
      return renderPart(
        "section",
        mergeProps(
          joinHandlers(normalizeProps(api.value.root()), {
            onPointerenter: (e: PointerEvent) => {
              if (e.pointerType === "mouse") send({ type: "HOLD", hold: "hover" })
            },
            onPointerleave: (e: PointerEvent) => {
              if (e.pointerType === "mouse") send({ type: "RELEASE", hold: "hover" })
            },
            // Focus arriving from outside: a reader tabbed in, autoplay stops for good. Not on
            // the AutoplayTrigger: its press toggles, and a stop first would make it restart.
            onFocusin: (e: FocusEvent) => {
              const root = e.currentTarget as Element
              const from = e.relatedTarget
              if (from instanceof Node && root.contains(from)) return
              if (e.target instanceof Element && e.target.closest('[data-part="autoplay-trigger"]'))
                return
              send({ type: "STOP", reason: "focus" })
            },
          }),
          rest,
        ),
        slots.default?.(state()),
        props.asChild,
      )
    }
  },
})

/** The scroll-snap container; scrolling natively settles the page. */
const Viewport = defineComponent({
  name: "CarouselViewport",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCarousel("Viewport")
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(ctx.api().viewport()), { onScroll: ctx.onScroll }),
            ref: refTo(ctx.viewport),
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** A group named "2 of 6"; off the current page it is inert. */
const Slide = defineComponent({
  name: "CarouselSlide",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The slide's position (0-based). */
    index: { type: Number, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCarousel("Slide")
    const el = shallowRef<Element | null>(null)
    let off: (() => void) | null = null
    const register = () => {
      off?.()
      off = el.value
        ? ctx.registry.register({
            key: String(props.index),
            textValue: String(props.index),
            element: el.value,
          })
        : null
    }
    onMounted(register)
    watch(() => props.index, register)
    onBeforeUnmount(() => off?.())
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().slide(props.index)), ref: refTo(el) }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** Lays out the triggers. */
const Control = defineComponent({
  name: "CarouselControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCarousel("Control")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().control()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return { focused, modality }
}

function useTag() {
  const el = shallowRef<Element | null>(null)
  const measured = shallowRef<string | null>(null)
  const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
  onMounted(measure)
  onUpdated(measure)
  return { el, measured }
}

type ButtonInput = Parameters<Api["prevTrigger"]>[0]

function trigger(
  name: "PrevTrigger" | "NextTrigger" | "AutoplayTrigger",
  own: (api: Api, b: ButtonInput) => PartProps,
  event: CarouselEvent,
) {
  return defineComponent({
    name: `Carousel${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useCarousel(name)
      const { focused, modality } = useFocus()
      const { el, measured } = useTag()
      return () => {
        const children = slots.default?.(ctx.state())
        const tag = renderedTag("button", children, props.asChild, measured.value)
        const api = normalizeProps(
          own(ctx.api(), { tag, focused: focused.value, modality: modality.value }),
        )
        const disabled = api["aria-disabled"] === "true"
        return renderPart(
          "button",
          mergeProps(
            {
              ...joinHandlers(api, {
                // At an end without loop the button stays focusable and does nothing.
                onClick: () => {
                  if (!disabled) ctx.send(event)
                },
                onFocusin: () => (focused.value = true),
                onFocusout: () => (focused.value = false),
              }),
              ref: refTo(el),
            },
            attrs,
          ),
          children,
          props.asChild,
        )
      }
    },
  })
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

/** A tablist of pages: one tab stop, arrows move and select. The slot receives `{ pages }`. */
const IndicatorGroup = defineComponent({
  name: "CarouselIndicatorGroup",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCarousel("IndicatorGroup")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().indicatorGroup()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** One page (`index`). */
const Indicator = defineComponent({
  name: "CarouselIndicator",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The page (0-based). */
    index: { type: Number, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCarousel("Indicator")
    const env = useEnvironment()
    const { focused, modality } = useFocus()
    const { el, measured } = useTag()
    return () => {
      const children = slots.default?.(ctx.state())
      const tag = renderedTag("button", children, props.asChild, measured.value)
      return renderPart(
        "button",
        mergeProps(
          {
            ...joinHandlers(
              normalizeProps(
                ctx.api().indicator(props.index, {
                  tag,
                  focused: focused.value,
                  modality: modality.value,
                }),
              ),
              {
                onClick: () => ctx.send({ type: "GO", page: props.index, reason: "indicator" }),
                onKeydown: (e: KeyboardEvent) => {
                  const s = ctx.state()
                  const event = carouselIndicatorKeyEvent(describeKey(e, env), {
                    page: s.page,
                    pages: s.pages,
                    orientation: ctx.orientation(),
                    dir: ctx.dir(),
                  })
                  if (event?.type !== "GO") return
                  e.preventDefault()
                  ctx.send(event)
                  // The roving tab stop follows the selection.
                  const group = (e.currentTarget as Element).closest(
                    '[data-part="indicator-group"]',
                  )
                  group
                    ?.querySelector<HTMLElement>(
                      `[data-part="indicator"][data-index="${event.page}"]`,
                    )
                    ?.focus()
                },
                onFocusin: () => (focused.value = true),
                onFocusout: () => (focused.value = false),
              },
            ),
            ref: refTo(el),
          },
          attrs,
        ),
        children,
        props.asChild,
      )
    }
  },
})

/** "3 / 6" (hidden from assistive technology). */
const Status = defineComponent({
  name: "CarouselStatus",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCarousel("Status")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().status()), attrs),
        slots.default?.(ctx.state()) ?? ctx.api().statusText,
        props.asChild,
      )
  },
})

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
