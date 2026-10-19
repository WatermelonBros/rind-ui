import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { reasoningMachine } from "./reasoning.machine"

type P = "root" | "trigger" | "content"
type E = Env<P>

/** Reasoning's contract (spec "Contract"): located by the Trigger's role and name. */
export const reasoningContract = contract("reasoning", {
  machine: reasoningMachine,
  anatomy: ["root", "trigger", "content"],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "button", name: anchor.name } : { part: "trigger" },
  actions: {
    toggle: {
      pointer: async (env) => env.part("trigger").click(),
      keyboard: async (env) => {
        await env.part("trigger").focus()
        await env.part("trigger").press("Enter")
      },
      done: async (): Promise<boolean> => true,
    },
  },
  queries: {
    isOpen: async (env: E) => (await env.part("trigger").attr("aria-expanded")) === "true",
    isThinking: async (env: E) => (await env.part("root").attr("data-thinking")) !== null,
    triggerText: async (env: E) => env.part("trigger").text(),
  },
  states: {
    done: { isThinking: false },
    thinking: { isThinking: true },
    closing: { isThinking: false },
  },
  events: {
    TOGGLE: "toggle",
    MOUNT: { skip: "mount: the DOM tests mount thinking and done" },
    "THINKING.SYNCED": {
      props: (target) => ({ thinking: target === "thinking" }),
    },
    "$props:thinking": { skip: "driven through THINKING.SYNCED's props step" },
    "$props:open": { skip: "controlled open: the DOM tests" },
  },
  traits: ["disclosure"],
})
