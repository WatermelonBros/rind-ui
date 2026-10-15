import { contract, positioningQueries } from "@rind-ui/core"
import { anchoredMachine } from "./anchored.machine"

/** The anchored fixture: placement queries plus open/close; trait `anchored`. */
export const anchoredContract = contract("anchored", {
  machine: anchoredMachine,
  anatomy: ["trigger", "positioner", "content", "arrow", "title", "close"],
  locate: (name: string) => ({ role: "button", name }),
  queries: {
    ...positioningQueries,
    isOpen: async (env) => (await env.part("trigger").attr("aria-expanded")) === "true",
    /** Focus is inside the popup content. */
    hasFocus: async (env) =>
      (await env.part("content").exists()) &&
      (await env.part("content").attr("data-focus-within")) !== null,
  },
  actions: {
    open: {
      pointer: (env) => env.part("trigger").click(),
      keyboard: (env) => env.part("trigger").press("Enter"),
      touch: (env) => env.part("trigger").tap(),
      // Placed, then focused (never the other way round).
      done: { isOpen: true, isPlaced: true, hasFocus: true },
    },
    close: {
      pointer: (env) => env.part("close").click(),
      keyboard: (env) => env.keyboard("Escape"),
      touch: (env) => env.part("close").tap(),
      done: { isOpen: false },
    },
  },
  states: {
    open: { isOpen: true, isPlaced: true },
    closed: { isOpen: false },
  },
  dataState: { open: "open", closed: "closed" },
  events: {
    OPEN: "open",
    TOGGLE: {
      from: {
        closed: "open",
        open: { skip: "the trigger press is covered by close (Escape) and the dom tests" },
      },
    },
    CLOSE: "close",
    "POSITION.PLACED": {
      skip: "sent by the position capability, not a gesture (fakePositioning in the node tests)",
    },
    "POSITION.REPOSITION": {
      skip: "an API call (reposition()), covered by the virtual-anchor tests",
    },
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
  },
  traits: ["anchored", "restores-focus"],
  // `hasFocus` observes where focus is: focusing a part while open moves it by definition.
  commitsOnFocus: [
    { part: "trigger", state: "open" },
    { part: "close", state: "open" },
    { part: "content", state: "open" },
  ],
  semantics: { trigger: "trigger", content: "content" },
})
