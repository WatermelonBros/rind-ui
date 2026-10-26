import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { type ContextMeterState, contextMeterMachine } from "./context-meter.machine"

type P = "root" | "label" | "value-text" | "track" | "indicator" | "breakdown" | "breakdown-item"
type E = Env<P>

/** Context Meter's contract (spec "Context Meter Contract"): the value is a prop, so no actions. */
export const contextMeterContract = contract("context-meter", {
  machine: contextMeterMachine,
  anatomy: ["root", "label", "value-text", "track", "indicator", "breakdown", "breakdown-item"],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "meter", name: anchor.name } : { part: "root" },
  actions: {},
  queries: {
    state: async (env: E) =>
      ((await env.part("root").attr("data-state")) ?? "unknown") as ContextMeterState,
    percent: async (env: E) => Number((await env.part("root").attr("data-percent")) ?? 0),
    /** The value in words (`aria-valuetext`, or the visible text without a known size). */
    valueText: async (env: E) =>
      (await env.part("root").attr("aria-valuetext")) ?? (await env.part("root").text()),
  },
  states: { live: {} },
  events: {},
  traits: [],
})
