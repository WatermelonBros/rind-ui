// One toast's lifetime (design §2): idle until the store starts it, then timing, paused or
// persistent, and dismissed (final). Pausing is a set of reasons: a toast resumes only when
// none is left (zag#2238, radix#2268, kobalte#564). The remaining time is kept across pauses
// and reset by an update (radix#2233). Swipe and the region's reasons come as events.

import type { Modality } from "../../contract/env"
import type { SwipeDirection, SwipeRelease } from "../../dom/swipe"
import type { AnnouncerEnv, ClockEnv, LocaleEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import { type ToastMessages, toastAnnouncement, toastMessages } from "./toast.messages"
import {
  isPersistentToast,
  type ToastData,
  type ToastDismissReason,
  type ToastPauseReason,
} from "./toast.types"

export type ToastEvent =
  /** The store starts the toast (with the region's reasons already applied). */
  | { readonly type: "START" }
  | { readonly type: "PAUSE"; readonly reason: ToastPauseReason }
  | { readonly type: "RESUME"; readonly reason: ToastPauseReason }
  | { readonly type: "UPDATE"; readonly data: ToastData }
  | { readonly type: "CLOSE_TRIGGER_PRESS"; readonly modality: Modality }
  | { readonly type: "ACTION_PRESS"; readonly modality: Modality }
  | { readonly type: "ESCAPE_KEY"; readonly modality: Modality }
  | { readonly type: "SWIPE.START"; readonly modality: "pointer" | "touch" }
  | ({ readonly type: "SWIPE" } & SwipeRelease)
  | { readonly type: "SWIPE.CANCEL" }
  /** The lifetime elapsed (the lifetime effect). */
  | { readonly type: "TIMEOUT" }
  /** `toaster.dismiss(id)`. */
  | { readonly type: "DISMISS" }
  | { readonly type: "MEASURED"; readonly height: number }

export interface ToastProps {
  readonly data: ToastData
  /** The store's default lifetime (ms). */
  readonly duration: number
  readonly swipeDirections: readonly SwipeDirection[]
  /** px (default 45). */
  readonly swipeThreshold?: number | undefined
  /** px/ms (default 0.11). */
  readonly swipeVelocity?: number | undefined
  readonly hotkey: string
  readonly messages?: ToastMessages | undefined
  /** The store's own hook: the record is done (removed after its exit). */
  readonly onDismissed?: ((reason: ToastDismissReason) => void) | undefined
}

export interface ToastContext {
  readonly data: ToastData
  readonly reasons: ReadonlySet<ToastPauseReason>
  /** ms left when `startedAt` was taken. */
  readonly remaining: number
  readonly startedAt: number
  readonly dismissReason: ToastDismissReason | null
  readonly swiping: boolean
  /** The release direction of the last swipe (`data-swipe-direction`). */
  readonly swipeDirection: SwipeDirection | null
  readonly height: number
}

export type ToastEnv = SchedulerEnv & ClockEnv & AnnouncerEnv & LocaleEnv

const durationOf = (data: ToastData, props: ToastProps) => data.duration ?? props.duration

const DISMISS: Partial<Record<ToastEvent["type"], ToastDismissReason>> = {
  CLOSE_TRIGGER_PRESS: "close-trigger",
  ACTION_PRESS: "action",
  ESCAPE_KEY: "escape-key",
  SWIPE: "swipe",
  TIMEOUT: "timeout",
  DISMISS: "api",
}

const without = (set: ReadonlySet<ToastPauseReason>, r: ToastPauseReason) => {
  const next = new Set(set)
  next.delete(r)
  return next
}

/**
 * What every shown state does the same way: the user's dismissals (unless the toast is not
 * dismissible), the action, the swipe release and the api dismissal.
 */
const LIVE = {
  CLOSE_TRIGGER_PRESS: {
    guard: "dismissible",
    target: "dismissed",
    actions: ["setDismissReason"],
  },
  ESCAPE_KEY: { guard: "dismissible", target: "dismissed", actions: ["setDismissReason"] },
  ACTION_PRESS: [
    { guard: "actionCloses", target: "dismissed", actions: ["runAction", "setDismissReason"] },
    { actions: ["runAction"] },
  ],
  SWIPE: [
    { guard: "swipeDismisses", target: "dismissed", actions: ["endSwipe", "setDismissReason"] },
    { actions: ["endSwipe"] },
  ],
  DISMISS: { target: "dismissed", actions: ["setDismissReason"] },
} as const

export const toastMachine = setup({
  types: type<{ props: ToastProps; events: ToastEvent; env: ToastEnv; context: ToastContext }>(),
  guards: {
    isPersistent: ({ context }) => isPersistentToast(context.data),
    updatesToPersistent: ({ event }) => event.type === "UPDATE" && isPersistentToast(event.data),
    hasReasons: ({ context }) => context.reasons.size > 0,
    /** RESUME removes the last reason. */
    lastReason: ({ context, event }) =>
      event.type === "RESUME" && context.reasons.size === 1 && context.reasons.has(event.reason),
    dismissible: ({ context }) => context.data.dismissible !== false,
    /** The action closes unless it says otherwise. */
    actionCloses: ({ context }) => context.data.action?.closes !== false,
    swipeDismisses: ({ context, event, props }) => {
      if (event.type !== "SWIPE" || context.data.dismissible === false) return false
      if (event.direction === null || !props.swipeDirections.includes(event.direction)) return false
      return (
        event.offset >= (props.swipeThreshold ?? 45) ||
        event.velocity >= (props.swipeVelocity ?? 0.11)
      )
    },
  },
  actions: {
    addReason: ({ context, event, set }) => {
      if (event.type !== "PAUSE" || context.reasons.has(event.reason)) return
      set("reasons", new Set([...context.reasons, event.reason]))
    },
    removeReason: ({ context, event, set }) => {
      if (event.type === "RESUME") set("reasons", without(context.reasons, event.reason))
    },
    /** Leaving timing: what has elapsed comes off the remaining time. */
    captureRemaining: ({ context, env, set }) =>
      set("remaining", Math.max(0, context.remaining - (env.clock.now() - context.startedAt))),
    startClock: ({ env, set }) => set("startedAt", env.clock.now()),
    /** An update: the new data, its full lifetime from now. */
    applyUpdate: ({ env, event, props, set }) => {
      if (event.type !== "UPDATE") return
      set("data", event.data)
      set("remaining", durationOf(event.data, props))
      set("startedAt", env.clock.now())
    },
    /** One announcement per show (keyed by id: a pending one for the toast is replaced). */
    announce: ({ context, env, props }) => announce(context.data, props, env),
    /** An update that changes what is said is said again. */
    announceUpdate: ({ context, env, event, props }) => {
      if (event.type !== "UPDATE") return
      const was = context.data
      const next = event.data
      if (
        was.title === next.title &&
        was.description === next.description &&
        was.type === next.type
      ) {
        return
      }
      announce(next, props, env)
    },
    setDismissReason: ({ event, set }) => {
      const reason = DISMISS[event.type]
      if (reason) set("dismissReason", reason)
    },
    /** Dismissal clears every reason it held (no reason outlives its condition). */
    clearReasons: ({ set }) => set("reasons", new Set()),
    runAction: ({ context }) => context.data.action?.onAction(),
    notifyDismissed: ({ context, props }) => {
      const reason = context.dismissReason ?? "api"
      context.data.onDismiss?.(reason)
      props.onDismissed?.(reason)
    },
    startSwipe: ({ set }) => set("swiping", true),
    endSwipe: ({ event, set }) => {
      set("swiping", false)
      if (event.type === "SWIPE") set("swipeDirection", event.direction)
    },
    setHeight: ({ event, set }) => {
      if (event.type === "MEASURED") set("height", event.height)
    },
  },
  effects: {
    /** The remaining time on the injected scheduler; `TIMEOUT` when it elapses. */
    lifetime: ({ context, env, send }) => {
      const timer = env.scheduler.setTimeout(() => send({ type: "TIMEOUT" }), context.remaining)
      return () => env.scheduler.clearTimeout(timer)
    },
  },
}).machine({
  id: "toast",
  initial: "idle",
  context: (props) => ({
    data: props.data,
    reasons: new Set(),
    remaining: durationOf(props.data, props),
    startedAt: 0,
    dismissReason: null,
    swiping: false,
    swipeDirection: null,
    height: 0,
  }),
  on: {
    "SWIPE.START": { actions: ["startSwipe"] },
    "SWIPE.CANCEL": { actions: ["endSwipe"] },
    MEASURED: { actions: ["setHeight"] },
  },
  states: {
    idle: {
      on: {
        PAUSE: { actions: ["addReason"] },
        RESUME: { actions: ["removeReason"] },
        UPDATE: { actions: ["applyUpdate"] },
        START: [
          { guard: "isPersistent", target: "persistent", actions: ["announce"] },
          { guard: "hasReasons", target: "paused", actions: ["announce"] },
          { target: "timing", actions: ["announce"] },
        ],
        DISMISS: { target: "dismissed", actions: ["setDismissReason"] },
      },
    },
    timing: {
      entry: ["startClock"],
      exit: ["captureRemaining"],
      effects: ["lifetime"],
      on: {
        ...LIVE,
        PAUSE: { target: "paused", actions: ["addReason"] },
        TIMEOUT: { target: "dismissed", actions: ["setDismissReason"] },
        UPDATE: [
          {
            guard: "updatesToPersistent",
            target: "persistent",
            actions: ["announceUpdate", "applyUpdate"],
          },
          { target: "timing", reenter: true, actions: ["announceUpdate", "applyUpdate"] },
        ],
      },
    },
    paused: {
      on: {
        ...LIVE,
        PAUSE: { actions: ["addReason"] },
        RESUME: [
          { guard: "lastReason", target: "timing", actions: ["removeReason"] },
          { actions: ["removeReason"] },
        ],
        UPDATE: [
          {
            guard: "updatesToPersistent",
            target: "persistent",
            actions: ["announceUpdate", "applyUpdate"],
          },
          { actions: ["announceUpdate", "applyUpdate"] },
        ],
      },
    },
    persistent: {
      on: {
        ...LIVE,
        PAUSE: { actions: ["addReason"] },
        RESUME: { actions: ["removeReason"] },
        UPDATE: [
          { guard: "updatesToPersistent", actions: ["announceUpdate", "applyUpdate"] },
          // Finite again: paused while reasons hold, else timing from now (radix#2233).
          {
            guard: "hasReasons",
            target: "paused",
            actions: ["announceUpdate", "applyUpdate"],
          },
          { target: "timing", actions: ["announceUpdate", "applyUpdate"] },
        ],
      },
    },
    dismissed: {
      entry: ["clearReasons", "notifyDismissed"],
    },
  },
})

function announce(data: ToastData, props: ToastProps, env: ToastEnv) {
  const message = toastAnnouncement(data, props.messages ?? toastMessages, props.hotkey)
  if (!message) return
  env.announcer.announce({
    message,
    priority: data.type === "error" ? "assertive" : "polite",
    key: `toast-${data.id}`,
    lang: env.locale.locale(),
  })
}

export type ToastMachine = typeof toastMachine
