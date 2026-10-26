// Streaming Message (add-streaming-message design §2, §3): the consumer's `text` and `status`
// arrive as prop changes (SYNC); a smooth reveal advances on Scheduler ticks (TICK, 16 ms);
// the lifecycle is announced, never a chunk. SYNC adjusts what is shown, then SETTLE picks the
// state from `status` and the reveal.

import { splitSentences } from "../../a11y/stream"
import type { AnnouncerEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs } from "../../machine/types"
import type { StreamingMessageMessages } from "./streaming-message.messages"

export type StreamingStatus = "pending" | "streaming" | "complete" | "cancelled" | "error"
export type StreamingAnnounce = "status" | "text" | "sentences" | "none"

export interface StreamingSmooth {
  /** Time to drain the unrevealed backlog, in ms (default 250). */
  readonly drainMs?: number | undefined
  /** The slowest pace, in ms per character (default 5). */
  readonly maxCharIntervalMs?: number | undefined
}

export type StreamingMessageEvent =
  /** `text` or `status` changed (onProps), and once on start. */
  | { readonly type: "SYNC" }
  /** Internal: routes to the state `status` and the reveal imply. */
  | { readonly type: "SETTLE" }
  /** Sent on mount, then on every change of the Environment's MotionPreference. */
  | { readonly type: "MOTION.CHANGED"; readonly reduced: boolean }

export interface StreamingMessageProps {
  /** The instance id (the announcements' key). */
  readonly id: string
  /** Everything received so far. */
  readonly text: string
  readonly status: StreamingStatus
  /** Smooth reveal while streaming (default true); off under reduced motion. */
  readonly smooth?: boolean | StreamingSmooth | undefined
  /** What is announced (default "status": the lifecycle only). */
  readonly announce?: StreamingAnnounce | undefined
  readonly messages: StreamingMessageMessages
  readonly lang?: string | undefined
}

export interface StreamingMessageContext {
  /** Characters revealed while the smooth reveal runs. */
  readonly shown: number
  /** False on the server and the client alike until the first MOTION.CHANGED. */
  readonly reduced: boolean
  /** A start was announced; completion is announced only after one. */
  readonly started: boolean
  /** Mounted before its final status (pending or streaming): its live outcome is announced. */
  readonly live: boolean
  /** Characters already announced in sentence mode. */
  readonly spoken: number
  /** Characters per tick, set when a chunk arrives (`revealStep` of the backlog then). */
  readonly rate: number
}

type Types = {
  props: StreamingMessageProps
  events: StreamingMessageEvent
  env: AnnouncerEnv & SchedulerEnv
  context: StreamingMessageContext
}
type Args = ActionArgs<Types>

/** One reveal tick, in ms. */
export const REVEAL_TICK_MS = 16

/**
 * The pace, in characters per tick, set when a chunk arrives: fast enough to drain `backlog`
 * in `drainMs` (a linear drain, not a decay that never ends), never slower than one character
 * per `maxCharIntervalMs`, never more than the backlog.
 */
export function revealStep(backlog: number, smooth: StreamingSmooth = {}): number {
  if (backlog <= 0) return 0
  const floor = Math.max(1, Math.floor(REVEAL_TICK_MS / (smooth.maxCharIntervalMs ?? 5)))
  const drain = Math.ceil((backlog * REVEAL_TICK_MS) / (smooth.drainMs ?? 250))
  return Math.min(backlog, Math.max(floor, drain))
}

const smoothOf = (props: StreamingMessageProps): StreamingSmooth | null =>
  props.smooth === false
    ? null
    : props.smooth === true || props.smooth === undefined
      ? {}
      : props.smooth

/** The reveal runs: smooth requested, motion allowed. */
export const revealOn = (props: StreamingMessageProps, context: StreamingMessageContext) =>
  smoothOf(props) !== null && !context.reduced

/** What the Content shows in `state`. */
export function displayedText(
  state: string,
  props: StreamingMessageProps,
  context: StreamingMessageContext,
): string {
  const revealing = (state === "streaming" || state === "settling") && revealOn(props, context)
  return revealing ? props.text.slice(0, context.shown) : props.text
}

const mode = (props: StreamingMessageProps) => props.announce ?? "status"

function say(args: Args, message: string, keyed = true) {
  const m = message.trim()
  if (!m) return
  const { env, props } = args
  env.announcer.announce({
    message: m,
    priority: "polite",
    ...(keyed ? { key: `streaming-message-${props.id}` } : {}),
    ...(props.lang === undefined ? {} : { lang: props.lang }),
  })
}

/** Sentence mode: every complete sentence not yet spoken (all of them when `final`). */
function speakSentences(args: Args, final: boolean) {
  const { props, context, set } = args
  const rest = props.text.slice(context.spoken)
  const parts = splitSentences(props.lang ?? "en", rest)
  const complete = final ? parts : parts.slice(0, -1)
  let spoken = context.spoken
  for (const part of complete) {
    say(args, part, false)
    spoken += part.length
  }
  set("spoken", spoken)
}

export const streamingMessageMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    cancelled: ({ props }) => props.status === "cancelled",
    failed: ({ props }) => props.status === "error",
    catchingUp: ({ props, context }) =>
      props.status === "complete" && revealOn(props, context) && context.shown < props.text.length,
    complete: ({ props }) => props.status === "complete",
    streaming: ({ props }) => props.status === "streaming",
    backlog: ({ props, context }) => revealOn(props, context) && context.shown < props.text.length,
  },
  actions: {
    /** A rewrite that is not an extension restarts the reveal (or shows all, reveal off). */
    track: (args) => {
      const { props, context, set } = args
      const text = props.text
      if (context.shown > text.length || !revealOn(props, context)) {
        set("shown", revealOn(props, context) ? 0 : text.length)
      }
      if (context.spoken > text.length) set("spoken", 0)
      // Read back: the writes above are visible to later reads in this action.
      const shown = args.context.shown
      set("rate", revealStep(text.length - shown, smoothOf(props) ?? {}))
    },
    settle: ({ send }) => send({ type: "SETTLE" }),
    motion: ({ event, set }) => {
      if (event.type === "MOTION.CHANGED") set("reduced", event.reduced)
    },
    reveal: ({ props, context, set }) => {
      const backlog = props.text.length - context.shown
      set("shown", context.shown + Math.min(backlog, Math.max(1, context.rate)))
    },
    showAll: ({ props, set }) => set("shown", props.text.length),
    announceStart: (args) => {
      if (args.context.started) return
      args.set("started", true)
      if (mode(args.props) === "status") say(args, args.props.messages.started)
    },
    announceProgress: (args) => {
      if (mode(args.props) === "sentences" && args.context.started) speakSentences(args, false)
    },
    // Only a message that mounts in its final state stays silent: one that went final
    // without streaming (a cached reply, an error before the first token) is announced.
    announceComplete: (args) => {
      if (!args.context.started && !args.context.live) return
      const m = mode(args.props)
      if (m === "status") say(args, args.props.messages.completed)
      else if (m === "text") say(args, args.props.text)
      else if (m === "sentences") speakSentences(args, true)
    },
    announceCancelled: (args) => {
      if (!args.context.started && !args.context.live) return
      if (mode(args.props) === "status") say(args, args.props.messages.cancelled)
      else if (mode(args.props) !== "none")
        args.env.announcer.cancel(`streaming-message-${args.props.id}`)
    },
    announceFailed: (args) => {
      if ((args.context.started || args.context.live) && mode(args.props) !== "none")
        say(args, args.props.messages.failed)
    },
  },
  delays: { tick: () => REVEAL_TICK_MS },
  effects: {
    sync: ({ send }) => {
      send({ type: "SYNC" })
      return undefined
    },
  },
}).machine({
  id: "streaming-message",
  initial: "pending",
  // Text present at mount is never revealed again (hydration, a reloaded thread).
  context: (props) => ({
    shown: props.text.length,
    reduced: false,
    started: false,
    live: props.status === "pending" || props.status === "streaming",
    spoken: props.status === "streaming" ? 0 : props.text.length,
    rate: 0,
  }),
  onProps: { text: "SYNC", status: "SYNC", smooth: "SYNC" },
  effects: ["sync"],
  on: {
    SYNC: { actions: ["track", "settle"] },
    "MOTION.CHANGED": { actions: ["motion", "track", "settle"] },
    SETTLE: [
      { guard: "cancelled", target: "cancelled", actions: ["showAll"] },
      { guard: "failed", target: "error", actions: ["showAll"] },
      { guard: "catchingUp", target: "settling" },
      { guard: "complete", target: "complete", actions: ["showAll"] },
      // reenter: a new chunk re-arms the reveal's tick.
      { guard: "streaming", target: "streaming", reenter: true, actions: ["announceProgress"] },
      { target: "pending" },
    ],
  },
  states: {
    pending: {},
    streaming: {
      entry: ["announceStart"],
      after: {
        tick: { guard: "backlog", target: "streaming", reenter: true, actions: ["reveal"] },
      },
    },
    settling: {
      after: {
        tick: [
          { guard: "backlog", target: "settling", reenter: true, actions: ["reveal", "settle"] },
          { target: "complete" },
        ],
      },
    },
    complete: { entry: ["announceComplete"] },
    cancelled: { entry: ["announceCancelled"] },
    error: { entry: ["announceFailed"] },
  },
})

export type StreamingMessageMachine = typeof streamingMessageMachine
