// Scroll Area (design §1): flat activity states, the same graph for every `type`. The browser
// scrolls; `core/dom/scroll-metrics.ts` measures and draws, and sends only discrete facts
// (METRICS, a user SCROLL, drag start/end). Visibility is computed in connect from the state
// and these flags, never stored. Delays run through the scheduler, so Node tests use fake time.

import type { DomEnvironment } from "../../env/dom-environment"
import { setup, type } from "../../machine/setup"

export type ScrollAxis = "x" | "y"
export type ScrollAreaType = "hover" | "scroll" | "auto" | "always"
export type ScrollAreaPointerType = "mouse" | "pen" | "touch"

export interface AxisFlags {
  readonly x: boolean
  readonly y: boolean
}
export interface EdgeFlags {
  readonly xStart: boolean
  readonly xEnd: boolean
  readonly yStart: boolean
  readonly yEnd: boolean
}

export type ScrollAreaEvent =
  /** The Root: only mouse and pen hover counts. */
  | {
      readonly type: "POINTER.ENTER" | "POINTER.LEAVE"
      readonly pointerType: ScrollAreaPointerType
    }
  | { readonly type: "SCROLLBAR.ENTER" | "SCROLLBAR.LEAVE"; readonly axis: ScrollAxis }
  /** Focus inside the Root (focusin / focusout to outside). */
  | { readonly type: "FOCUS.IN" | "FOCUS.OUT" }
  | { readonly type: "VIEWPORT.FOCUS" | "VIEWPORT.BLUR" }
  /** `user: false`: programmatic (the thumb is already drawn; visibility unchanged). */
  | { readonly type: "SCROLL"; readonly axis: ScrollAxis | "both"; readonly user: boolean }
  | { readonly type: "DRAG.START"; readonly axis: ScrollAxis }
  | { readonly type: "DRAG.END" }
  | { readonly type: "DRAG.CANCEL" }
  | {
      readonly type: "METRICS"
      readonly overflow: AxisFlags
      readonly edges: EdgeFlags
      readonly tabbable: boolean
    }

/** What a machine's tracking effect reaches the DOM through (injected; faked in tests). */
export interface ScrollMetricsCapability {
  track(
    root: string,
    send: (e: ScrollAreaEvent) => void,
    options: () => { readonly trackPress: "page" | "jump" },
  ): { measure(): void; stop(): void }
}
export interface ScrollMetricsEnv {
  readonly scrollMetrics: ScrollMetricsCapability
}

export interface ScrollAreaProps {
  /** The instance id (part ids derive from it). */
  readonly root: string
  /** Default `hover`. */
  readonly type?: ScrollAreaType | undefined
  /** Default 600 ms. */
  readonly hideDelay?: number | undefined
  /** Default `page`. */
  readonly trackPress?: "page" | "jump" | undefined
  /** Receives `measure()` once tracking starts (the React Root's ref handle). */
  readonly onTrack?: ((handle: { measure(): void } | null) => void) | undefined
}

export interface ScrollAreaContext {
  readonly hovered: boolean
  readonly focusInside: boolean
  readonly viewportFocused: boolean
  readonly onScrollbar: ScrollAxis | null
  readonly scrolling: ScrollAxis | "both" | null
  readonly dragAxis: ScrollAxis | null
  readonly measured: boolean
  readonly overflow: AxisFlags
  readonly edges: EdgeFlags
  readonly tabbableContent: boolean
  /** Latched: kept while the Viewport has focus, re-evaluated on blur. */
  readonly tabStop: boolean
}

type Flags = Pick<ScrollAreaContext, "hovered" | "focusInside" | "onScrollbar">

/** The hover/focus/scrollbar flags once `event` is applied. */
function flagsAfter(
  c: Flags,
  e: ScrollAreaEvent | { readonly type: `$${string}` | `after:${string}` },
): Flags {
  switch (e.type) {
    case "POINTER.ENTER":
      return { ...c, hovered: e.pointerType !== "touch" || c.hovered }
    case "POINTER.LEAVE":
      return { ...c, hovered: e.pointerType === "touch" && c.hovered }
    case "FOCUS.IN":
      return { ...c, focusInside: true }
    case "FOCUS.OUT":
      return { ...c, focusInside: false }
    case "SCROLLBAR.ENTER":
      return { ...c, onScrollbar: e.axis }
    case "SCROLLBAR.LEAVE":
      return { ...c, onScrollbar: null }
    default:
      return c
  }
}

/** Hover, focus and a pointer on a scrollbar keep `hover`/`auto`/`always` engaged; `scroll` only the scrollbar. */
const engagedBy = (type: ScrollAreaType, f: Flags) =>
  type === "scroll" ? f.onScrollbar !== null : f.hovered || f.focusInside || f.onScrollbar !== null

/** The tab-stop rule (spec "Viewport Tab Stop"). */
const tabStopRule = (c: Pick<ScrollAreaContext, "measured" | "overflow" | "tabbableContent">) =>
  c.measured && (c.overflow.x || c.overflow.y) && !c.tabbableContent

const typeOf = (props: ScrollAreaProps): ScrollAreaType => props.type ?? "hover"

export const scrollAreaMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ScrollAreaProps
    events: ScrollAreaEvent
    env: DomEnvironment & ScrollMetricsEnv
    context: ScrollAreaContext
  }>(),
  guards: {
    isUserScroll: ({ event }) => event.type === "SCROLL" && event.user,
    /** Engaged once this event is applied. */
    engagedAfter: ({ context, event, props }) =>
      engagedBy(typeOf(props), flagsAfter(context, event)),
    scrolling: ({ context }) => context.scrolling !== null,
    engaged: ({ context, props }) => engagedBy(typeOf(props), context),
  },
  actions: {
    applyFlags: ({ context, event, set }) => {
      const f = flagsAfter(context, event)
      if (f.hovered !== context.hovered) set("hovered", f.hovered)
      if (f.focusInside !== context.focusInside) set("focusInside", f.focusInside)
      if (f.onScrollbar !== context.onScrollbar) set("onScrollbar", f.onScrollbar)
    },
    startScrolling: ({ event, set }) => {
      if (event.type === "SCROLL") set("scrolling", event.axis)
    },
    stopScrolling: ({ set }) => set("scrolling", null),
    startDrag: ({ event, set }) => {
      if (event.type === "DRAG.START") set("dragAxis", event.axis)
    },
    endDrag: ({ set }) => set("dragAxis", null),
    metrics: ({ context, event, set }) => {
      if (event.type !== "METRICS") return
      const next = { measured: true, overflow: event.overflow, tabbableContent: event.tabbable }
      set("measured", true)
      set("overflow", event.overflow)
      set("edges", event.edges)
      set("tabbableContent", event.tabbable)
      // Never removed while the Viewport has focus (mui/base-ui#4205): on the next blur.
      set("tabStop", tabStopRule(next) || (context.viewportFocused && context.tabStop))
    },
    viewportFocus: ({ set }) => set("viewportFocused", true),
    viewportBlur: ({ context, set }) => {
      set("viewportFocused", false)
      set("tabStop", tabStopRule(context))
    },
  },
  delays: {
    scrollEnd: () => 100,
    hideDelay: ({ props }) => props.hideDelay ?? 600,
  },
  effects: {
    /** Measuring, drawing, wheel forwarding and drags for the whole life of the service. */
    track: ({ env, props, send }) => {
      const handle = env.scrollMetrics.track(props.root, send, () => ({
        trackPress: props.trackPress ?? "page",
      }))
      props.onTrack?.(handle)
      return () => {
        props.onTrack?.(null)
        handle.stop()
      }
    },
  },
}).machine({
  id: "scroll-area",
  initial: "idle",
  context: () => ({
    hovered: false,
    focusInside: false,
    viewportFocused: false,
    onScrollbar: null,
    scrolling: null,
    dragAxis: null,
    measured: false,
    overflow: { x: false, y: false },
    edges: { xStart: false, xEnd: false, yStart: false, yEnd: false },
    tabbableContent: false,
    tabStop: false,
  }),
  effects: ["track"],
  // Fallbacks: tried whenever the state takes no transition.
  on: {
    METRICS: { actions: ["metrics"] },
    "VIEWPORT.FOCUS": { actions: ["viewportFocus"] },
    "VIEWPORT.BLUR": { actions: ["viewportBlur"] },
    "POINTER.ENTER": { actions: ["applyFlags"] },
    "POINTER.LEAVE": { actions: ["applyFlags"] },
    "FOCUS.IN": { actions: ["applyFlags"] },
    "FOCUS.OUT": { actions: ["applyFlags"] },
    "SCROLLBAR.ENTER": { actions: ["applyFlags"] },
    "SCROLLBAR.LEAVE": { actions: ["applyFlags"] },
    "DRAG.START": { target: "dragging", actions: ["startDrag"] },
  },
  states: {
    idle: {
      on: {
        "POINTER.ENTER": { guard: "engagedAfter", target: "engaged", actions: ["applyFlags"] },
        "FOCUS.IN": { guard: "engagedAfter", target: "engaged", actions: ["applyFlags"] },
        "SCROLLBAR.ENTER": { guard: "engagedAfter", target: "engaged", actions: ["applyFlags"] },
        SCROLL: { guard: "isUserScroll", target: "engaged", actions: ["startScrolling"] },
      },
    },
    engaged: {
      after: {
        scrollEnd: [
          { guard: "engaged", actions: ["stopScrolling"] },
          { target: "lingering", actions: ["stopScrolling"] },
        ],
      },
      on: {
        // Re-entered: restarts scrollEnd.
        SCROLL: {
          guard: "isUserScroll",
          target: "engaged",
          reenter: true,
          actions: ["startScrolling"],
        },
        "POINTER.LEAVE": [
          { guard: { or: ["engagedAfter", "scrolling"] }, actions: ["applyFlags"] },
          { target: "lingering", actions: ["applyFlags"] },
        ],
        "FOCUS.OUT": [
          { guard: { or: ["engagedAfter", "scrolling"] }, actions: ["applyFlags"] },
          { target: "lingering", actions: ["applyFlags"] },
        ],
        "SCROLLBAR.LEAVE": [
          { guard: { or: ["engagedAfter", "scrolling"] }, actions: ["applyFlags"] },
          { target: "lingering", actions: ["applyFlags"] },
        ],
      },
    },
    lingering: {
      after: { hideDelay: "idle" },
      on: {
        "POINTER.ENTER": { guard: "engagedAfter", target: "engaged", actions: ["applyFlags"] },
        "FOCUS.IN": { guard: "engagedAfter", target: "engaged", actions: ["applyFlags"] },
        "SCROLLBAR.ENTER": { guard: "engagedAfter", target: "engaged", actions: ["applyFlags"] },
        SCROLL: { guard: "isUserScroll", target: "engaged", actions: ["startScrolling"] },
      },
    },
    dragging: {
      on: {
        "DRAG.END": [
          { guard: "engaged", target: "engaged", actions: ["endDrag"] },
          { target: "lingering", actions: ["endDrag"] },
        ],
        "DRAG.CANCEL": [
          { guard: "engaged", target: "engaged", actions: ["endDrag"] },
          { target: "lingering", actions: ["endDrag"] },
        ],
      },
    },
  },
})

export type ScrollAreaMachine = typeof scrollAreaMachine
export { engagedBy as scrollAreaEngagedBy, tabStopRule as scrollAreaTabStopRule }
