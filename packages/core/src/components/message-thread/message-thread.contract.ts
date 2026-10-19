import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { messageThreadMachine } from "./message-thread.machine"

type P = "root" | "viewport" | "message" | "jump-to-latest"
type E = Env<P>

const LIVE = ["log", "status", "alert", "marquee", "timer"]

/**
 * Message Thread invariants (spec "Message Thread Invariants"): never a live region; every
 * message an article with a name and a position; JumpToLatest iff detached.
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "message-thread-not-live",
    check: async ({ env }) => {
      for (const p of ["root", "viewport"] as const) {
        const part = env.part(p)
        if ((await part.attr("aria-live")) !== null) return `the ${p} has aria-live`
        if (LIVE.includes((await part.attr("role")) ?? "")) return `the ${p} has a live role`
      }
      return undefined
    },
  },
  {
    name: "message-thread-articles",
    check: async ({ env }) => {
      for (const m of await env.part("message").all()) {
        if ((await m.attr("role")) !== "article") return "a message is not an article"
        if (!(await m.accessibleName())) return "a message has no name"
        if ((await m.attr("aria-posinset")) === null || (await m.attr("aria-setsize")) === null) {
          return "a message has no position"
        }
      }
      return undefined
    },
  },
  {
    name: "message-thread-jump-iff-detached",
    check: async ({ env }) => {
      const detached = (await env.part("root").attr("data-state")) === "detached"
      const jump = (await env.part("jump-to-latest").count()) > 0
      return detached === jump ? undefined : `detached=${detached}, jump rendered=${jump}`
    },
  },
]

/** Message Thread's contract (spec "Contract"): located by the feed's role and name. */
export const messageThreadContract = contract("message-thread", {
  machine: messageThreadMachine,
  anatomy: ["root", "viewport", "message", "jump-to-latest"],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "feed", name: anchor.name } : { part: "viewport" },
  actions: {
    /** Reading back: a wheel up. */
    scrollUp: {
      pointer: async (env) => env.part("viewport").wheel(-400),
      none: { keyboard: "native keyboard scrolling (synthetic keys do not scroll): browser tests" },
      done: async () => true,
    },
    /** The user scrolls back to the bottom. */
    scrollToBottom: {
      pointer: async (env) => env.part("viewport").wheel(100_000),
      none: { keyboard: "native keyboard scrolling (synthetic keys do not scroll): browser tests" },
      done: async () => true,
    },
    jump: {
      pointer: async (env) => env.part("jump-to-latest").click(),
      keyboard: async (env) => {
        await env.part("jump-to-latest").focus()
        await env.part("jump-to-latest").press("Enter")
      },
      done: async () => true,
    },
    nextMessage: {
      keyboard: async (env) => env.keyboard("PageDown"),
      done: async () => true,
    },
    previousMessage: {
      keyboard: async (env) => env.keyboard("PageUp"),
      done: async () => true,
    },
  },
  queries: {
    state: async (env: E) => (await env.part("root").attr("data-state")) ?? "",
    isAtBottom: async (env: E) => (await env.part("root").attr("data-at-bottom")) !== null,
    unread: async (env: E) =>
      Number(
        (await env.part("jump-to-latest").exists())
          ? ((await env.part("jump-to-latest").attr("data-unread")) ?? 0)
          : 0,
      ),
    focusedMessage: async (env: E) => {
      for (const m of await env.part("message").all()) {
        if (await m.isFocused()) return Number(await m.attr("aria-posinset"))
      }
      return null
    },
    messageCount: async (env: E) => env.part("message").count(),
  },
  states: { following: { state: "following" }, detached: { state: "detached" } },
  events: {
    SCROLLED: {
      from: {
        following: { action: "scrollUp", event: () => ({ atBottom: false, up: true }) },
        detached: { action: "scrollToBottom", event: () => ({ atBottom: true, up: false }) },
      },
    },
    ESCAPE: "scrollUp",
    JUMP: {
      from: {
        detached: { action: "jump", event: () => ({ modality: "pointer" }) },
        following: { skip: "JumpToLatest is not rendered while following" },
      },
    },
    "COUNT.SYNCED": { skip: "the parent's messages: the DOM tests add them" },
    "MOTION.CHANGED": { skip: "the Environment's MotionPreference: the DOM tests" },
    "$props:count": { skip: "the parent's messages: the DOM tests add them" },
    "$props:lastFromUser": { skip: "the parent's messages: the DOM tests add them" },
    "$props:anchor": { skip: "a layout prop: the machine tests" },
  },
  traits: [],
  invariants,
  // `focusedMessage` reads focus itself: focusing the viewport or a message changes it.
  commitsOnFocus: (["viewport", "message"] as const).flatMap((part) =>
    (["following", "detached"] as const).map((state) => ({ part, state })),
  ),
})
