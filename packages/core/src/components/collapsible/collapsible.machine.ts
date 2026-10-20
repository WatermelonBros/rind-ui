// Collapsible (design §1): two states, a controllable `open`. Animation lives in core/dom
// modules the parts bind after commit (presence, content-size, until-found), so the graph
// is the behaviour graph.

import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type CollapsibleEvent =
  /** A trigger press. */
  | { readonly type: "TOGGLE"; readonly modality: Modality }
  | { readonly type: "OPEN"; readonly reason: "api" | "find-in-page" }
  | { readonly type: "CLOSE"; readonly reason: "api" }

export type CollapsibleReveal = "mount" | "find-in-page" | null

export interface CollapsibleProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<CollapsibleEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
  /** Moves focus to the trigger when it is inside the content (the adapter's DOM). */
  readonly focusOutOfContent?: (() => void) | undefined
}

export const collapsibleMachine = /* @__PURE__ */ setup({
  types: type<{
    props: CollapsibleProps
    events: CollapsibleEvent
    env: object
    context: { reveal: CollapsibleReveal }
    values: "open"
  }>(),
  guards: {
    notDisabled: ({ props }) => props.disabled !== true,
    /** A controlled or imperative open works while disabled. */
    isApi: ({ event }) => event.type === "OPEN" && event.reason === "api",
  },
  actions: {
    markFindReveal: ({ event, set }) =>
      set(
        "reveal",
        event.type === "OPEN" && event.reason === "find-in-page" ? "find-in-page" : null,
      ),
    clearReveal: ({ set }) => set("reveal", null),
    moveFocusOutOfContent: ({ props }) => props.focusOutOfContent?.(),
  },
}).machine({
  id: "collapsible",
  initial: "closed",
  // Mounted open: `data-reveal="mount"` until the first transition (keyframe styles skip it).
  context: (props) => ({ reveal: (props.open ?? props.defaultOpen) ? "mount" : null }),
  values: { open: { fallback: false, states: { open: true, closed: false } } },
  states: {
    closed: {
      // Also after a parent-driven close: a later open is a transition, not the mount.
      entry: ["clearReveal"],
      on: {
        TOGGLE: { target: "open", guard: "notDisabled", actions: ["clearReveal"] },
        OPEN: {
          target: "open",
          guard: { or: ["notDisabled", "isApi"] },
          actions: ["markFindReveal"],
        },
      },
    },
    open: {
      exit: ["moveFocusOutOfContent"],
      on: {
        TOGGLE: { target: "closed", guard: "notDisabled", actions: ["clearReveal"] },
        CLOSE: { target: "closed", actions: ["clearReveal"] },
      },
    },
  },
})

export type CollapsibleMachine = typeof collapsibleMachine
