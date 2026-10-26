import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { citationMachine } from "./citation.machine"

type P =
  | "trigger"
  | "source"
  | "source-title"
  | "source-url"
  | "source-snippet"
  | "source-link"
  | "cited-text"
type E = Env<P>

/** The card (Hover Card's content, portalled): its open state is on the marker's data-state. */
const state = async (env: E) => (await env.part("trigger").attr("data-state")) ?? "closed"

/** Citation's contract (spec "Citation Contract"): the marker by name, else the first. */
export const citationContract = contract("citation", {
  machine: citationMachine,
  anatomy: [
    "trigger",
    "source",
    "source-title",
    "source-url",
    "source-snippet",
    "source-link",
    "cited-text",
  ],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    // The marker shows its index ("1"); its name is the aria-label, on a link or a button.
    anchor ? { role: ["link", "button"], name: anchor.name } : { part: "trigger" },
  actions: {
    /** Hover or focus opens the card. */
    show: {
      pointer: (env: E) => env.part("trigger").hover(),
      keyboard: (env: E) => env.part("trigger").focusWithTab(),
      none: { touch: "a touch pins a button marker (pin) or follows a link" },
      done: async (env: E) => (await state(env)) !== "closed",
    },
    /** A press on a button marker pins the card open. */
    pin: {
      pointer: (env: E) => env.part("trigger").click(),
      touch: (env: E) => env.part("trigger").tap(),
      keyboard: async (env: E) => {
        await env.part("trigger").focus()
        await env.part("trigger").press("Enter")
      },
      done: async () => true,
    },
    hide: {
      keyboard: async (env: E) => {
        await env.part("trigger").focus()
        await env.part("trigger").press("Escape")
      },
      none: { pointer: "the pointer leaves or presses outside", touch: "a press outside" },
      done: async () => true,
    },
  },
  queries: {
    isOpen: async (env: E) => ["open", "pinned"].includes(await state(env)),
    isPinned: async (env: E) => (await env.part("trigger").attr("data-pinned")) !== null,
    kind: async (env: E) => env.part("trigger").attr("data-kind"),
    href: async (env: E) => env.part("trigger").attr("href"),
    sourceTitle: async (env: E) => env.part("source-title").text(),
  },
  states: { idle: {}, pinned: { isPinned: true } },
  events: { PRESS: "pin" },
  traits: [],
})
