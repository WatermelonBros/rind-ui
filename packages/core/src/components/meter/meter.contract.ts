import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { meterMachine } from "./meter.machine"

type P = "root" | "label" | "value-text" | "track" | "indicator"

/**
 * Meter's contract (design §5): located by role `meter` and exact name; no user actions. The
 * model's prop step moves the value to 90, across `high` from the configurations below it;
 * the generic invariants (`valued`, from the context's resolved value) run after each step.
 */
export const meterContract = contract("meter", {
  machine: meterMachine,
  anatomy: ["root", "label", "value-text", "track", "indicator"],
  locate: (anchor: { readonly name: string | RegExp }) => ({ role: "meter", name: anchor.name }),
  actions: {},
  queries: {
    value: async (env: Env<P>) => Number((await env.part("root").attr("aria-valuenow")) ?? "0"),
    valueText: async (env: Env<P>) => (await env.part("root").attr("aria-valuetext")) ?? "",
    percent: async (env: Env<P>) => {
      const root = env.part("root")
      const [now, min, max] = await Promise.all([
        root.attr("aria-valuenow"),
        root.attr("aria-valuemin"),
        root.attr("aria-valuemax"),
      ])
      const lo = Number(min ?? 0)
      const hi = Number(max ?? 100)
      return hi > lo ? ((Number(now ?? lo) - lo) / (hi - lo)) * 100 : 0
    },
    /** `undefined` when no threshold is set. */
    zone: async (env: Env<P>) => (await env.part("root").attr("data-zone")) ?? undefined,
    name: async (env: Env<P>) => env.part("root").accessibleName(),
  },
  states: { idle: {} },
  events: {
    "VALUE.CHANGE": { skip: "the parent's prop change: walked through $props:value" },
    // From each configuration's value into the high region (across `high`).
    "$props:value": { props: () => ({ value: 90 }) },
  },
  traits: ["valued"],
  // The view types context as unknown for any contract: the meter machine declares MeterContext.
  valued: { values: (view) => [(view.context as { value: number }).value] },
})
