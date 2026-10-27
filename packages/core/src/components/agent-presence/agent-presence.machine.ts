// Agent Presence (add-agent-presence design §1, §2): the state is the consumer's prop, any to
// any (livekit/agents#3007); the machine adds the announcements (never for speaking or the
// level), the delayed "thinking", and staleness (a stuck state: livekit/agents#8027).

import type {
  AnnouncerEnv,
  ClockEnv,
  LocaleEnv,
  SchedulerEnv,
  TimerHandle,
} from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs } from "../../machine/types"
import { type AgentPresenceMessages, agentPresenceMessages } from "./agent-presence.messages"

export type AgentState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error"

export type AgentPresenceEvent =
  | { readonly type: "STATE" }
  | { readonly type: "THINKING.ELAPSED" }
  | { readonly type: "STALE" }

export interface AgentPresenceProps {
  readonly state: AgentState
  /** For `error`: why. */
  readonly reason?: string | undefined
  readonly muted?: boolean | undefined
  /** Default "polite" (an error is always assertive unless "off"). */
  readonly announce?: "off" | "polite" | undefined
  /** ms a think must last before it is announced (default 1500). */
  readonly thinkingDelay?: number | undefined
  /** ms after which a state is stale. */
  readonly staleAfter?: Partial<Record<AgentState, number>> | undefined
  readonly onStale?: ((state: AgentState) => void) | undefined
  readonly onStateChange?: ((state: AgentState, details: { from: AgentState }) => void) | undefined
  readonly messages?: AgentPresenceMessages | undefined
  readonly id: string
  readonly lang?: string | undefined
}

export interface AgentPresenceContext {
  readonly current: AgentState
  readonly previous: AgentState | null
  readonly stale: boolean
  /** A `listening` was reached since the last `idle` (a session is on). */
  readonly connected: boolean
}

type Types = {
  props: AgentPresenceProps
  events: AgentPresenceEvent
  env: AnnouncerEnv & ClockEnv & LocaleEnv & SchedulerEnv
  context: AgentPresenceContext
}
type Args = ActionArgs<Types>

const messagesOf = (p: AgentPresenceProps) => p.messages ?? agentPresenceMessages

function say(args: Args, message: string, priority: "polite" | "assertive") {
  if (args.props.announce === "off") return
  args.env.announcer.announce({
    message,
    priority,
    key: `agent-presence-${args.props.id}`,
    lang: args.props.lang ?? args.env.locale.locale(),
  })
}

export const agentPresenceMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  actions: {
    change: (args) => {
      const { context, props, set } = args
      const next = props.state
      const from = context.current
      if (next === from) return
      set("current", next)
      set("previous", from)
      set("stale", false)
      props.onStateChange?.(next, { from })
      const m = messagesOf(props)
      if (next === "listening" && !context.connected) {
        set("connected", true)
        say(args, m.listening, "polite")
      } else if (next === "idle" && context.connected) {
        set("connected", false)
        say(args, m.ended, "polite")
      } else if (next === "error") {
        say(args, m.error(props.reason), "assertive")
      }
    },
    thinkingElapsed: (args) => {
      if (args.context.current === "thinking") say(args, messagesOf(args.props).thinking, "polite")
    },
    stale: ({ context, props, set }) => {
      if (context.stale) return
      set("stale", true)
      props.onStale?.(context.current)
    },
  },
  effects: {
    /** The current state's timers: the delayed think and staleness. Re-run on each change. */
    timers: ({ context, env, props, send }) => {
      const handles: TimerHandle[] = []
      if (context.current === "thinking") {
        handles.push(
          env.scheduler.setTimeout(
            () => send({ type: "THINKING.ELAPSED" }),
            props.thinkingDelay ?? 1500,
          ),
        )
      }
      const after = props.staleAfter?.[context.current]
      if (after !== undefined && Number.isFinite(after)) {
        handles.push(env.scheduler.setTimeout(() => send({ type: "STALE" }), after))
      }
      return () => {
        for (const h of handles) env.scheduler.clearTimeout(h)
      }
    },
  },
}).machine({
  id: "agent-presence",
  initial: "live",
  context: (props) => ({
    current: props.state,
    previous: null,
    stale: false,
    connected:
      props.state === "listening" || props.state === "thinking" || props.state === "speaking",
  }),
  onProps: { state: "STATE" },
  on: {
    "THINKING.ELAPSED": { actions: ["thinkingElapsed"] },
    STALE: { actions: ["stale"] },
  },
  states: {
    live: {
      effects: ["timers"],
      on: { STATE: { target: "live", reenter: true, actions: ["change"] } },
    },
  },
})

export type AgentPresenceMachine = typeof agentPresenceMachine
