import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import { popoverMachine } from "./popover.machine"

type P =
  | "trigger"
  | "anchor"
  | "indicator"
  | "positioner"
  | "content"
  | "arrow"
  | "title"
  | "description"
  | "close-trigger"
type E = Env<P>

const isOpen = async (env: E) => (await env.part("trigger").attr("aria-expanded")) === "true"
const hasFocus = async (env: E) =>
  (await env.part("content").exists()) &&
  (await env.part("content").attr("data-focus-within")) !== null
const closed = async (env: E) => !(await isOpen(env))

function popoverContractWith(modal: boolean) {
  return contract("popover", {
    machine: popoverMachine,
    anatomy: [
      "trigger",
      "anchor",
      "indicator",
      "positioner",
      "content",
      "arrow",
      "title",
      "description",
      "close-trigger",
    ],
    // Located through its trigger: a closed popover has no content to find.
    locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "button" as const, name }),
    queries: {
      ...positioningQueries,
      isOpen,
      isModal: async (env: E) => (await env.part("content").attr("aria-modal")) === "true",
      title: async (env: E) =>
        (await env.part("content").exists()) ? env.part("content").accessibleName() : null,
      description: async (env: E) =>
        (await env.part("content").exists()) ? env.part("content").accessibleDescription() : null,
      hasFocus,
      isTopmost: async (env: E) =>
        (await env.part("content").exists()) &&
        (await env.part("content").attr("data-has-nested")) === null,
      /** The last close reason ("escape-key"), until the next open. */
      closeReason: async (env: E) =>
        (await env.part("content").exists()) ? env.part("content").attr("data-close-reason") : null,
    },
    actions: {
      open: {
        pointer: async (env: E) => env.part("trigger").click(),
        touch: async (env: E) => env.part("trigger").tap(),
        keyboard: async (env: E) => env.part("trigger").press("Enter"),
        // Placed, then focused (never the other way round).
        done: async (env: E) =>
          (await isOpen(env)) && (await positioningQueries.isPlaced(env)) && (await hasFocus(env)),
      },
      /** Presses the trigger of the open popover. */
      close: {
        pointer: async (env: E) => env.part("trigger").click(),
        touch: async (env: E) => env.part("trigger").tap(),
        keyboard: async (env: E) => env.part("trigger").press("Enter"),
        done: closed,
      },
      toggle: {
        pointer: async (env: E) => env.part("trigger").click(),
        touch: async (env: E) => env.part("trigger").tap(),
        keyboard: async (env: E) => env.part("trigger").press("Enter"),
        done: async () => true,
      },
      closeWithButton: {
        pointer: async (env: E) => env.part("close-trigger").click(),
        touch: async (env: E) => env.part("close-trigger").tap(),
        keyboard: async (env: E) => env.part("close-trigger").press("Enter"),
        done: closed,
      },
      pressEscape: {
        keyboard: async (env: E) => env.keyboard("Escape"),
        done: closed,
      },
      pressOutside: {
        pointer: async (env: E) => env.pointerOutside(),
        none: { keyboard: "an outside press is a pointer interaction" },
        done: closed,
      },
      tab: { keyboard: async (env: E) => env.keyboard("Tab"), done: async () => true },
      shiftTab: {
        keyboard: async (env: E) => env.keyboard("Tab", { shift: true }),
        done: async () => true,
      },
      waitForUnmount: {
        keyboard: async (env: E) => env.part("content").waitForDetach(),
        done: async () => true,
      },
    },
    states: {
      open: { isOpen: true, isPlaced: true },
      closed: { isOpen: false },
    },
    dataState: {
      open: { trigger: "open", positioner: "open", content: "open" },
      closed: { trigger: "closed" },
    },
    events: {
      trigger: {
        from: {
          closed: "open",
          open: modal
            ? { skip: "a modal popover's trigger is inert while open (the page is)" }
            : "close",
        },
      },
      "close-trigger": "closeWithButton",
      "escape-key": "pressEscape",
      "outside-press": "pressOutside",
      "outside-focus": {
        skip: "focus moving to the page: covered by the Tab-order DOM tests (radix#4128)",
      },
      "parent-dismissed": { skip: "closing the parent layer: covered by the nesting DOM tests" },
      open: { skip: "programmatic (actionsRef.open): covered by the machine tests" },
      api: { skip: "programmatic close and the disabled prop: covered by the machine tests" },
      "POSITION.PLACED": {
        skip: "sent by the position capability, not a gesture (fakePositioning in the node tests)",
      },
      "POSITION.REPOSITION": { skip: "an API call (reposition()), covered by the DOM tests" },
      "$sync:open": { props: (target) => ({ open: target === "open" }) },
      "$props:disabled": { props: () => ({ disabled: true }) },
    },
    traits: modal
      ? ["layer", "restores-focus", "presence", "anchored", "modal"]
      : ["layer", "restores-focus", "presence", "anchored"],
    // `hasFocus` observes where focus is: focusing a part while open moves it by definition.
    commitsOnFocus: [
      { part: "trigger", state: "open" },
      { part: "close-trigger", state: "open" },
      { part: "content", state: "open" },
    ],
    semantics: { trigger: "trigger", content: "content", label: "title" },
  })
}

/** A non-modal popover (the default). */
export const popoverContract = popoverContractWith(false)
/** A modal popover (`modal`): adds the `modal` trait. */
export const modalPopoverContract = popoverContractWith(true)
