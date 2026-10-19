// Reasoning (add-reasoning design §2): a disclosure with a thinking lifecycle. Only live
// thinking opens or closes it by itself (an old message, mounted done, never toggles), the
// user's toggle wins for good, and the auto-close never hides focus.

import type { AnnouncerEnv, ClockEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import type { ReasoningMessages } from "./reasoning.messages"

export type ReasoningEvent =
  /** Sent once on start: takes the state from the prop, no automatic toggle. */
  | { readonly type: "MOUNT" }
  /** `thinking` changed (onProps). */
  | { readonly type: "THINKING.SYNCED" }
  /** The user pressed the Trigger. */
  | { readonly type: "TOGGLE" }

export interface ReasoningProps {
  readonly id: string
  /** The model is thinking (the runtime's streaming flag for the reasoning part). */
  readonly thinking: boolean
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<ReasoningEvent>) => void)
    | undefined
  /** The runtime's duration, in seconds. */
  readonly duration?: number | undefined
  /** Delay before the automatic close, in ms (default 1000). */
  readonly autoCloseDelay?: number | undefined
  /** Announce the start and the end (default true). */
  readonly announce?: boolean | undefined
  readonly messages: ReasoningMessages
  readonly lang?: string | undefined
}

/** What the machine reaches the DOM through (injected; absent in Node). */
export interface ReasoningEnv {
  /** Focus is inside the Content: an automatic close would drop it. */
  readonly focusInside?: (() => boolean) | undefined
}

export interface ReasoningContext {
  /** The user toggled: nothing toggles automatically again. */
  readonly userToggled: boolean
  /** Clock time of the live start, or null. */
  readonly startedAt: number | null
  /** Measured seconds, or null. */
  readonly measured: number | null
}

type Types = {
  props: ReasoningProps
  events: ReasoningEvent
  env: AnnouncerEnv & SchedulerEnv & ClockEnv & ReasoningEnv
  context: ReasoningContext
  values: "open"
}
type Args = ActionArgs<Types>

/** The duration shown and announced: the runtime's, else the measured one, else unknown. */
export const reasoningDuration = (props: ReasoningProps, context: ReasoningContext) =>
  props.duration ?? context.measured

function say(args: Args, message: string) {
  if (args.props.announce === false) return
  args.env.announcer.announce({
    message,
    priority: "polite",
    key: `reasoning-${args.props.id}`,
    ...(args.props.lang === undefined ? {} : { lang: args.props.lang }),
  })
}

export const reasoningMachine = setup({
  types: type<Types>(),
  guards: {
    thinkingProp: ({ props }) => props.thinking,
    doneProp: ({ props }) => !props.thinking,
    mayAutoClose: ({ context, env }) => !context.userToggled && env.focusInside?.() !== true,
  },
  actions: {
    start: (args) => {
      args.set("startedAt", args.env.clock.now())
      args.set("measured", null)
      if (!args.context.userToggled) args.set("open", true)
      say(args, args.props.messages.thinking)
    },
    end: (args) => {
      const { context, env, set, props } = args
      if (context.startedAt !== null) {
        set("measured", Math.max(1, Math.ceil((env.clock.now() - context.startedAt) / 1000)))
      }
      say(args, props.messages.thought(reasoningDuration(props, args.context), props.lang ?? "en"))
    },
    toggle: ({ set, values }) => {
      set("userToggled", true)
      set("open", !values.open)
    },
    autoClose: ({ set }) => set("open", false),
  },
  delays: { autoClose: ({ props }) => props.autoCloseDelay ?? 1000 },
  effects: {
    mount: ({ send }) => {
      send({ type: "MOUNT" })
      return undefined
    },
  },
}).machine({
  id: "reasoning",
  initial: "done",
  context: () => ({ userToggled: false, startedAt: null, measured: null }),
  values: { open: { fallback: false } },
  onProps: { thinking: "THINKING.SYNCED" },
  effects: ["mount"],
  on: {
    TOGGLE: { actions: ["toggle"], reason: "trigger" },
  },
  states: {
    done: {
      on: {
        // Mounting while thinking is a live start (a chat mounts the reasoning when the stream
        // begins); mounting done is an old message and never toggles (AI Elements #86).
        MOUNT: { guard: "thinkingProp", target: "thinking", actions: ["start"], reason: "auto" },
        "THINKING.SYNCED": {
          guard: "thinkingProp",
          target: "thinking",
          actions: ["start"],
          reason: "auto",
        },
      },
    },
    thinking: {
      on: {
        "THINKING.SYNCED": { guard: "doneProp", target: "closing", actions: ["end"] },
      },
    },
    /** Done, with an automatic close pending. */
    closing: {
      after: {
        autoClose: [
          { guard: "mayAutoClose", target: "done", actions: ["autoClose"], reason: "auto" },
          { target: "done" },
        ],
      },
      on: {
        // The user's toggle cancels the pending close.
        TOGGLE: { target: "done", actions: ["toggle"], reason: "trigger" },
        "THINKING.SYNCED": {
          guard: "thinkingProp",
          target: "thinking",
          actions: ["start"],
          reason: "auto",
        },
      },
    },
  },
})

export type ReasoningMachine = typeof reasoningMachine
