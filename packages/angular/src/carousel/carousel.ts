// Carousel (add-carousel): a named region over a scroll-snap Viewport. The machine owns the page
// and autoplay; here the slides are counted through the item registry, a page change scrolls
// the Viewport to the page's first slide, and a user's scroll settles the page (our own
// scrolls are ignored until they arrive).
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
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
  type Modality,
  pageCount,
  partId,
  visibilityCapability,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

/** A scroll with no `scrollend` (older engines) settles after this quiet time. */
const SETTLE_MS = 120

/** The carousel's state, for the template (`#c="rindCarouselRoot"`, `c.state()`). */
export interface CarouselRenderState {
  /** The current page (0-based). */
  readonly page: number
  readonly pages: number
  readonly autoplay: "off" | "playing" | "paused"
}

const CAROUSEL = new InjectionToken<CarouselRoot>("rind-ui.carousel")

function injectCarousel(part: string): CarouselRoot {
  const root = inject(CAROUSEL, { optional: true })
  if (!root) throw new Error(`rindCarousel${part} must be inside rindCarouselRoot`)
  return root
}

const optionalNumber = (v: unknown) => (v == null || v === "" ? undefined : numberAttribute(v))
const optionalBoolean = (v: unknown) => (v == null ? undefined : booleanAttribute(v))

/** The scroll position that puts `slide` at the Viewport's snap start. */
function startOf(viewport: HTMLElement, slide: Element, vertical: boolean, rtl: boolean) {
  const v = viewport.getBoundingClientRect()
  const s = slide.getBoundingClientRect()
  if (vertical) return s.top - v.top + viewport.scrollTop
  return (rtl ? s.right - v.right : s.left - v.left) + viewport.scrollLeft
}

/**
 * A carousel: `<section rindCarouselRoot aria-label="Featured" #c="rindCarouselRoot">` with a
 * Viewport of Slides, a Control of triggers, an IndicatorGroup (`@for` over `c.state().pages`)
 * and a Status.
 */
@Directive({
  selector: "[rindCarouselRoot]",
  exportAs: "rindCarouselRoot",
  providers: [{ provide: CAROUSEL, useExisting: forwardRef(() => CarouselRoot) }],
})
export class CarouselRoot {
  /** Controlled page (0-based) (`[(page)]`). */
  readonly page = input(undefined, { transform: optionalNumber })
  /** Uncontrolled page. Default 0. */
  readonly defaultPage = input(undefined, { transform: optionalNumber })
  /** Slides before they register (server-rendered indicators). */
  readonly slideCount = input(undefined, { transform: optionalNumber })
  /** Slides shown at once. Default 1. */
  readonly slidesPerPage = input(1, { transform: numberAttribute })
  /** Slides a step moves: `"page"` (default) or a number. */
  readonly slidesPerMove = input<"page" | number>("page")
  /** Next on the last page goes to the first. */
  readonly loop = input(false, { transform: booleanAttribute })
  /** The scroll axis. Default horizontal. */
  readonly orientation = input<"horizontal" | "vertical">("horizontal")
  /** The gap between slides (`--rind-carousel-spacing`). Default "0px". */
  readonly spacing = input("0px")
  /** Advance by itself; needs an AutoplayTrigger. */
  readonly autoplay = input(undefined, { transform: optionalBoolean })
  /** Ms per page. Default 5000. */
  readonly autoplayDelay = input(undefined, { transform: optionalNumber })
  /** Pause while the pointer is over it. Default true. */
  readonly pauseOnHover = input(undefined, { transform: optionalBoolean })
  /** Overrides the strings (also through the provider). */
  readonly messages = input<MessageOverrides<CarouselMessages>>()
  /** Default: the provider's direction (which way is next for the indicators' arrows). */
  readonly dir = input<"ltr" | "rtl">()
  readonly id = input<string>()
  /** Every change (`[(page)]`). */
  readonly pageChange = output<number>()
  /** Every change; `details.event.reason` says how. */
  readonly pageChangeDetails = output<{ page: number; details: ChangeDetails<CarouselEvent> }>()
  /** Started or stopped. */
  readonly autoplayChange = output<{ playing: boolean; reason: AutoplayReason }>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof carouselConnect>>
  /** @internal */
  readonly send: (event: CarouselEvent) => void
  /** @internal */
  readonly registry: ItemRegistry
  /** @internal */
  readonly direction: () => "ltr" | "rtl"
  /** @internal */
  readonly onScroll: () => void
  /** @internal */
  viewportEl: HTMLElement | null = null
  readonly state: Signal<CarouselRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment(announcerCapability, visibilityCapability)
    const messages = injectMessages("carousel", carouselMessages, () => this.messages())
    const loc = injectLocale(
      () => undefined,
      () => this.dir(),
    )
    this.direction = () => loc().dir
    const read = (name: string) => inject(new HostAttributeToken(name), { optional: true })
    const ariaLabel = read("aria-label") ?? undefined
    const ariaLabelledBy = read("aria-labelledby") ?? undefined
    const vertical = () => this.orientation() === "vertical"
    const rtl = () => loc().dir === "rtl"
    const slideEl = (index: number) =>
      this.viewportEl?.querySelector(
        `[data-scope="carousel"][data-part="slide"][data-instance="${untracked(instance)}"][data-index="${index}"]`,
      ) ?? null
    /** The page our own scrollToPage is heading to: its scroll events are not the user's. */
    let pending: number | null = null
    const { view, send } = injectMachine(
      carouselMachine,
      () => ({
        id: instance(),
        page: this.page(),
        defaultPage: this.defaultPage(),
        onPageChange: (p: number, details: ChangeDetails<CarouselEvent>) => {
          this.pageChange.emit(p)
          this.pageChangeDetails.emit({ page: p, details })
        },
        slideCount: this.slideCount(),
        slidesPerPage: this.slidesPerPage(),
        slidesPerMove: this.slidesPerMove(),
        loop: this.loop(),
        autoplay: this.autoplay(),
        autoplayDelay: this.autoplayDelay(),
        pauseOnHover: this.pauseOnHover(),
        onAutoplayChange: (playing: boolean, d: { readonly reason: AutoplayReason }) =>
          this.autoplayChange.emit({ playing, reason: d.reason }),
        messages: messages(),
        lang: loc().locale,
      }),
      {
        ...env,
        scrollToPage: (p: number, smooth: boolean) => {
          const el = this.viewportEl
          const slide = slideEl(firstSlideOf(untracked(layout), p))
          if (!el || !slide) return
          const v = untracked(vertical)
          const at = startOf(el, slide, v, untracked(rtl))
          if (Math.abs(at - (v ? el.scrollTop : el.scrollLeft)) < 1) return
          pending = p
          el.scrollTo({ [v ? "top" : "left"]: at, behavior: smooth ? "smooth" : "auto" })
        },
      },
    )
    this.send = send
    const layout = computed<CarouselLayout>(() => ({
      slides: view().context.slides,
      perPage: this.slidesPerPage(),
      perMove: this.slidesPerMove(),
    }))
    const pages = computed(() => pageCount(layout()))
    const current = computed(() => clampPage(view().values.page ?? 0, pages()))
    this.registry = createItemRegistry((items) => send({ type: "COUNT", slides: items.length }))
    this.api = computed(() =>
      carouselConnect(
        {
          instance: instance(),
          state: view().state as CarouselState,
          page: current(),
          pages: pages(),
          slides: view().context.slides,
          slidesPerPage: this.slidesPerPage(),
          slidesPerMove: this.slidesPerMove(),
          loop: this.loop(),
          orientation: this.orientation(),
          spacing: this.spacing(),
          delay: this.autoplayDelay() ?? 5000,
          scrolling: view().context.scrolling,
          messages: messages(),
          ariaLabel,
          ariaLabelledBy,
          ids: {
            viewport: partId("carousel", instance(), "viewport"),
            slide: (i) => partId("carousel", instance(), `slide-${i}`),
          },
        },
        env,
      ),
    )
    this.state = computed(() => ({
      page: current(),
      pages: pages(),
      autoplay: view().state === "stopped" ? "off" : (view().state as "playing" | "paused"),
    }))
    // A scroll the user made: START once, then END at the nearest page when it settles.
    let timer: unknown = null
    let started = false
    const onSettled = () => {
      if (timer !== null) env.scheduler.clearTimeout(timer)
      timer = null
      const el = this.viewportEl
      if (!el) return
      const v = untracked(vertical)
      const pos = v ? el.scrollTop : el.scrollLeft
      let nearest = 0
      let best = Number.POSITIVE_INFINITY
      const l = untracked(layout)
      for (let p = 0; p < pageCount(l); p++) {
        const slide = slideEl(firstSlideOf(l, p))
        if (!slide) continue
        const d = Math.abs(startOf(el, slide, v, untracked(rtl)) - pos)
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
    this.onScroll = () => {
      if (pending === null && !started) {
        started = true
        send({ type: "SCROLL.START" })
      }
      if (timer !== null) env.scheduler.clearTimeout(timer)
      timer = env.scheduler.setTimeout(onSettled, SETTLE_MS)
    }
    bindProps(
      () =>
        joinHandlers(this.api().root(), {
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
      {
        owns: [
          "autoplay",
          "autoplaydelay",
          "defaultpage",
          "dir",
          "id",
          "loop",
          "messages",
          "orientation",
          "page",
          "pauseonhover",
          "slidecount",
          "slidespermove",
          "slidesperpage",
          "spacing",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      const el = this.viewportEl
      if (el) {
        el.addEventListener("scrollend", onSettled)
        destroy.onDestroy(() => el.removeEventListener("scrollend", onSettled))
      }
      destroy.onDestroy(() => {
        if (timer !== null) env.scheduler.clearTimeout(timer)
      })
    })
  }
}

/** The scroll-snap container; scrolling natively settles the page. */
@Directive({ selector: "[rindCarouselViewport]", exportAs: "rindCarouselViewport" })
export class CarouselViewport {
  constructor() {
    const root = injectCarousel("Viewport")
    root.viewportEl = inject(ElementRef).nativeElement
    bindProps(() => joinHandlers(root.api().viewport(), { onScroll: root.onScroll }))
  }
}

/** A group named "2 of 6"; off the current page it is inert: `<div rindCarouselSlide [index]="i">`. */
@Directive({ selector: "[rindCarouselSlide]", exportAs: "rindCarouselSlide" })
export class CarouselSlide {
  /** The slide's position (0-based). */
  readonly index = input.required({ transform: numberAttribute })
  constructor() {
    const root = injectCarousel("Slide")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() => root.api().slide(this.index()), { owns: ["index"] })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      const i = String(untracked(this.index))
      destroy.onDestroy(root.registry.register({ key: i, textValue: i, element: el }))
    })
  }
}

/** Lays out the triggers. */
@Directive({ selector: "[rindCarouselControl]", exportAs: "rindCarouselControl" })
export class CarouselControl {
  constructor() {
    const root = injectCarousel("Control")
    bindProps(() => root.api().control())
  }
}

/** Focus state with the modality it arrived by, and the element's tag. */
function injectButton() {
  const env = injectEnvironment()
  const el: Element = inject(ElementRef).nativeElement
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    // Tracks the modality from mount, so the first keyboard focus is already visible.
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  return {
    env,
    el,
    focused,
    b: (): { tag: string; focused: boolean; modality: Modality } => ({
      tag: el.tagName.toLowerCase(),
      focused: focused(),
      modality: modality(),
    }),
  }
}

type Api = ReturnType<typeof carouselConnect>

function bindTrigger(
  root: CarouselRoot,
  props: (
    api: Api,
    b: ReturnType<ReturnType<typeof injectButton>["b"]>,
  ) => ReturnType<Api["control"]>,
  event: CarouselEvent,
) {
  const { focused, b } = injectButton()
  bindProps(() => {
    const own = props(root.api(), b())
    const disabled = own["aria-disabled"] === "true"
    return joinHandlers(own, {
      // At an end without loop the button stays focusable (aria-disabled) and does nothing.
      onClick: () => {
        if (!disabled) root.send(event)
      },
      onFocusIn: () => focused.set(true),
      onFocusOut: () => focused.set(false),
    })
  })
}

/** The previous page. */
@Directive({ selector: "[rindCarouselPrevTrigger]", exportAs: "rindCarouselPrevTrigger" })
export class CarouselPrevTrigger {
  constructor() {
    bindTrigger(injectCarousel("PrevTrigger"), (api, b) => api.prevTrigger(b), {
      type: "PREV",
      reason: "trigger",
    })
  }
}

/** The next page. */
@Directive({ selector: "[rindCarouselNextTrigger]", exportAs: "rindCarouselNextTrigger" })
export class CarouselNextTrigger {
  constructor() {
    bindTrigger(injectCarousel("NextTrigger"), (api, b) => api.nextTrigger(b), {
      type: "NEXT",
      reason: "trigger",
    })
  }
}

/** Stops and starts autoplay; named by what it does. */
@Directive({ selector: "[rindCarouselAutoplayTrigger]", exportAs: "rindCarouselAutoplayTrigger" })
export class CarouselAutoplayTrigger {
  constructor() {
    bindTrigger(injectCarousel("AutoplayTrigger"), (api, b) => api.autoplayTrigger(b), {
      type: "TOGGLE",
    })
  }
}

/** A tablist of pages: one tab stop, arrows move and select. */
@Directive({ selector: "[rindCarouselIndicatorGroup]", exportAs: "rindCarouselIndicatorGroup" })
export class CarouselIndicatorGroup {
  constructor() {
    const root = injectCarousel("IndicatorGroup")
    bindProps(() => root.api().indicatorGroup())
  }
}

/** One page: `<button rindCarouselIndicator [index]="p">`. */
@Directive({ selector: "[rindCarouselIndicator]", exportAs: "rindCarouselIndicator" })
export class CarouselIndicator {
  /** The page (0-based). */
  readonly index = input.required({ transform: numberAttribute })
  constructor() {
    const root = injectCarousel("Indicator")
    const { env, el, focused, b } = injectButton()
    bindProps(
      () =>
        joinHandlers(root.api().indicator(this.index(), b()), {
          onClick: () =>
            root.send({ type: "GO", page: untracked(this.index), reason: "indicator" }),
          onKeyDown: (e: KeyboardEvent) => {
            const s = untracked(root.state)
            const event = carouselIndicatorKeyEvent(describeKey(e, env), {
              page: s.page,
              pages: s.pages,
              orientation: untracked(root.orientation),
              dir: root.direction(),
            })
            if (event?.type !== "GO") return
            e.preventDefault()
            root.send(event)
            // The roving tab stop follows the selection.
            el.closest('[data-part="indicator-group"]')
              ?.querySelector<HTMLElement>(`[data-part="indicator"][data-index="${event.page}"]`)
              ?.focus()
          },
          onFocusIn: () => focused.set(true),
          onFocusOut: () => focused.set(false),
        }),
      { owns: ["index"] },
    )
  }
}

/** "3 / 6" (hidden from assistive technology); its content replaces it. */
@Component({
  selector: "[rindCarouselStatus]",
  exportAs: "rindCarouselStatus",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class CarouselStatus {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectCarousel("Status")
    this.text = computed(() => root.api().statusText)
    bindProps(() => root.api().status())
  }
}

/** The Carousel's parts, for a standalone component's `imports`. */
export const Carousel = [
  CarouselRoot,
  CarouselViewport,
  CarouselSlide,
  CarouselControl,
  CarouselPrevTrigger,
  CarouselNextTrigger,
  CarouselAutoplayTrigger,
  CarouselIndicatorGroup,
  CarouselIndicator,
  CarouselStatus,
] as const
