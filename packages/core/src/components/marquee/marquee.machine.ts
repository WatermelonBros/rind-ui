// Marquee (add-marquee design §2): a layout-free machine. Sizes, hover, focus and the motion
// preference arrive as events; CSS moves the band, `core/dom/marquee-motion` keeps its time.
// Every event updates the context, then SETTLE picks the first state that holds: `static`
// (reduced motion), `idle` (no size), `paused` (the user pause, or a pausing hover), `running`.

import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type MarqueeEvent =
  /** px on the axis; `content` is one copy with its trailing gap. */
  | { readonly type: "MEASURED"; readonly viewport: number; readonly content: number }
  /** Sent on mount, then on every change of the Environment's MotionPreference. */
  | { readonly type: "MOTION.CHANGED"; readonly reduced: boolean }
  | { readonly type: "TRIGGER.PRESS"; readonly modality: Modality }
  /** Never from touch. */
  | { readonly type: "POINTER.ENTER" }
  | { readonly type: "POINTER.LEAVE" }
  /** Focus moved into the Viewport. */
  | { readonly type: "FOCUS.ENTER"; readonly modality: Modality }
  /** The controlled `paused` prop or `pauseOnHover` changed (onProps). */
  | { readonly type: "PAUSED.SYNCED" }
  /** Internal: picks the state from the updated context. */
  | { readonly type: "SETTLE" }

/** The reason `onPausedChange` receives. */
export type MarqueePauseReason = "trigger" | "focus"

export interface MarqueeProps {
  /** Controlled user pause. */
  readonly paused?: boolean | undefined
  readonly defaultPaused?: boolean | undefined
  readonly onPausedChange?:
    | ((paused: boolean, details: ChangeDetails<MarqueeEvent>) => void)
    | undefined
  /** A mouse or pen over the Viewport pauses until it leaves. Default true. */
  readonly pauseOnHover?: boolean | undefined
}

export interface MarqueeSize {
  readonly viewport: number
  readonly content: number
}

export interface MarqueeContext {
  readonly hovered: boolean
  /** False on the server and the client alike until the first MOTION.CHANGED. */
  readonly reduced: boolean
  readonly size: MarqueeSize | null
}

type Types = {
  props: MarqueeProps
  events: MarqueeEvent
  env: object
  context: MarqueeContext
  values: "paused"
}

const usable = (n: number) => Number.isFinite(n) && n > 0

/** The copy count: 1 in `static`; with `autoFill` and a size, enough to fill plus one (≤ 32). */
export function marqueeCopies(state: string, size: MarqueeSize | null, autoFill: boolean): number {
  if (state === "static") return 1
  if (!autoFill || !size) return 2
  return Math.min(32, Math.ceil(size.viewport / size.content) + 1)
}

/** `speed` in CSS px per second; below 1 or not finite counts as 1. */
export function marqueeSpeed(speed: number | undefined): number {
  const s = speed ?? 50
  return Number.isFinite(s) && s >= 1 ? s : 1
}

/** Seconds for one copy to pass, or null before a measurement. */
export function marqueeDuration(size: MarqueeSize | null, speed: number | undefined) {
  return size ? size.content / marqueeSpeed(speed) : null
}

export const marqueeMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    reduced: ({ context }) => context.reduced,
    unmeasured: ({ context }) => context.size === null,
    held: ({ context, values, props }) =>
      values.paused || (context.hovered && props.pauseOnHover !== false),
    /** Keyboard or virtual focus pauses (APG: rotation stops on focus); a pointer's does not. */
    focusPauses: ({ event, values }) =>
      event.type === "FOCUS.ENTER" &&
      (event.modality === "keyboard" || event.modality === "virtual") &&
      !values.paused,
  },
  actions: {
    measure: ({ event, set }) => {
      if (event.type !== "MEASURED") return
      const ok = usable(event.viewport) && usable(event.content)
      set("size", ok ? { viewport: event.viewport, content: event.content } : null)
    },
    motion: ({ event, set }) => {
      if (event.type === "MOTION.CHANGED") set("reduced", event.reduced)
    },
    hover: ({ set }) => set("hovered", true),
    unhover: ({ set }) => set("hovered", false),
    toggle: ({ set, values }) => set("paused", !values.paused),
    pause: ({ set }) => set("paused", true),
    settle: ({ send }) => send({ type: "SETTLE" }),
  },
}).machine({
  id: "marquee",
  initial: "idle",
  context: () => ({ hovered: false, reduced: false, size: null }),
  values: { paused: { fallback: false } },
  onProps: { paused: "PAUSED.SYNCED", pauseOnHover: "PAUSED.SYNCED" },
  on: {
    MEASURED: { actions: ["measure", "settle"] },
    "MOTION.CHANGED": { actions: ["motion", "settle"] },
    "TRIGGER.PRESS": { actions: ["toggle", "settle"], reason: "trigger" },
    "POINTER.ENTER": { actions: ["hover", "settle"] },
    "POINTER.LEAVE": { actions: ["unhover", "settle"] },
    "FOCUS.ENTER": { guard: "focusPauses", actions: ["pause", "settle"], reason: "focus" },
    "PAUSED.SYNCED": { actions: ["settle"] },
    SETTLE: [
      { guard: "reduced", target: "static" },
      { guard: "unmeasured", target: "idle" },
      { guard: "held", target: "paused" },
      { target: "running" },
    ],
  },
  states: { idle: {}, running: {}, paused: {}, static: {} },
})

export type MarqueeMachine = typeof marqueeMachine
