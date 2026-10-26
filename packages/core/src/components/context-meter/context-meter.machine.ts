// Context Meter (add-context-meter design §1, §2): the state is a pure function of the props;
// the machine adds the announcements: a rising crossing into warning, full or over is said
// once, the stream of values is silent, and a new thread (resetKey) re-arms.

import type { AnnouncerEnv, LocaleEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import { type ContextMeterMessages, contextMeterMessages } from "./context-meter.messages"

export type ContextMeterState = "ok" | "warning" | "full" | "over" | "unknown"
export type ContextMeterLevel = "warning" | "full" | "over"

export interface ContextMeterProps {
  readonly used: number
  /** The window size; null or non-positive: unknown. */
  readonly max: number | null
  /** Default 0.75. */
  readonly warnAt?: number | undefined
  /** Default 0.95. */
  readonly fullAt?: number | undefined
  /** Default "polite". */
  readonly announce?: "off" | "polite" | undefined
  /** A new value (a new thread) re-arms every threshold. */
  readonly resetKey?: string | undefined
  readonly onThreshold?: ((level: ContextMeterLevel) => void) | undefined
  readonly messages?: ContextMeterMessages | undefined
  readonly id: string
  readonly lang?: string | undefined
}

const RANK: Record<ContextMeterState, number> = { unknown: -1, ok: 0, warning: 1, full: 2, over: 3 }
const LEVELS: readonly ContextMeterLevel[] = ["warning", "full", "over"]

export function contextMeterState(
  p: Pick<ContextMeterProps, "used" | "max" | "warnAt" | "fullAt">,
): ContextMeterState {
  if (p.max === null || !Number.isFinite(p.max) || p.max <= 0) return "unknown"
  const f = Math.max(0, p.used) / p.max
  if (f > 1) return "over"
  if (f >= (p.fullAt ?? 0.95)) return "full"
  if (f >= (p.warnAt ?? 0.75)) return "warning"
  return "ok"
}

export interface ContextMeterContext {
  readonly state: ContextMeterState
  /** Levels said since the last re-arm. */
  readonly announced: ReadonlySet<ContextMeterLevel>
}

export type ContextMeterEvent = { readonly type: "SYNC" } | { readonly type: "RESET" }

export const contextMeterMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ContextMeterProps
    events: ContextMeterEvent
    env: AnnouncerEnv & LocaleEnv
    context: ContextMeterContext
  }>(),
  actions: {
    sync: ({ context, env, props, set }) => {
      const next = contextMeterState(props)
      const was = context.state
      if (next === was) return
      set("state", next)
      // Falling back re-arms what lies above the new level.
      let announced = new Set([...context.announced].filter((l) => RANK[l] <= RANK[next]))
      if (RANK[next] > RANK[was] && next !== "ok" && next !== "unknown" && !announced.has(next)) {
        announced = new Set([...announced, next])
        props.onThreshold?.(next)
        if (props.announce !== "off") {
          env.announcer.announce({
            message: (props.messages ?? contextMeterMessages)[next],
            priority: "polite",
            key: `context-meter-${props.id}`,
            lang: props.lang ?? env.locale.locale(),
          })
        }
      }
      set("announced", announced)
    },
    /** A new thread: every level re-armed, the current one recorded silently. */
    rearm: ({ props, set }) => {
      const now = contextMeterState(props)
      set("state", now)
      set("announced", new Set(LEVELS.filter((l) => RANK[l] <= RANK[now])))
    },
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
  },
}).machine({
  id: "context-meter",
  initial: "live",
  context: (props) => {
    const state = contextMeterState(props)
    // Mount is silent: the current level counts as already said.
    return { state, announced: new Set(LEVELS.filter((l) => RANK[l] <= RANK[state])) }
  },
  effects: ["prepareAnnouncer"],
  onProps: { used: "SYNC", max: "SYNC", warnAt: "SYNC", fullAt: "SYNC", resetKey: "RESET" },
  on: { SYNC: { actions: ["sync"] }, RESET: { actions: ["rearm"] } },
  states: { live: {} },
})

export type ContextMeterMachine = typeof contextMeterMachine
