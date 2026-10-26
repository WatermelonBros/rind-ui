import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { type AgentState, agentPresenceMachine } from "./agent-presence.machine"

type P = "root" | "visual" | "status" | "label" | "detail"
type E = Env<P>

/** Agent Presence's contract (spec "Agent Presence Contract"): the state is a prop: no actions. */
export const agentPresenceContract = contract("agent-presence", {
  machine: agentPresenceMachine,
  anatomy: ["root", "visual", "status", "label", "detail"],
  locate: () => ({ part: "root" }),
  actions: {},
  queries: {
    state: async (env: E) => ((await env.part("root").attr("data-state")) ?? "idle") as AgentState,
    statusText: async (env: E) => env.part("status").text(),
    isStale: async (env: E) => (await env.part("root").attr("data-stale")) !== null,
    /** The coarse level band, 0 to 3. */
    level: async (env: E) => Number((await env.part("root").attr("data-level")) ?? 0),
  },
  states: { live: {} },
  events: {},
  traits: [],
})
