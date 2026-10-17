// Progress (design §3): every attribute is a pure function of props (range-value); the
// one-state service exists for the contract, the driver, `testMachine`, and the opt-in
// completion announcement. `onProps` does not fire on creation, so mounting at `max` is
// silent; a value reaching `max` from below or from indeterminate announces once.

import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import { type RangeValue, resolveRangeValue } from "../shared/range-value"
import type { ProgressMessages } from "./progress.messages"

export interface ProgressProps {
  /** `null` / `undefined`: indeterminate. */
  readonly value?: number | null | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  /** Announce `messages.complete` when the value reaches `max`. Default false. */
  readonly announceCompletion?: boolean | undefined
  readonly messages: ProgressMessages
  /** For the announcement's key. */
  readonly id: string
  readonly lang?: string | undefined
}

export type ProgressEvent = { readonly type: "VALUE.CHANGE" }

export interface ProgressContext {
  /** The resolved value of the previous props; `null` when indeterminate. */
  readonly previous: number | null
}

export const progressMachine = setup({
  types: type<{
    props: ProgressProps
    events: ProgressEvent
    env: AnnouncerEnv
    context: ProgressContext
  }>(),
  guards: {
    /** The new value is `max`, the previous one was below it or indeterminate. */
    reachedMax: ({ props, context }) => {
      if (props.announceCompletion !== true) return false
      const { value, max } = resolveRangeValue(props)
      return value === max && (context.previous === null || context.previous < max)
    },
  },
  actions: {
    announceCompletion: ({ props, env }) => {
      env.announcer.announce({
        message: props.messages.complete,
        priority: "polite",
        key: `progress-${props.id}`,
        ...(props.lang === undefined ? {} : { lang: props.lang }),
      })
    },
    remember: ({ props, set }) => set("previous", resolveRangeValue(props).value),
  },
  effects: {
    prepareAnnouncer: ({ props, env }) =>
      props.announceCompletion === true ? env.announcer.prepare() : undefined,
  },
}).machine({
  id: "progress",
  initial: "idle",
  context: (props) => ({ previous: resolveRangeValue(props).value }),
  onProps: { value: "VALUE.CHANGE" },
  effects: ["prepareAnnouncer"],
  states: {
    idle: {
      on: {
        "VALUE.CHANGE": [
          { guard: "reachedMax", actions: ["announceCompletion", "remember"] },
          { actions: ["remember"] },
        ],
      },
    },
  },
})

export type ProgressMachine = typeof progressMachine

/** The state Progress exposes as `data-state`: from the value, not from the service. */
export type ProgressState = "indeterminate" | "loading" | "complete"

export function progressState(r: RangeValue): ProgressState {
  return r.value === null ? "indeterminate" : r.value === r.max ? "complete" : "loading"
}
