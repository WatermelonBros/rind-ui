import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import {
  type TimerAction,
  type TimerState,
  timerActionApplies,
  timerMachine,
} from "./timer.machine"

type P =
  | "root"
  | "area"
  | "control"
  | "item"
  | "item-value"
  | "item-label"
  | "separator"
  | "action-trigger"
type E = Env<P>

const state = async (env: E) =>
  ((await env.part("root").attr("data-state")) ?? "idle") as TimerState

/** The ActionTrigger for `action` (by `data-action`), pressed the way the modality presses. */
async function trigger(env: E, action: TimerAction) {
  for (const el of await env.part("action-trigger").all()) {
    if ((await el.attr("data-action")) === action) return el
  }
  // A toggle stands in for start / pause / resume when that is all the timer renders.
  for (const el of await env.part("action-trigger").all()) {
    if ((await el.attr("data-action")) === "toggle") return el
  }
  throw new Error(`timer: no ActionTrigger for "${action}"`)
}

const press = (action: TimerAction) => ({
  pointer: async (env: E) => (await trigger(env, action)).click(),
  touch: async (env: E) => (await trigger(env, action)).tap(),
  keyboard: async (env: E) => {
    const el = await trigger(env, action)
    await el.focus()
    await el.press("Enter")
  },
  done: async () => true,
})

/**
 * Timer invariants (spec "Timer Contract"): one timer region, no hidden trigger, each trigger
 * disabled exactly when its action does nothing in the current state, and the state on every
 * part.
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "timer-one-region",
    check: async ({ env }) => {
      const areas = await env.part("area").all()
      if (areas.length !== 1) return `${areas.length} Areas, expected 1`
      if ((await areas[0]?.attr("role")) !== "timer") return 'the Area is not role="timer"'
      return undefined
    },
  },
  {
    name: "timer-triggers-never-hidden",
    check: async ({ env }) => {
      for (const el of await env.part("action-trigger").all()) {
        if ((await el.attr("hidden")) !== null) return "an ActionTrigger is hidden"
      }
      return undefined
    },
  },
  {
    name: "timer-trigger-disabled-matches-state",
    check: async ({ env }) => {
      const now = await state(env)
      for (const el of await env.part("action-trigger").all()) {
        const action = (await el.attr("data-action")) as TimerAction
        const disabled = (await el.attr("aria-disabled")) === "true"
        if (disabled === timerActionApplies(action, now)) {
          return `the ${action} trigger is ${disabled ? "disabled" : "enabled"} in ${now}`
        }
      }
      return undefined
    },
  },
]

/** Timer's contract (spec "Timer Contract"): located as the only Timer in the target. */
export const timerContract = contract("timer", {
  machine: timerMachine,
  anatomy: [
    "root",
    "area",
    "control",
    "item",
    "item-value",
    "item-label",
    "separator",
    "action-trigger",
  ],
  locate: () => ({ part: "root" }),
  actions: {
    start: press("start"),
    pause: press("pause"),
    resume: press("resume"),
    reset: press("reset"),
    restart: press("restart"),
    toggle: press("toggle"),
  },
  queries: {
    state,
    /** The Area's accessible name: the duration in words. */
    label: async (env: E) => env.part("area").accessibleName(),
    /** The Area's text ("01:05"). */
    text: async (env: E) => env.part("area").text(),
  },
  states: {
    idle: { state: "idle" },
    running: { state: "running" },
    paused: { state: "paused" },
    completed: { state: "completed" },
  },
  events: {
    START: "start",
    PAUSE: "pause",
    RESUME: "resume",
    RESET: "reset",
    RESTART: "restart",
    TOGGLE: "toggle",
  },
  traits: [],
  invariants,
})
