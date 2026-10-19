import { contract, type Invariant } from "../../contract/contract"
import type { AriaRole, Env } from "../../contract/env"
import { type StreamingStatus, streamingMessageMachine } from "./streaming-message.machine"

/** The status the parent passes to route to each state (settling: complete, still revealing). */
const STATUS_OF = {
  pending: "pending",
  streaming: "streaming",
  settling: "complete",
  complete: "complete",
  cancelled: "cancelled",
  error: "error",
} as const satisfies Record<string, StreamingStatus>

type P = "root" | "content" | "caret"
type E = Env<P>

const isBusy = async (env: E) => (await env.part("content").attr("aria-busy")) === "true"
const hasCaret = async (env: E) => (await env.part("caret").count()) > 0

/**
 * Streaming Message invariants (spec "Streaming Message Invariants"): busy, `data-busy` and a
 * caret agree; the body is never a live region. (No ancestor live region: the generic
 * invariants walk the tree; here the Content and the Root themselves.)
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "streaming-message-busy-agrees",
    check: async ({ env }) => {
      const busy = await isBusy(env)
      const data = (await env.part("content").attr("data-busy")) !== null
      const caret = await hasCaret(env)
      return busy === data && busy === caret
        ? undefined
        : `aria-busy=${busy}, data-busy=${data}, caret=${caret}`
    },
  },
  {
    name: "streaming-message-body-not-live",
    check: async ({ env }) => {
      for (const p of ["root", "content"] as const) {
        const part = env.part(p)
        if ((await part.attr("aria-live")) !== null) return `the ${p} has aria-live`
        const role = await part.attr("role")
        if (role && ["log", "status", "alert", "marquee", "timer"].includes(role)) {
          return `the ${p} has the live role "${role}"`
        }
      }
      return undefined
    },
  },
]

/** Streaming Message's contract (spec "Contract"): no user actions; the parent drives it. */
export const streamingMessageContract = contract("streaming-message", {
  machine: streamingMessageMachine,
  anatomy: ["root", "content", "caret"],
  locate: (anchor?: { readonly name: string | RegExp; readonly role?: AriaRole }) =>
    anchor ? { role: anchor.role ?? "article", name: anchor.name } : { part: "root" },
  actions: {
    /** Lets the reveal's ticks run (a virtual clock in tests). */
    waitForReveal: {
      pointer: async (env) => env.advance(1000),
      keyboard: async (env) => env.advance(1000),
      done: async (): Promise<boolean> => true,
    },
  },
  queries: {
    state: async (env: E) => (await env.part("root").attr("data-state")) ?? "",
    text: async (env: E) => env.part("content").text(),
    isBusy,
    hasCaret,
  },
  states: {
    pending: { state: "pending" },
    streaming: { state: "streaming" },
    settling: { state: "settling" },
    complete: { state: "complete" },
    cancelled: { state: "cancelled" },
    error: { state: "error" },
  },
  events: {
    SYNC: { skip: "every prop change; its routing is SETTLE's props step" },
    // The parent's status picks the state; the model's story is one fixed text.
    SETTLE: {
      props: (target) => ({ text: "One. Two. Three.", status: STATUS_OF[target] }),
    },
    "$props:status": { skip: "driven through SETTLE's props (the state it routes to)" },
    "$props:text": { skip: "driven through SETTLE's props (one fixed text)" },
    "MOTION.CHANGED": { skip: "the Environment's MotionPreference: the DOM tests" },
    "$props:smooth": { skip: "a prop change: the machine tests" },
  },
  traits: [],
  invariants,
})
