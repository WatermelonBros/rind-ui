// Table of Contents (add-table-of-contents design §2): the reading position drives the
// current section; a followed link makes its section current at once and holds it while
// the jump scrolls (no flicker through the sections passed, tocbot #376), until the scroll
// settles or the user scrolls themselves.

import type { SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"

export type TableOfContentsEvent =
  /** The reading position, every frame that scrolled or resized. */
  | {
      readonly type: "POSITION"
      readonly current: string | null
      readonly visible: readonly string[]
    }
  /** A link was followed. */
  | { readonly type: "NAVIGATE"; readonly id: string }
  /** The user scrolled (wheel, touch, a scrolling key). */
  | { readonly type: "USER.SCROLL" }
  /** The controlled `value` prop changed (onProps). */
  | { readonly type: "VALUE.SYNCED" }

/** Why the current section changed: the reading position, or a followed link. */
export type TableOfContentsChangeReason = "scroll" | "navigate"

export interface TableOfContentsProps {
  readonly id: string
  /** The current section's id ("" for none). */
  readonly value?: string | undefined
  readonly defaultValue?: string | undefined
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<TableOfContentsEvent>) => void)
    | undefined
  /** Quiet time after a followed link's last scroll before the position drives again (ms). */
  readonly settleDelay?: number | undefined
}

export interface TableOfContentsContext {
  /** Sections in view. */
  readonly visible: readonly string[]
  /** The latest reading position's current section, held while a link's jump scrolls. */
  readonly latest: string | null
}

type Types = {
  props: TableOfContentsProps
  events: TableOfContentsEvent
  env: SchedulerEnv
  context: TableOfContentsContext
  values: "value"
}
type Args = ActionArgs<Types>

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

function observe({ event, context, set }: Args) {
  if (event.type !== "POSITION") return
  if (!same(context.visible, event.visible)) set("visible", event.visible)
  if (context.latest !== event.current) set("latest", event.current)
}

export const tableOfContentsMachine = setup({
  types: type<Types>(),
  actions: {
    observe,
    follow: ({ event, values, set }) => {
      if (event.type === "POSITION" && event.current !== null && event.current !== values.value) {
        set("value", event.current)
      }
    },
    catchUp: ({ context, values, set }) => {
      if (context.latest !== null && context.latest !== values.value) set("value", context.latest)
    },
    navigate: ({ event, set }) => {
      if (event.type === "NAVIGATE") set("value", event.id)
    },
  },
  delays: { settle: ({ props }) => props.settleDelay ?? 150 },
}).machine({
  id: "table-of-contents",
  initial: "tracking",
  context: () => ({ visible: [], latest: null }),
  values: { value: { fallback: "" } },
  onProps: { value: "VALUE.SYNCED" },
  on: {
    NAVIGATE: { target: "navigating", actions: ["navigate"], reason: "navigate", reenter: true },
  },
  states: {
    tracking: {
      on: { POSITION: { actions: ["observe", "follow"], reason: "scroll" } },
    },
    /** A followed link's jump is scrolling: the position is recorded, not followed. */
    navigating: {
      after: { settle: { target: "tracking", actions: ["catchUp"], reason: "scroll" } },
      on: {
        // Each scrolled frame restarts the quiet time.
        POSITION: { target: "navigating", actions: ["observe"], reenter: true },
        "USER.SCROLL": { target: "tracking", actions: ["catchUp"], reason: "scroll" },
      },
    },
  },
})

export type TableOfContentsMachine = typeof tableOfContentsMachine
