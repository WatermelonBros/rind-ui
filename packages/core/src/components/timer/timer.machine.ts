// Timer (add-timer design §1–§6): idle, running, paused, completed. The value is derived from
// the injected monotonic clock, never accumulated from ticks, so a late or missed tick (a
// background tab) costs no time (zag#2226, ark#3298). One tick is pending at a time, owned by
// `running` (zag#2335), at the next interval boundary of the elapsed time.

import type {
  AnnouncerEnv,
  ClockEnv,
  LocaleEnv,
  SchedulerEnv,
  VisibilityEnv,
} from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import { type TimerTime, toTime } from "./timer.format"
import { type TimerMessages, timerMessages } from "./timer.messages"

export type TimerState = "idle" | "running" | "paused" | "completed"

export type TimerAction = "start" | "pause" | "resume" | "reset" | "restart" | "toggle"

export type TimerEvent =
  | { readonly type: "START" }
  | { readonly type: "PAUSE" }
  | { readonly type: "RESUME" }
  | { readonly type: "RESET" }
  | { readonly type: "RESTART" }
  | { readonly type: "TOGGLE" }
  /** A tick, the completion timeout or the page becoming visible: recompute from the clock. */
  | { readonly type: "TICK" }
  /** `startMs`, `targetMs` or `countdown` changed. */
  | { readonly type: "CONFIG" }
  /** `interval` changed: reschedule the pending tick. */
  | { readonly type: "INTERVAL" }

export interface TimerTickDetails {
  /** The value in ms (not rounded). */
  readonly value: number
  /** The displayed time (rounded toward the start). */
  readonly time: TimerTime
}

export interface TimerProps {
  /** Count down from `startMs` to `targetMs` (default 0) instead of up. */
  readonly countdown?: boolean | undefined
  /** Where the timer starts, in ms (default 0). */
  readonly startMs?: number | undefined
  /** Where it completes, in ms. A countdown defaults to 0; a stopwatch without it never completes. */
  readonly targetMs?: number | undefined
  /** Start running on mount. */
  readonly autoStart?: boolean | undefined
  /** The display granularity and tick period, in ms (default 1000). */
  readonly interval?: number | undefined
  readonly messages?: TimerMessages | undefined
  /** For the announcement's key. */
  readonly id: string
  /** The announcement's language (the Root's `locale`); the environment's by default. */
  readonly lang?: string | undefined
  readonly onTick?: ((details: TimerTickDetails) => void) | undefined
  readonly onComplete?: (() => void) | undefined
  readonly onStateChange?: ((state: TimerState) => void) | undefined
}

export interface TimerContext {
  /** The value when the current run started (ms). */
  readonly base: number
  /** `clock.now()` when the current run started. */
  readonly startedAt: number
  /** The last computed value (ms). */
  readonly value: number
  /** The state last reported to `onStateChange` (a re-entered `running` is no change). */
  readonly reported: TimerState
}

export type TimerEnv = SchedulerEnv & ClockEnv & AnnouncerEnv & LocaleEnv & VisibilityEnv

export const DEFAULT_TIMER_INTERVAL = 1000

/** The configuration after normalisation (design §6). */
export interface TimerConfig {
  readonly countdown: boolean
  readonly start: number
  /** `null`: a stopwatch without a target. */
  readonly target: number | null
  readonly interval: number
}

declare const process: { env: { NODE_ENV?: string } }

const warned = new Set<string>()
function warnOnce(key: string, message: string) {
  if (process.env.NODE_ENV === "production" || warned.has(key)) return
  warned.add(key)
  console.warn(`[rind-ui/timer] ${message}`)
}

const finite = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n)

/** Invalid values are clamped or dropped, with one development warning each (never thrown). */
export function timerConfig(props: TimerProps): TimerConfig {
  const countdown = props.countdown === true
  let start = finite(props.startMs) ? props.startMs : 0
  if (start < 0) {
    warnOnce("start", `startMs ${start} is negative: 0 is used.`)
    start = 0
  }
  let interval = finite(props.interval) ? props.interval : DEFAULT_TIMER_INTERVAL
  if (interval <= 0) {
    warnOnce("interval", `interval ${interval} is not positive: ${DEFAULT_TIMER_INTERVAL} is used.`)
    interval = DEFAULT_TIMER_INTERVAL
  }
  let target: number | null = finite(props.targetMs) ? Math.max(0, props.targetMs) : null
  if (countdown) {
    target ??= 0
    if (target >= start) {
      warnOnce(
        "countdown",
        `a countdown's startMs (${start}) must be above its targetMs (${target}): the target is ignored.`,
      )
      target = 0
    }
  } else if (target !== null && target <= start) {
    warnOnce(
      "stopwatch",
      `a stopwatch's startMs (${start}) must be below its targetMs (${target}): the target is ignored.`,
    )
    target = null
  }
  return { countdown, start, target, interval }
}

/** The value at `now` for a run that started at `startedAt` from `base`, clamped (design §1). */
export function timerValueAt(config: TimerConfig, base: number, startedAt: number, now: number) {
  const elapsed = Math.max(0, now - startedAt)
  if (config.countdown) return Math.max(config.target ?? 0, base - elapsed)
  const value = base + elapsed
  return config.target === null ? value : Math.min(config.target, value)
}

/** The value is at or past the target (`<=` / `>=`: zag#2254). */
export function timerReached(config: TimerConfig, value: number) {
  if (config.target === null) return false
  return config.countdown ? value <= config.target : value >= config.target
}

/** The displayed value: rounded toward the start to the interval (design §3). */
export function timerDisplayed(config: TimerConfig, value: number) {
  const steps = value / config.interval
  return (config.countdown ? Math.ceil(steps) : Math.floor(steps)) * config.interval
}

/** 0–1 from start to target; 0 without a target. */
export function timerProgress(config: TimerConfig, value: number) {
  if (config.target === null || config.target === config.start) return 0
  const p = (value - config.start) / (config.target - config.start)
  return Math.min(1, Math.max(0, p))
}

const now = (env: TimerEnv) => env.clock.now()

type Report = (a: {
  readonly context: TimerContext
  readonly props: TimerProps
  readonly set: (key: "reported", value: TimerState) => void
}) => void
const report =
  (state: TimerState): Report =>
  ({ context, props, set }) => {
    if (context.reported === state) return
    set("reported", state)
    props.onStateChange?.(state)
  }
const reporters = {
  enterIdle: report("idle"),
  enterRunning: report("running"),
  enterPaused: report("paused"),
  enterCompleted: report("completed"),
}
const current = (context: TimerContext, props: TimerProps, env: TimerEnv) =>
  timerValueAt(timerConfig(props), context.base, context.startedAt, now(env))

export const timerMachine = /* @__PURE__ */ setup({
  types: type<{ props: TimerProps; events: TimerEvent; env: TimerEnv; context: TimerContext }>(),
  guards: {
    reached: ({ context, props, env }) =>
      timerReached(timerConfig(props), current(context, props, env)),
  },
  actions: {
    ...reporters,
    /** A run starts from the current value. */
    run: ({ context, env, set }) => {
      set("base", context.value)
      set("startedAt", now(env))
    },
    /** A run starts from the start. */
    runFromStart: ({ env, props, set }) => {
      const start = timerConfig(props).start
      set("base", start)
      set("value", start)
      set("startedAt", now(env))
    },
    toStart: ({ props, set }) => set("value", timerConfig(props).start),
    /** Leaving `running`: the time so far is kept. */
    capture: ({ context, env, props, set }) => set("value", current(context, props, env)),
    recompute: ({ context, env, props, set }) => set("value", current(context, props, env)),
    finish: ({ props, set }) => {
      const config = timerConfig(props)
      set("value", config.target ?? config.start)
    },
    notifyTick: ({ context, props }) => {
      const config = timerConfig(props)
      props.onTick?.({
        value: context.value,
        time: toTime(timerDisplayed(config, context.value)),
      })
    },
    notifyComplete: ({ env, props }) => {
      props.onComplete?.()
      env.announcer.announce({
        message: (props.messages ?? timerMessages).completed,
        priority: "polite",
        key: `timer-${props.id}`,
        lang: props.lang ?? env.locale.locale(),
      })
    },
  },
  effects: {
    /**
     * The next tick at the value's next interval boundary (design §2), or the target when it
     * comes first. Re-entered by every tick.
     */
    ticking: ({ context, env, props, send }) => {
      const config = timerConfig(props)
      const value = timerValueAt(config, context.base, context.startedAt, now(env))
      // The next value boundary in the counting direction: the display changes on it.
      const into = value % config.interval
      let wait = config.countdown ? into || config.interval : config.interval - into
      if (config.target !== null) wait = Math.min(wait, Math.abs(value - config.target))
      const handle = env.scheduler.setTimeout(() => send({ type: "TICK" }), wait)
      return () => env.scheduler.clearTimeout(handle)
    },
    /** `autoStart`: running from the moment the service starts. */
    autoStart: ({ props, send }) => {
      if (props.autoStart === true) send({ type: "START" })
      return undefined
    },
    /** Coming back to the page recomputes at once: a throttled timeout may still be pending. */
    catchUp: ({ env, send }) =>
      env.visibility.subscribe((hidden) => {
        if (!hidden) send({ type: "TICK" })
      }),
  },
}).machine({
  id: "timer",
  initial: "idle",
  context: (props) => {
    const start = timerConfig(props).start
    return { base: start, startedAt: 0, value: start, reported: "idle" }
  },
  effects: ["autoStart"],
  onProps: {
    startMs: "CONFIG",
    targetMs: "CONFIG",
    countdown: "CONFIG",
    interval: "INTERVAL",
  },
  on: {
    RESET: { target: "idle", actions: ["toStart"] },
    RESTART: { target: "running", reenter: true, actions: ["runFromStart"] },
  },
  states: {
    idle: {
      entry: ["enterIdle"],
      on: {
        START: { target: "running", actions: ["run"] },
        TOGGLE: { target: "running", actions: ["run"] },
        CONFIG: { actions: ["toStart"] },
      },
    },
    running: {
      entry: ["enterRunning"],
      effects: ["ticking", "catchUp"],
      on: {
        PAUSE: { target: "paused", actions: ["capture"] },
        TOGGLE: { target: "paused", actions: ["capture"] },
        TICK: [
          { guard: "reached", target: "completed", actions: ["finish", "notifyComplete"] },
          { target: "running", reenter: true, actions: ["recompute", "notifyTick"] },
        ],
        CONFIG: { target: "running", reenter: true, actions: ["runFromStart"] },
        INTERVAL: { target: "running", reenter: true, actions: ["capture", "run"] },
      },
    },
    paused: {
      entry: ["enterPaused"],
      on: {
        RESUME: { target: "running", actions: ["run"] },
        TOGGLE: { target: "running", actions: ["run"] },
        CONFIG: { actions: ["toStart"] },
      },
    },
    completed: {
      entry: ["enterCompleted"],
      on: {
        TOGGLE: { target: "running", actions: ["runFromStart"] },
        CONFIG: { target: "idle", actions: ["toStart"] },
      },
    },
  },
})

export type TimerMachine = typeof timerMachine

/** Whether `action` does something in `state` (design §5): the trigger is disabled otherwise. */
export function timerActionApplies(action: TimerAction, state: TimerState): boolean {
  switch (action) {
    case "start":
      return state === "idle"
    case "pause":
      return state === "running"
    case "resume":
      return state === "paused"
    case "reset":
    case "restart":
    case "toggle":
      return true
  }
}

/** The machine event for an action. */
export const timerActionEvent = (action: TimerAction): TimerEvent => ({
  // Sound: every TimerAction upper-cased is one of TimerEvent's bare event types.
  type: action.toUpperCase() as Uppercase<TimerAction>,
})
