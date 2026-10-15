import { contract, setup, type } from "@rind-ui/core"

/** A machine-less fixture: one state, so the contract can locate the streaming button. */
export const streamMachine = setup({
  types: type<{ props: object; events: { type: "STREAM" }; env: object }>(),
}).machine({ id: "stream", initial: "idle", states: { idle: {} } })

export const streamContract = contract("stream", {
  machine: streamMachine,
  anatomy: ["root"],
  locate: (name: string) => ({ role: "button", name }),
  queries: { done: async (env) => (await env.part("root").attr("data-done")) === "true" },
  actions: {
    stream: {
      pointer: (env) => env.part("root").click(),
      keyboard: (env) => env.part("root").press("Enter"),
      done: { done: true },
    },
  },
  states: { idle: {} },
  events: { STREAM: "stream" },
  traits: [],
})
