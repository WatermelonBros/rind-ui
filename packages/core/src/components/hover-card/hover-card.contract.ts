// The Hover Card's contract (design §2). Delays are waited out by advancing time in small
// steps until the page shows the change, so the same actions work with fake time (jsdom)
// and in real browsers, whatever `openDelay` / `closeDelay` the instance uses.

import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import { hoverCardMachine } from "./hover-card.machine"

type P = "trigger" | "positioner" | "content" | "arrow"
type E = Env<P>

const isOpen = async (env: E) => (await env.part("trigger").attr("aria-expanded")) === "true"
const closed = async (env: E) => !(await isOpen(env))

/** Focus is in the content (or one of its descendants). */
const hasFocus = async (env: E) =>
  (await env.part("content").exists()) &&
  (await env.part("content").attr("data-focus-within")) !== null

/** Advances time in 50 ms steps (fake time, or real waits) until `done`, up to 5 s. */
async function waitOut(env: E, done: () => Promise<boolean>) {
  for (let t = 0; t < 5000 && !(await done()); t += 50) await env.advance(50)
}

export const hoverCardContract = contract("hover-card", {
  machine: hoverCardMachine,
  anatomy: ["trigger", "positioner", "content", "arrow"],
  // Located through its trigger: a link (default) and its exact accessible name.
  locate: ({
    name,
    role = "link",
  }: {
    readonly name: string | RegExp
    readonly role?: "link" | "button"
  }) => ({ role, name }),
  queries: {
    ...positioningQueries,
    isOpen,
    hasFocus,
    isTopmost: async (env: E) =>
      (await env.part("content").exists()) &&
      (await env.part("content").attr("data-has-nested")) === null,
    /** The last close reason ("escape-key"), until the next open. */
    closeReason: async (env: E) =>
      (await env.part("content").exists()) ? env.part("content").attr("data-close-reason") : null,
  },
  actions: {
    /** Rests on the trigger (pointer) or Tabs onto it (keyboard), then the open delay. */
    show: {
      pointer: async (env: E) => {
        await env.part("trigger").hover()
        await waitOut(env, () => isOpen(env))
      },
      keyboard: async (env: E) => {
        await env.part("trigger").focusWithTab()
        await waitOut(env, () => isOpen(env))
      },
      done: isOpen,
    },
    /** The pointer moves onto the trigger: the open delay starts (nothing shows yet). */
    hoverTrigger: {
      pointer: async (env: E) => env.part("trigger").hover(),
      keyboard: async (env: E) => env.part("trigger").focusWithTab(),
      done: async () => true,
    },
    /** Leaves (pointer: a press outside; keyboard: Escape). */
    hide: {
      pointer: async (env: E) => env.pointerOutside(),
      keyboard: async (env: E) => env.keyboard("Escape"),
      done: closed,
    },
    /** Tab from the trigger into the content. */
    enter: {
      keyboard: async (env: E) => {
        await waitOut(env, () => positioningQueries.isPlaced(env))
        await env.keyboard("Tab")
      },
      done: async (env: E) => (await isOpen(env)) && (await env.focused().exists()),
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
    closed: { isOpen: false },
    opening: { isOpen: false },
    open: { isOpen: true },
    closing: { isOpen: true },
  },
  dataState: {
    closed: { trigger: "closed" },
    opening: { trigger: "closed" },
    open: { trigger: "open", positioner: "open", content: "open" },
    closing: { trigger: "open" },
  },
  events: {
    "HOVER.START": {
      from: {
        closed: "hoverTrigger",
        opening: { skip: "already waiting for the open delay" },
        open: { skip: "the hover zone re-entered: the hover-intent browser tests" },
        closing: { skip: "re-entering within the close delay: the DOM tests" },
      },
    },
    "HOVER.END": { skip: "leaving the hover zone, then the close delay: the DOM tests" },
    FOCUS: { skip: "the keyboard twin of hoverTrigger (Tab onto the trigger)" },
    BLUR: { skip: "Tab away: the keyboard DOM tests" },
    "FOCUS_WITHIN.ENTER": { skip: "Tab into the content: the enter action (DOM tests)" },
    "FOCUS_WITHIN.LEAVE": { skip: "Tab past the content's end: the DOM tests" },
    CLOSE: {
      from: {
        opening: { skip: "a dismissal needs an open layer" },
        open: "pressEscape",
        closing: { skip: "a dismissal during the close delay: the DOM tests" },
      },
    },
    OPEN: { skip: "programmatic (actionsRef.open): the machine tests" },
    DISABLED: { skip: "the disabled prop step ($props:disabled)" },
    "POSITION.PLACED": { skip: "sent by the position capability, not a user step" },
    "$sync:open": { props: (target) => ({ open: target === "open" || target === "closing" }) },
    "$props:disabled": { props: () => ({ disabled: true }) },
  },
  traits: ["layer", "restores-focus", "presence", "anchored", "timed"],
  // Focusing the trigger by keyboard starts the open delay: that is the point.
  commitsOnFocus: [{ part: "trigger", state: "closed" }],
  semantics: { trigger: "trigger", content: "content" },
})
