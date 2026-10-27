// Citation (add-citation design §1): the card's open/close, delays and positioning are Hover
// Card's (composed by the adapter); this machine owns only `pinned`: a press on a button marker
// keeps the card open without hover, also on touch (Base UI#4778). A link marker is followed,
// never pinned.

import { setup, type } from "../../machine/setup"

export type CitationEvent = { readonly type: "PRESS" } | { readonly type: "UNPIN" }

export interface CitationProps {
  /** `link`: the marker follows its URL; `button`: a press pins the card. */
  readonly kind: "link" | "button"
  readonly onPinnedChange?: ((pinned: boolean) => void) | undefined
}

export const citationMachine = /* @__PURE__ */ setup({
  types: type<{ props: CitationProps; events: CitationEvent; env: Record<never, never> }>(),
  guards: {
    pins: ({ props }) => props.kind === "button",
  },
  actions: {
    pinned: ({ props }) => props.onPinnedChange?.(true),
    unpinned: ({ props }) => props.onPinnedChange?.(false),
  },
}).machine({
  id: "citation",
  initial: "idle",
  states: {
    idle: { on: { PRESS: { guard: "pins", target: "pinned", actions: ["pinned"] } } },
    pinned: {
      on: {
        PRESS: { target: "idle", actions: ["unpinned"] },
        UNPIN: { target: "idle", actions: ["unpinned"] },
      },
    },
  },
})

export type CitationMachine = typeof citationMachine
