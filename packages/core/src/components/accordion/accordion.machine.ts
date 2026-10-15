// Accordion (design §2): the group value. Each item is a controlled Collapsible whose
// proposals (trigger press, find-in-page) come here; the accordion decides. One state with
// internal edges: the coverage comes from the props configurations (multiple × collapsible
// × keyboardNavigation) and the per-contract invariants (a known shallowness).

import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

declare const process: { env: { NODE_ENV?: string } }

/** An item's value: a non-empty string, unique within the accordion. */
export type ItemKey = string & { readonly __brand: "AccordionItemKey" }

export function itemKey(value: string): ItemKey {
  if (value === "") throw new Error("[rind-ui] accordion: an item value must be a non-empty string")
  return value as ItemKey // non-empty, checked above
}

export interface AccordionItemInfo {
  readonly disabled: boolean
  /** Reachable by the optional arrow navigation (enabled, or focusable when disabled). */
  readonly focusable: boolean
}

type FocusMove = "FOCUS.NEXT" | "FOCUS.PREV" | "FOCUS.FIRST" | "FOCUS.LAST"

export type AccordionEvent =
  | {
      readonly type: "ITEM.REGISTER"
      readonly item: ItemKey
      readonly disabled: boolean
      readonly focusable: boolean
    }
  | { readonly type: "ITEM.UNREGISTER"; readonly item: ItemKey }
  | { readonly type: "ITEM.TOGGLE"; readonly item: ItemKey; readonly modality: Modality }
  | { readonly type: "ITEM.OPEN"; readonly item: ItemKey; readonly reason: "api" | "find-in-page" }
  | { readonly type: "ITEM.CLOSE"; readonly item: ItemKey; readonly reason: "api" }
  | { readonly type: FocusMove; readonly from: ItemKey }

export interface AccordionProps {
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<AccordionEvent>) => void)
    | undefined
  /** Several items open at once. */
  readonly multiple?: boolean | undefined
  /** Single mode: the open item can be closed (default true). Ignored when `multiple`. */
  readonly collapsible?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Arrow keys, Home and End move between triggers (APG 2026 makes them optional). */
  readonly keyboardNavigation?: boolean | undefined
  /** The adapter's DOM: the items in the document order of their triggers. */
  readonly triggerOrder?: ((items: readonly ItemKey[]) => readonly ItemKey[]) | undefined
  /** The adapter's DOM: focuses an item's trigger. */
  readonly focusTrigger?: ((item: ItemKey) => void) | undefined
}

const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((k) => b.includes(k))

const warnedMany = new WeakSet<readonly string[]>()
/** The open items: in single mode only the first (with a development warning). */
export function openKeysOf(value: readonly string[], multiple: boolean | undefined) {
  if (multiple === true || value.length <= 1) return value
  if (process.env.NODE_ENV !== "production" && !warnedMany.has(value)) {
    warnedMany.add(value)
    console.warn(
      `[rind-ui] accordion: value ${JSON.stringify(value)} has ${value.length} items but "multiple" is off; only "${value[0]}" is open`,
    )
  }
  return value.slice(0, 1)
}

/** Whether the open item of a non-collapsible single accordion is locked. */
export const isLocked = (props: Pick<AccordionProps, "multiple" | "collapsible">) =>
  props.multiple !== true && props.collapsible === false

type Ev<T extends AccordionEvent["type"]> = Extract<AccordionEvent, { type: T }>
// Every routed event names an item (`item`) or the trigger focus moves from (`from`).
const itemOf = (event: object): ItemKey => {
  const e = event as Partial<{ item: ItemKey; from: ItemKey }> // only item events reach these
  return (e.item ?? e.from) as ItemKey // present on every event these guards and actions see
}

export const accordionMachine = setup({
  types: type<{
    props: AccordionProps
    events: AccordionEvent
    env: object
    context: { items: ReadonlyMap<ItemKey, AccordionItemInfo> }
    values: "value"
  }>(),
  guards: {
    itemEnabled: ({ event, props, context }) =>
      props.disabled !== true && context.items.get(itemOf(event))?.disabled !== true,
    isOpen: ({ event, props, values }) =>
      openKeysOf(values.value ?? [], props.multiple).includes(itemOf(event)),
    canCollapse: ({ props }) => !isLocked(props),
    navigationEnabled: ({ props }) => props.keyboardNavigation === true,
  },
  actions: {
    register: ({ event, context, set }) => {
      const e = event as Ev<"ITEM.REGISTER"> // routed from ITEM.REGISTER only
      const items = new Map(context.items)
      items.set(e.item, { disabled: e.disabled, focusable: e.focusable })
      set("items", items)
    },
    unregister: ({ event, context, set }) => {
      const items = new Map(context.items)
      items.delete(itemOf(event))
      set("items", items)
    },
    openItem: ({ event, props, values, set }) => {
      const item = itemOf(event)
      set("value", props.multiple === true ? [...(values.value ?? []), item] : [item])
    },
    closeItem: ({ event, props, values, set }) => {
      const item = itemOf(event)
      set(
        "value",
        openKeysOf(values.value ?? [], props.multiple).filter((k) => k !== item),
      )
    },
    focusMove: ({ event, context, props }) => {
      const keys = [...context.items.keys()]
      const order = (props.triggerOrder?.(keys) ?? keys).filter(
        (k) => context.items.get(k)?.focusable !== false,
      )
      if (order.length === 0) return
      const from = order.indexOf(itemOf(event))
      const n = order.length
      const target =
        event.type === "FOCUS.FIRST"
          ? order[0]
          : event.type === "FOCUS.LAST"
            ? order[n - 1]
            : event.type === "FOCUS.NEXT"
              ? order[(from + 1) % n]
              : order[(from - 1 + n) % n]
      if (target !== undefined) props.focusTrigger?.(target)
    },
  },
}).machine({
  id: "accordion",
  initial: "idle",
  context: () => ({ items: new Map() }),
  values: { value: { fallback: [], equal: sameKeys } },
  states: {
    idle: {
      on: {
        "ITEM.REGISTER": { actions: ["register"] },
        "ITEM.UNREGISTER": { actions: ["unregister"] },
        "ITEM.TOGGLE": [
          { guard: { and: ["itemEnabled", "isOpen", "canCollapse"] }, actions: ["closeItem"] },
          { guard: { and: ["itemEnabled", { not: "isOpen" }] }, actions: ["openItem"] },
        ],
        // Find-in-page and the api; in single mode it replaces, and the lock never refuses it.
        "ITEM.OPEN": { guard: { not: "isOpen" }, actions: ["openItem"] },
        "ITEM.CLOSE": { guard: { and: ["isOpen", "canCollapse"] }, actions: ["closeItem"] },
        "FOCUS.NEXT": { guard: "navigationEnabled", actions: ["focusMove"] },
        "FOCUS.PREV": { guard: "navigationEnabled", actions: ["focusMove"] },
        "FOCUS.FIRST": { guard: "navigationEnabled", actions: ["focusMove"] },
        "FOCUS.LAST": { guard: "navigationEnabled", actions: ["focusMove"] },
      },
    },
  },
})

export type AccordionMachine = typeof accordionMachine
