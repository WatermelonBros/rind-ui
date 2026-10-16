// The Tooltip's contract (design §7). Delays are waited out by advancing time in small steps
// until the page shows the change, so the same actions work with fake timers (jsdom) and in
// real browsers, whatever `openDelay` / `closeDelay` the instance uses.

import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import { tooltipMachine } from "./tooltip.machine"

type P = "trigger" | "positioner" | "content" | "arrow"
type E = Env<P>

// The content's state: a trigger shared with a popover or a menu carries theirs.
const isOpen = async (env: E) =>
  (await env.part("content").exists()) && (await env.part("content").attr("data-state")) === "open"

/** Advances time in 50 ms steps (fake timers, or real waits) until `done`, up to 5 s. */
async function waitOut(env: E, done: () => Promise<boolean>) {
  for (let t = 0; t < 5000 && !(await done()); t += 50) await env.advance(50)
}

/** Closed: the content is hidden and still referenced by the trigger (browse-mode reading). */
const closedContentHiddenAndReferenced: Invariant<P> = {
  name: "closed-content-hidden-and-referenced",
  check: async ({ env, state }) => {
    if (state !== "closed") return undefined
    const content = env.part("content")
    if (!(await content.exists())) return undefined
    const id = await content.attr("id")
    const refs = `${(await env.part("trigger").attr("aria-describedby")) ?? ""} ${
      (await env.part("trigger").attr("aria-labelledby")) ?? ""
    }`.split(/\s+/)
    if (id && !refs.includes(id))
      return `the closed content #${id} is not referenced by the trigger`
    // `hidden` once the exit animation ended (presence): give it that long.
    for (let t = 0; t < 2000 && (await content.attr("hidden")) === null; t += 50) {
      await env.advance(50)
    }
    return (await content.attr("hidden")) === null ? "the closed content is not hidden" : undefined
  },
}

/** The content never takes focus. */
const contentNeverFocused: Invariant<P> = {
  name: "content-never-focused",
  check: async ({ env }) => {
    const content = env.part("content")
    if (!(await content.exists())) return undefined
    if ((await content.attr("tabindex")) !== null) return "the content has a tabindex"
    return (await content.isFocused()) ? "the content has focus" : undefined
  },
}

export const tooltipContract = contract("tooltip", {
  machine: tooltipMachine,
  anatomy: ["trigger", "positioner", "content", "arrow"],
  // Located through its trigger (role and exact accessible name).
  locate: ({
    name,
    role = "button",
  }: {
    readonly name: string | RegExp
    readonly role?: "button" | "link"
  }) => ({
    role,
    name,
  }),
  queries: {
    ...positioningQueries,
    isOpen,
    text: async (env: E) => env.part("content").text(),
    /** The trigger's accessible description. */
    description: async (env: E) => env.part("trigger").accessibleDescription(),
    /** The trigger's accessible name. */
    label: async (env: E) => env.part("trigger").accessibleName(),
    isInstant: async (env: E) =>
      (await env.part("content").exists()) &&
      (await env.part("content").attr("data-instant")) !== null,
  },
  actions: {
    show: {
      pointer: async (env: E) => {
        await env.part("trigger").hover()
        await waitOut(env, () => isOpen(env))
      },
      keyboard: async (env: E) => env.part("trigger").focusWithTab(),
      done: isOpen,
    },
    hide: {
      // A press outside: the pointer leaves the zone at once (Escape is the keyboard twin).
      pointer: async (env: E) => env.pointerOutside(),
      keyboard: async (env: E) => env.keyboard("Escape"),
      done: async (env: E) => !(await isOpen(env)),
    },
    /** The pointer moves onto the trigger: the open delay starts (nothing shows yet). */
    hoverTrigger: {
      pointer: async (env: E) => env.part("trigger").hover(),
      none: { keyboard: "hover has no keyboard twin; focus opens at once (show)" },
      done: async () => true,
    },
    hoverContent: {
      // Once placed: an unplaced popup lets no pointer through.
      pointer: async (env: E) => {
        await waitOut(env, () => positioningQueries.isPlaced(env))
        await env.part("content").hover()
      },
      none: { keyboard: "the content is never focusable" },
      done: isOpen,
    },
    pressTrigger: {
      pointer: async (env: E) => env.part("trigger").click(),
      keyboard: async (env: E) => env.part("trigger").press("Enter"),
      touch: async (env: E) => env.part("trigger").tap(),
      done: async () => true,
    },
    pressEscape: {
      keyboard: async (env: E) => env.keyboard("Escape"),
      done: async (env: E) => !(await isOpen(env)),
    },
  },
  states: {
    closed: { isOpen: false },
    opening: { isOpen: false },
    open: { isOpen: true },
    closing: { isOpen: true },
  },
  // On the content only: a trigger rendered as another part keeps that part's data-state.
  dataState: {
    closed: { content: "closed" },
    opening: { content: "closed" },
    open: { content: "open" },
    closing: { content: "open" },
  },
  events: {
    "HOVER.START": {
      from: {
        closed: "hoverTrigger",
        opening: { skip: "already waiting for the open delay (one open per stay)" },
        open: { skip: "the hover zone re-entered: hover-intent browser tests" },
        closing: { skip: "re-entering within the close delay: the DOM tests" },
      },
    },
    "HOVER.END": { skip: "leaving the hover zone, then the close delay: the DOM tests" },
    FOCUS: { skip: "the keyboard twin of show (Tab onto the trigger)" },
    BLUR: { skip: "Tab away: covered by the keyboard tests" },
    "PRESS.START": "pressTrigger",
    ESCAPE: "pressEscape",
    OUTSIDE_PRESS: "hide",
    GROUP: { skip: "another tooltip opening: the delay-group DOM tests" },
    OPEN: { skip: "programmatic (actionsRef.open): the machine tests" },
    CLOSE: { skip: "programmatic (actionsRef.close): the machine tests" },
    DISABLED: { skip: "the disabled prop step ($props:disabled)" },
    "POSITION.PLACED": { skip: "sent by the position capability, not a user step" },
    "$sync:open": { props: (target) => ({ open: target === "open" || target === "closing" }) },
    "$props:disabled": { props: () => ({ disabled: true }) },
  },
  traits: ["layer", "anchored", "timed"],
  invariants: [closedContentHiddenAndReferenced, contentNeverFocused],
  // Focusing the trigger by keyboard opens it: that is the point.
  commitsOnFocus: [{ part: "trigger", state: "closed" }],
  semantics: { trigger: "trigger", content: "content" },
})
