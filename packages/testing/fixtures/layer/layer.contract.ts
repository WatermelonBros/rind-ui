import { contract } from "@rind-ui/core"
import { layerMachine } from "./layer.machine"

/** The modal layer fixture: traits modal (layer + restores-focus) and presence. */
export const layerContract = contract("layer", {
  machine: layerMachine,
  anatomy: ["root", "trigger", "positioner", "backdrop", "content", "title", "close"],
  locate: (name: string) => ({ role: "button", name }),
  queries: {
    isOpen: async (env) => (await env.part("trigger").attr("aria-expanded")) === "true",
    hasFocus: async (env) =>
      (await env.part("content").exists()) &&
      (await env.part("content").attr("data-focus-within")) !== null,
    isTopmost: async (env) =>
      (await env.part("content").exists()) &&
      (await env.part("content").attr("data-has-nested")) === null,
  },
  actions: {
    open: {
      pointer: (env) => env.part("trigger").click(),
      keyboard: (env) => env.part("trigger").press("Enter"),
      touch: (env) => env.part("trigger").tap(),
      // A modal layer is open once focus has moved into it (within a frame).
      done: { isOpen: true, hasFocus: true },
    },
    close: {
      pointer: (env) => env.part("close").click(),
      keyboard: (env) => env.part("close").press("Enter"),
      touch: (env) => env.part("close").tap(),
      done: { isOpen: false },
    },
    pressEscape: {
      keyboard: (env) => env.keyboard("Escape"),
      done: { isOpen: false },
    },
    pressOutside: {
      pointer: (env) => env.pointerOutside(),
      none: { keyboard: "an outside press is a pointer interaction" },
      done: { isOpen: false },
    },
    tab: {
      keyboard: (env) => env.keyboard("Tab"),
      done: { hasFocus: true },
    },
    shiftTab: {
      keyboard: (env) => env.keyboard("Tab", { shift: true }),
      done: { hasFocus: true },
    },
    waitForUnmount: {
      keyboard: (env) => env.part("content").waitForDetach(),
      done: async () => true,
    },
  },
  states: { open: { isOpen: true, hasFocus: true }, closed: { isOpen: false } },
  dataState: { open: "open", closed: "closed" },
  attrs: {
    open: { trigger: { "aria-expanded": "true" } },
    closed: { trigger: { "aria-expanded": "false" } },
  },
  events: {
    OPEN: "open",
    TOGGLE: { skip: "the trigger is inert while the modal layer is open; OPEN covers opening" },
    CLOSE: "close",
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
  },
  traits: ["modal", "presence"],
  semantics: { trigger: "trigger", content: "content" },
})
