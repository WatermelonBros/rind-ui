import { contract } from "@rind-ui/core"
import { disclosureMachine } from "./disclosure.machine"

export const disclosureContract = contract("disclosure", {
  machine: disclosureMachine,
  anatomy: ["root", "trigger", "content"],
  locate: (name: string) => ({ role: "button", name }),
  queries: {
    isOpen: async (env) => (await env.part("trigger").attr("aria-expanded")) === "true",
    contentVisible: (env) => env.part("content").exists(),
  },
  actions: {
    toggle: {
      pointer: (env) => env.part("trigger").click(),
      keyboard: (env) => env.part("trigger").press("Enter"),
      touch: (env) => env.part("trigger").tap(),
      done: async () => true,
    },
    open: {
      pointer: (env) => env.part("trigger").click(),
      keyboard: (env) => env.part("trigger").press("Enter"),
      touch: (env) => env.part("trigger").tap(),
      done: { isOpen: true, contentVisible: true },
    },
    close: {
      pointer: (env) => env.part("trigger").click(),
      keyboard: (env) => env.part("trigger").press("Space"),
      touch: (env) => env.part("trigger").tap(),
      done: { isOpen: false, contentVisible: false },
    },
    pressEscape: {
      keyboard: (env) => env.keyboard("Escape"),
      // Escape may be disabled by props; the runner's oracle decides the expected state.
      done: async () => true,
    },
  },
  states: {
    open: { isOpen: true, contentVisible: true },
    closed: { isOpen: false, contentVisible: false },
  },
  dataState: { open: "open", closed: "closed" },
  attrs: {
    open: { trigger: { "aria-expanded": "true" } },
    closed: { trigger: { "aria-expanded": "false" } },
  },
  events: {
    OPEN: "open",
    CLOSE: "close",
    TOGGLE: "toggle",
    ESCAPE: "pressEscape",
    // Controlled: the parent opens or closes it by re-rendering with `open`.
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
  },
  traits: ["disclosure"],
  semantics: { trigger: "trigger", content: "content" },
})
