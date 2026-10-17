import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { progressMachine } from "./progress.machine"

type P =
  | "root"
  | "label"
  | "value-text"
  | "track"
  | "indicator"
  | "circle"
  | "circle-track"
  | "circle-indicator"

const num = (s: string | null) => (s === null ? null : Number(s))

/**
 * Progress's contract (design §7): located by role `progressbar` and exact name; no user
 * actions. The value moves only through prop steps; `$props:value` sets 100 (the default
 * `max`), so a configuration starting below it with `announceCompletion` takes the
 * announcing transition and one without it the silent one.
 */
export const progressContract = contract("progress", {
  machine: progressMachine,
  anatomy: [
    "root",
    "label",
    "value-text",
    "track",
    "indicator",
    "circle",
    "circle-track",
    "circle-indicator",
  ],
  locate: (anchor: { readonly name: string | RegExp }) => ({
    role: "progressbar",
    name: anchor.name,
  }),
  actions: {},
  queries: {
    /** The value in the consumer's units; `null` when indeterminate. */
    value: async (env: Env<P>) => num(await env.part("root").attr("aria-valuenow")),
    valueText: async (env: Env<P>) => (await env.part("root").attr("aria-valuetext")) ?? "",
    percent: async (env: Env<P>) => {
      const root = env.part("root")
      const [now, min, max] = await Promise.all([
        root.attr("aria-valuenow"),
        root.attr("aria-valuemin"),
        root.attr("aria-valuemax"),
      ])
      if (now === null) return null
      const lo = Number(min ?? 0)
      const hi = Number(max ?? 100)
      return hi > lo ? ((Number(now) - lo) / (hi - lo)) * 100 : 0
    },
    state: async (env: Env<P>) => (await env.part("root").attr("data-state")) ?? "indeterminate",
    name: async (env: Env<P>) => env.part("root").accessibleName(),
  },
  states: { idle: {} },
  events: {
    "VALUE.CHANGE": { skip: "the parent's prop change: walked through $props:value" },
    "$props:value": { props: () => ({ value: 100 }) },
  },
  traits: ["valued"],
  valued: {
    // The oracle remembers the resolved value of the last props it saw.
    values: (view) => [(view.context as { previous: number | null }).previous],
  },
})
