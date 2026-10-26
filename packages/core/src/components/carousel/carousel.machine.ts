// Carousel (add-carousel design §2–§4): the autoplay is the state (stopped, playing, paused),
// the page a controllable value, the scroll a flag. The delay is measured on the injected clock
// and one timeout is pending while playing; a pause keeps the remaining time. Only user page
// changes are announced (autoplay and scrolling are silent).

import type {
  AnnouncerEnv,
  ClockEnv,
  LocaleEnv,
  MotionEnv,
  SchedulerEnv,
  VisibilityEnv,
} from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import { type CarouselMessages, carouselMessages } from "./carousel.messages"
import { clampPage, pageCount } from "./carousel.pages"

export type CarouselReason = "trigger" | "indicator" | "keyboard" | "scroll" | "autoplay" | "api"
export type CarouselHold = "hover" | "hidden"
export type AutoplayReason = "user" | "focus" | "end" | "api" | "motion"

export type CarouselEvent =
  | { readonly type: "GO"; readonly page: number; readonly reason: CarouselReason }
  | { readonly type: "NEXT"; readonly reason: CarouselReason }
  | { readonly type: "PREV"; readonly reason: CarouselReason }
  | { readonly type: "SCROLL.START" }
  /** The scroll settled nearest to `page` (measured by the parts). */
  | { readonly type: "SCROLL.END"; readonly page: number }
  | { readonly type: "COUNT"; readonly slides: number }
  | { readonly type: "PLAY"; readonly reason: AutoplayReason }
  | { readonly type: "STOP"; readonly reason: AutoplayReason }
  | { readonly type: "TOGGLE" }
  | { readonly type: "HOLD"; readonly hold: CarouselHold }
  | { readonly type: "RELEASE"; readonly hold: CarouselHold }
  | { readonly type: "TICK" }

export interface CarouselProps {
  readonly id: string
  readonly page?: number | undefined
  readonly defaultPage?: number | undefined
  readonly onPageChange?:
    | ((page: number, details: ChangeDetails<CarouselEvent>) => void)
    | undefined
  /** The slide count before the registry reports (SSR indicators). */
  readonly slideCount?: number | undefined
  readonly slidesPerPage?: number | undefined
  readonly slidesPerMove?: "page" | number | undefined
  readonly loop?: boolean | undefined
  readonly autoplay?: boolean | undefined
  readonly autoplayDelay?: number | undefined
  readonly pauseOnHover?: boolean | undefined
  readonly onAutoplayChange?:
    | ((playing: boolean, details: { readonly reason: AutoplayReason }) => void)
    | undefined
  readonly messages?: CarouselMessages | undefined
  readonly lang?: string | undefined
}

export interface CarouselEnv
  extends SchedulerEnv,
    ClockEnv,
    AnnouncerEnv,
    LocaleEnv,
    MotionEnv,
    VisibilityEnv {
  /** Scrolls the Viewport to the page (the adapter's DOM). */
  readonly scrollToPage?: ((page: number, smooth: boolean) => void) | undefined
}

export interface CarouselContext {
  readonly slides: number
  readonly holds: readonly CarouselHold[]
  /** Ms left of the delay (a pause keeps it). */
  readonly remaining: number
  /** `clock.now()` when the current wait began. */
  readonly startedAt: number
  readonly scrolling: boolean
}

type Types = {
  props: CarouselProps
  events: CarouselEvent
  env: CarouselEnv
  context: CarouselContext
  values: "page"
}
type Args = ActionArgs<Types>

export const DEFAULT_AUTOPLAY_DELAY = 5000
const delayOf = (p: CarouselProps) =>
  p.autoplayDelay !== undefined && p.autoplayDelay > 0 ? p.autoplayDelay : DEFAULT_AUTOPLAY_DELAY

export const pagesOf = (props: CarouselProps, slides: number) =>
  pageCount({ slides, perPage: props.slidesPerPage, perMove: props.slidesPerMove })

const pages = (a: Pick<Args, "props" | "context">) => pagesOf(a.props, a.context.slides)
const current = (a: Pick<Args, "props" | "context" | "values">) =>
  clampPage(a.values.page ?? 0, pages(a))

/** The page after `page` by `delta`, wrapping with `loop`; null at an end. */
export function stepPage(page: number, delta: 1 | -1, total: number, loop: boolean): number | null {
  const next = page + delta
  if (next >= 0 && next < total) return next
  if (!loop || total < 2) return null
  return (next + total) % total
}

function go(a: Args, page: number, reason: CarouselReason) {
  const p = clampPage(page, pages(a))
  if (p === current(a)) return false
  a.set("page", p)
  if (reason !== "scroll") a.env.scrollToPage?.(p, !a.env.motion.reducedMotion())
  if (reason !== "scroll" && reason !== "autoplay") {
    const m = a.props.messages ?? carouselMessages
    a.env.announcer.announce({
      message: m.announcement(p + 1, pages(a)),
      priority: "polite",
      key: `carousel-${a.props.id}`,
      lang: a.props.lang ?? a.env.locale.locale(),
    })
  }
  return true
}

export const carouselMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    canAutoplay: ({ props, env }) => props.autoplay === true && !env.motion.reducedMotion(),
    held: ({ context }) => context.holds.length > 0,
    noHoldLeft: ({ context, event }) =>
      event.type === "RELEASE" && context.holds.filter((h) => h !== event.hold).length === 0,
    atEnd: (a) => !a.props.loop && current(a) >= pages(a) - 1,
    hoverPauses: ({ props, event }) =>
      event.type !== "HOLD" || event.hold !== "hover" || props.pauseOnHover !== false,
  },
  actions: {
    navigate: (a) => {
      const e = a.event
      if (e.type === "GO") go(a, e.page, e.reason)
      else if (e.type === "NEXT" || e.type === "PREV") {
        const next = stepPage(
          current(a),
          e.type === "NEXT" ? 1 : -1,
          pages(a),
          a.props.loop === true,
        )
        if (next !== null) go(a, next, e.reason)
      }
    },
    advance: (a) => {
      const next = stepPage(current(a), 1, pages(a), a.props.loop === true)
      if (next !== null) go(a, next, "autoplay")
    },
    scrollStart: ({ set }) => set("scrolling", true),
    scrollEnd: (a) => {
      a.set("scrolling", false)
      if (a.event.type === "SCROLL.END") go(a, a.event.page, "scroll")
    },
    count: (a) => {
      if (a.event.type !== "COUNT") return
      a.set("slides", a.event.slides)
      const p = current(a)
      if (p !== (a.values.page ?? 0)) a.set("page", p)
    },
    restartDelay: (a) => {
      a.set("remaining", delayOf(a.props))
      a.set("startedAt", a.env.clock.now())
    },
    resumeClock: (a) => a.set("startedAt", a.env.clock.now()),
    keepRemaining: (a) => {
      const left = a.context.remaining - (a.env.clock.now() - a.context.startedAt)
      a.set("remaining", Math.max(0, left))
    },
    addHold: ({ event, context, props, set }) => {
      if (event.type !== "HOLD" || (event.hold === "hover" && props.pauseOnHover === false)) return
      if (!context.holds.includes(event.hold)) {
        set("holds", [...context.holds, event.hold])
      }
    },
    removeHold: ({ event, context, set }) => {
      if (event.type === "RELEASE")
        set(
          "holds",
          context.holds.filter((h) => h !== event.hold),
        )
    },
    reportPlay: ({ props, event }) =>
      props.onAutoplayChange?.(true, { reason: event.type === "PLAY" ? event.reason : "user" }),
    reportStop: ({ props, event }) =>
      props.onAutoplayChange?.(false, {
        reason: event.type === "STOP" ? event.reason : event.type === "TICK" ? "end" : "user",
      }),
  },
  effects: {
    /** One timeout for the remaining delay. */
    waiting: ({ context, env, send }) => {
      const handle = env.scheduler.setTimeout(() => send({ type: "TICK" }), context.remaining)
      return () => env.scheduler.clearTimeout(handle)
    },
    /** A hidden page pauses; reduced motion stops. */
    watch: ({ env, send }) => {
      const offVisibility = env.visibility.subscribe((hidden) =>
        send(hidden ? { type: "HOLD", hold: "hidden" } : { type: "RELEASE", hold: "hidden" }),
      )
      const offMotion = env.motion.subscribeReducedMotion((reduced) => {
        if (reduced) send({ type: "STOP", reason: "motion" })
      })
      return () => {
        offVisibility()
        offMotion()
      }
    },
    autostart: ({ props, env, send }) => {
      if (props.autoplay === true && !env.motion.reducedMotion())
        send({ type: "PLAY", reason: "api" })
      return undefined
    },
  },
}).machine({
  id: "carousel",
  initial: "stopped",
  context: (props) => ({
    slides: props.slideCount ?? 0,
    holds: [],
    remaining: delayOf(props),
    startedAt: 0,
    scrolling: false,
  }),
  values: { page: { fallback: 0 } },
  effects: ["autostart", "watch"],
  on: {
    "SCROLL.START": { actions: ["scrollStart"] },
    COUNT: { actions: ["count"] },
  },
  states: {
    stopped: {
      on: {
        GO: { actions: ["navigate"] },
        NEXT: { actions: ["navigate"] },
        PREV: { actions: ["navigate"] },
        "SCROLL.END": { actions: ["scrollEnd"] },
        PLAY: [
          // A hold that arrived while stopped (the pointer over it, a hidden page) pauses at once.
          {
            guard: { and: ["canAutoplay", "held"] },
            target: "paused",
            actions: ["restartDelay", "reportPlay"],
          },
          { guard: "canAutoplay", target: "playing", actions: ["restartDelay", "reportPlay"] },
        ],
        TOGGLE: [
          {
            guard: { and: ["canAutoplay", "held"] },
            target: "paused",
            actions: ["restartDelay", "reportPlay"],
          },
          { guard: "canAutoplay", target: "playing", actions: ["restartDelay", "reportPlay"] },
        ],
        HOLD: { actions: ["addHold"] },
        RELEASE: { actions: ["removeHold"] },
      },
    },
    playing: {
      effects: ["waiting"],
      on: {
        TICK: [
          { guard: "atEnd", target: "stopped", actions: ["reportStop"] },
          { target: "playing", reenter: true, actions: ["advance", "restartDelay"] },
        ],
        GO: { target: "playing", reenter: true, actions: ["navigate", "restartDelay"] },
        NEXT: { target: "playing", reenter: true, actions: ["navigate", "restartDelay"] },
        PREV: { target: "playing", reenter: true, actions: ["navigate", "restartDelay"] },
        "SCROLL.END": { target: "playing", reenter: true, actions: ["scrollEnd", "restartDelay"] },
        HOLD: {
          guard: "hoverPauses",
          target: "paused",
          actions: ["addHold", "keepRemaining"],
        },
        STOP: { target: "stopped", actions: ["reportStop"] },
        TOGGLE: { target: "stopped", actions: ["reportStop"] },
      },
    },
    paused: {
      on: {
        GO: { actions: ["navigate", "restartDelay"] },
        NEXT: { actions: ["navigate", "restartDelay"] },
        PREV: { actions: ["navigate", "restartDelay"] },
        "SCROLL.END": { actions: ["scrollEnd", "restartDelay"] },
        HOLD: { actions: ["addHold"] },
        RELEASE: [
          { guard: "noHoldLeft", target: "playing", actions: ["removeHold", "resumeClock"] },
          { actions: ["removeHold"] },
        ],
        STOP: { target: "stopped", actions: ["reportStop"] },
        TOGGLE: { target: "stopped", actions: ["reportStop"] },
      },
    },
  },
})

export type CarouselMachine = typeof carouselMachine
export type CarouselState = "stopped" | "playing" | "paused"
