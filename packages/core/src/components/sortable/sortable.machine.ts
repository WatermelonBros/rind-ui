// Sortable (add-sortable design §1): reordering an ordered list of keys. A keyboard pick-up
// moves the item one position at a time, reordering live (positions, never pixels: dnd-kit
// #2106); Escape restores the order from the pick-up; a pointer drag reorders once, on drop.
// Every step is announced with the position from the current order (dnd-kit #1858), one
// polite message replacing the last (#1750). The active item leaving `items` ends the session
// (React Aria #10599): decided on the data, not on unmount timing.

import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs } from "../../machine/types"
import type { SortableMessages } from "./sortable.messages"

export type SortableReason = "keyboard" | "pointer" | "quick" | "cancel"

export interface SortableReorderDetails {
  /** The moved item. */
  readonly key: string
  /** Its index before and after this change. */
  readonly from: number
  readonly to: number
  readonly reason: SortableReason
}

export type SortableEvent =
  | { readonly type: "PICK"; readonly key: string }
  | { readonly type: "MOVE"; readonly by: 1 | -1 }
  | { readonly type: "MOVE.TO"; readonly edge: "first" | "last" }
  | { readonly type: "QUICK"; readonly key: string; readonly by: 1 | -1 }
  | { readonly type: "DROP" }
  | { readonly type: "CANCEL" }
  | { readonly type: "DRAG.START"; readonly key: string }
  /** The index the item would land at. */
  | { readonly type: "DRAG.OVER"; readonly index: number }
  | { readonly type: "DRAG.END" }
  /** `items` changed (onProps): the active item may have left the list. */
  | { readonly type: "ITEMS.SYNCED" }

export interface SortableProps {
  readonly id: string
  /** The keys in their current order (controlled: the consumer reorders its data). */
  readonly items: readonly string[]
  readonly onReorder?:
    | ((keys: readonly string[], details: SortableReorderDetails) => void)
    | undefined
  /** Keys that cannot be moved (they can be passed). */
  readonly disabledKeys?: ReadonlySet<string> | undefined
  /** Each key's spoken label (from the Items). */
  readonly labels?: ReadonlyMap<string, string> | undefined
  readonly messages: SortableMessages
  readonly lang?: string | undefined
}

export interface SortableContext {
  /** The picked-up or dragged key. */
  readonly active: string | null
  /** The order at pick-up (Escape restores it). */
  readonly start: readonly string[]
  /** The pointer drag's target index. */
  readonly target: number | null
}

type Types = {
  props: SortableProps
  events: SortableEvent
  env: AnnouncerEnv
  context: SortableContext
}
type Args = ActionArgs<Types>

/** `order` with `key` moved to index `to` (clamped). */
export function reorder(order: readonly string[], key: string, to: number): string[] {
  const rest = order.filter((k) => k !== key)
  const at = Math.max(0, Math.min(rest.length, to))
  return [...rest.slice(0, at), key, ...rest.slice(at)]
}

const movable = (props: SortableProps, key: string) =>
  props.items.includes(key) && props.disabledKeys?.has(key) !== true

const labelOf = (props: SortableProps, key: string) => props.labels?.get(key) ?? key

function say(args: Args, message: string) {
  args.env.announcer.announce({
    message,
    priority: "polite",
    key: `sortable-${args.props.id}`,
    ...(args.props.lang === undefined ? {} : { lang: args.props.lang }),
  })
}

/** Moves `key` to `to`, reports the new order; returns it (positions are announced from it). */
function commit(args: Args, key: string, to: number, reason: SortableReason): readonly string[] {
  const { props } = args
  const from = props.items.indexOf(key)
  const next = reorder(props.items, key, to)
  const at = next.indexOf(key)
  if (at !== from) props.onReorder?.(next, { key, from, to: at, reason })
  return next
}

const position = (order: readonly string[], key: string) => order.indexOf(key) + 1

export const sortableMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    canPick: ({ props, event }) =>
      (event.type === "PICK" || event.type === "DRAG.START" || event.type === "QUICK") &&
      movable(props, event.key),
    /** The active item left `items` (removed, filtered): the session ends (React Aria #10599). */
    sourceLost: ({ context, props }) =>
      context.active !== null && !props.items.includes(context.active),
  },
  actions: {
    pick: (args) => {
      const { event, props, set } = args
      if (event.type !== "PICK") return
      set("active", event.key)
      set("start", props.items)
      const n = props.items.length
      say(
        args,
        props.messages.pickedUp(labelOf(props, event.key), position(props.items, event.key), n),
      )
    },
    move: (args) => {
      const { event, context, props } = args
      const key = context.active
      if (!key) return
      const from = props.items.indexOf(key)
      const to =
        event.type === "MOVE"
          ? from + event.by
          : event.type === "MOVE.TO"
            ? event.edge === "first"
              ? 0
              : props.items.length - 1
            : from
      if (to < 0 || to >= props.items.length || to === from) return
      const next = commit(args, key, to, "keyboard")
      say(args, props.messages.moved(labelOf(props, key), position(next, key), next.length))
    },
    drop: (args) => {
      const { context, props, set } = args
      const key = context.active
      if (key) {
        say(
          args,
          props.messages.dropped(
            labelOf(props, key),
            position(props.items, key),
            props.items.length,
          ),
        )
      }
      set("active", null)
      set("target", null)
    },
    cancel: (args) => {
      const { context, props, set } = args
      const key = context.active
      if (key && context.start.length > 0) {
        const from = props.items.indexOf(key)
        const to = context.start.indexOf(key)
        if (from !== to && from >= 0)
          props.onReorder?.(context.start, { key, from, to, reason: "cancel" })
        say(args, props.messages.cancelled(labelOf(props, key), to + 1, context.start.length))
      }
      set("active", null)
      set("target", null)
    },
    quick: (args) => {
      const { event, props } = args
      if (event.type !== "QUICK") return
      const from = props.items.indexOf(event.key)
      const to = from + event.by
      if (to < 0 || to >= props.items.length) return
      const next = commit(args, event.key, to, "quick")
      say(
        args,
        props.messages.quickMoved(
          labelOf(props, event.key),
          position(next, event.key),
          next.length,
        ),
      )
    },
    dragStart: ({ event, props, set }) => {
      if (event.type !== "DRAG.START") return
      set("active", event.key)
      set("start", props.items)
      set("target", props.items.indexOf(event.key))
    },
    dragOver: ({ event, set, context }) => {
      if (event.type === "DRAG.OVER" && event.index !== context.target) set("target", event.index)
    },
    dragEnd: (args) => {
      const { context, props, set } = args
      const key = context.active
      if (key && context.target !== null) {
        const next = commit(args, key, context.target, "pointer")
        say(args, props.messages.dropped(labelOf(props, key), position(next, key), next.length))
      }
      set("active", null)
      set("target", null)
    },
    release: ({ set }) => {
      set("active", null)
      set("target", null)
    },
  },
}).machine({
  id: "sortable",
  initial: "idle",
  context: () => ({ active: null, start: [], target: null }),
  onProps: { items: "ITEMS.SYNCED" },
  states: {
    idle: {
      on: {
        PICK: { guard: "canPick", target: "moving", actions: ["pick"] },
        QUICK: { guard: "canPick", actions: ["quick"] },
        "DRAG.START": { guard: "canPick", target: "dragging", actions: ["dragStart"] },
      },
    },
    /** Picked up by keyboard: arrows move it live. */
    moving: {
      on: {
        MOVE: { actions: ["move"] },
        "MOVE.TO": { actions: ["move"] },
        DROP: { target: "idle", actions: ["drop"] },
        CANCEL: { target: "idle", actions: ["cancel"] },
        "ITEMS.SYNCED": { guard: "sourceLost", target: "idle", actions: ["release"] },
      },
    },
    /** Dragged by a pointer: the order changes once, on drop. */
    dragging: {
      on: {
        "DRAG.OVER": { actions: ["dragOver"] },
        "DRAG.END": { target: "idle", actions: ["dragEnd"] },
        CANCEL: { target: "idle", actions: ["release"] },
        "ITEMS.SYNCED": { guard: "sourceLost", target: "idle", actions: ["release"] },
      },
    },
  },
})

export type SortableMachine = typeof sortableMachine
