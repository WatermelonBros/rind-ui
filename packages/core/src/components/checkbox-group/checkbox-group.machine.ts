// Checkbox Group (design §1): one state; the value is an array (a set), not bound to
// states, and the select-all cycle lives in context, so it advances the same controlled
// and uncontrolled (context written by a proposal's actions survives: base-ui#4552); a
// refused proposal ($reverted) ends it. Items and the Parent are Checkbox services the
// adapter wires to these events.

import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type CheckboxGroupEvent =
  | {
      readonly type: "ITEM.TOGGLE"
      readonly value: string
      readonly checked: boolean
      readonly modality: Modality
    }
  | { readonly type: "PARENT.TOGGLE"; readonly modality: Modality }
  | {
      readonly type: "ITEM.REGISTER"
      readonly value: string
      readonly id: string
      readonly disabled: boolean
    }
  | { readonly type: "ITEM.UNREGISTER"; readonly value: string; readonly id: string }
  | { readonly type: "RESET" }

export interface CheckboxGroupProps {
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<CheckboxGroupEvent>) => void)
    | undefined
  /** Every item value, in order: what the Parent selects (required with a Parent). */
  readonly allValues?: readonly string[] | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
}

export interface GroupItem {
  readonly id: string
  readonly disabled: boolean
}

type Cycle = "idle" | "all" | "none"

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v) => b.includes(v))

/** The Parent's state over `allValues`. */
export function parentStateOf(
  value: readonly string[],
  allValues: readonly string[],
): "checked" | "unchecked" | "indeterminate" {
  const n = allValues.filter((v) => value.includes(v)).length
  return n === 0 ? "unchecked" : n === allValues.length ? "checked" : "indeterminate"
}

/** Values the Parent may not change: disabled items (unregistered values count as enabled). */
const disabledOf = (items: ReadonlyMap<string, GroupItem>, allValues: readonly string[]) =>
  allValues.filter((v) => items.get(v)?.disabled === true)

/** Every enabled value plus the disabled ones already selected. */
export function selectableAll(
  value: readonly string[],
  allValues: readonly string[],
  items: ReadonlyMap<string, GroupItem>,
): string[] {
  const off = disabledOf(items, allValues)
  const outside = value.filter((v) => !allValues.includes(v))
  return [...outside, ...allValues.filter((v) => !off.includes(v) || value.includes(v))]
}

/** Only the disabled values already selected (and values outside `allValues`). */
export function selectableNone(
  value: readonly string[],
  allValues: readonly string[],
  items: ReadonlyMap<string, GroupItem>,
): string[] {
  const off = disabledOf(items, allValues)
  return value.filter((v) => !allValues.includes(v) || off.includes(v))
}

type Ctx = { cycle: Cycle; memory: readonly string[]; items: ReadonlyMap<string, GroupItem> }

export const checkboxGroupMachine = setup({
  types: type<{
    props: CheckboxGroupProps
    events: CheckboxGroupEvent
    env: object
    context: Ctx
    values: "value"
  }>(),
  guards: {
    interactive: ({ props }) => props.disabled !== true && props.readOnly !== true,
    cycleAll: ({ context }) => context.cycle === "all",
    cycleNone: ({ context }) => context.cycle === "none",
    /** The remembered selection is a partial one (only that is restored). */
    hasMemory: ({ props, context }) => {
      const all = props.allValues ?? []
      const m = context.memory
      return (
        !sameSet(m, selectableAll(m, all, context.items)) &&
        !sameSet(m, selectableNone(m, all, context.items))
      )
    },
    allSelectableSelected: ({ props, values, context }) => {
      const value = values.value ?? []
      return sameSet(value, selectableAll(value, props.allValues ?? [], context.items))
    },
    isPartial: ({ props, values, context }) => {
      const value = values.value ?? []
      const all = props.allValues ?? []
      return (
        !sameSet(value, selectableAll(value, all, context.items)) &&
        !sameSet(value, selectableNone(value, all, context.items))
      )
    },
  },
  actions: {
    toggleItem: ({ event, values, set }) => {
      if (event.type !== "ITEM.TOGGLE") return
      const value = values.value ?? []
      const next = event.checked
        ? value.includes(event.value)
          ? value
          : [...value, event.value]
        : value.filter((v) => v !== event.value)
      // Any item toggle ends the cycle and is the new remembered selection.
      set("memory", next)
      set("cycle", "idle")
      set("value", next)
    },
    selectAll: ({ props, values, context, set }) => {
      const value = values.value ?? []
      set("memory", value)
      set("cycle", "all")
      set("value", selectableAll(value, props.allValues ?? [], context.items))
    },
    selectNone: ({ props, values, context, set }) => {
      set("cycle", "none")
      set("value", selectableNone(values.value ?? [], props.allValues ?? [], context.items))
    },
    restoreMemory: ({ context, set }) => {
      set("cycle", "idle")
      set("value", context.memory)
    },
    register: ({ event, context, set }) => {
      if (event.type !== "ITEM.REGISTER") return
      const known = context.items.get(event.value)
      // Idempotent: a re-render re-registering the same item changes nothing.
      if (known?.id === event.id && known.disabled === event.disabled) return
      const items = new Map(context.items)
      items.set(event.value, { id: event.id, disabled: event.disabled })
      set("items", items)
    },
    unregister: ({ event, context, set }) => {
      if (event.type !== "ITEM.UNREGISTER") return
      // A later registration of the same value (a remount) may already have replaced it.
      if (context.items.get(event.value)?.id !== event.id) return
      const items = new Map(context.items)
      items.delete(event.value)
      set("items", items)
    },
    // The CURRENT defaultValue prop (the decision Checkbox and Form follow).
    resetValue: ({ props, set }) => set("value", props.defaultValue ?? []),
    endCycle: ({ set }) => set("cycle", "idle"),
  },
}).machine({
  id: "checkbox-group",
  initial: "ready",
  context: () => ({ cycle: "idle", memory: [], items: new Map() }),
  values: { value: { fallback: [], equal: sameSet } },
  states: {
    ready: {
      on: {
        "ITEM.TOGGLE": { guard: "interactive", actions: ["toggleItem"] },
        "PARENT.TOGGLE": [
          { guard: { and: ["interactive", "cycleAll"] }, actions: ["selectNone"] },
          {
            guard: { and: ["interactive", "cycleNone", "hasMemory"] },
            actions: ["restoreMemory"],
          },
          { guard: { and: ["interactive", "isPartial"] }, actions: ["selectAll"] },
          { guard: { and: ["interactive", "allSelectableSelected"] }, actions: ["selectNone"] },
          { guard: "interactive", actions: ["selectAll"] },
        ],
        "ITEM.REGISTER": { actions: ["register"] },
        "ITEM.UNREGISTER": { actions: ["unregister"] },
        RESET: { actions: ["resetValue", "endCycle"] },
        $reverted: { actions: ["endCycle"] },
      },
    },
  },
})

export type CheckboxGroupMachine = typeof checkboxGroupMachine
