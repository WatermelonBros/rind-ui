// Toggle Group (design "Machine"): the collections' roving focus with a toggle selection.
// Only PRESS changes the value (arrows only move, focus never commits); single mode
// replaces, both modes deselect unless empty is disallowed. Items are Toggles whose
// pressed state the group owns.

import { type CollectionKey, toKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { select } from "../../collection/selection"
import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type ToggleGroupEvent =
  /** Arrows, Home and End: focus only. */
  | { readonly type: "NAVIGATE"; readonly move: "next" | "previous" | "first" | "last" }
  | { readonly type: "PRESS"; readonly key: CollectionKey; readonly modality: Modality }
  | { readonly type: "FOCUS"; readonly key: CollectionKey; readonly modality: Modality }
  | { readonly type: "BLUR" }
  | { readonly type: "COLLECTION.CHANGE" }

export interface ToggleGroupProps extends CollectionProps {
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<ToggleGroupEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
}

const pieces = collectionPieces({})
type Args = Parameters<typeof pieces.actions.navigate>[0]

const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((k) => b.includes(k))

export const toggleGroupMachine = setup({
  types: type<{
    props: ToggleGroupProps
    events: ToggleGroupEvent
    env: CollectionEnv
    context: CollectionContext
    values: "value"
  }>(),
  actions: {
    navigate: (a) => pieces.actions.navigate(a as unknown as Args), // same args, wider event union
    focusHighlighted: (a) => pieces.actions.focusHighlighted(a as unknown as Args), // as above
    repairCollection: (a) => pieces.actions.repairCollection(a as unknown as Args), // as above
    highlightFocused: ({ event, props, context, set }) => {
      if (event.type !== "FOCUS" || context.highlightedKey === event.key) return
      if (!props.collection.has(event.key)) return
      set("highlightedKey", event.key)
      const pointer = event.modality === "pointer" || event.modality === "touch"
      set("highlightSource", pointer ? "pointer" : "keyboard")
    },
    /** A press toggles its item (single replaces; empty only when allowed). */
    toggleKey: ({ event, props, values, set }) => {
      if (event.type !== "PRESS") return
      const node = props.collection.get(event.key)
      if (!node || node.disabled || props.disabled === true) return
      set("highlightedKey", event.key)
      set("highlightSource", event.modality === "keyboard" ? "keyboard" : "pointer")
      const current = new Set((values.value ?? []).map(toKey))
      const r = select(
        props.collection,
        current,
        null,
        { key: event.key, modality: event.modality, shift: false, mod: false },
        {
          mode: props.selectionMode === "multiple" ? "multiple" : "single",
          behavior: "toggle",
          disallowEmpty: props.disallowEmptySelection === true,
          disabledBehavior: "all",
        },
      )
      if (r.value === "all") return
      // In document (collection) order.
      const next = [...r.value].sort(
        (a, b) =>
          (props.collection.get(a)?.index ?? Number.MAX_SAFE_INTEGER) -
          (props.collection.get(b)?.index ?? Number.MAX_SAFE_INTEGER),
      )
      set("value", next)
    },
    clearHighlight: ({ set }) => set("highlightedKey", null),
  },
}).machine({
  id: "toggle-group",
  initial: "idle",
  context: (props) => ({ ...initialCollectionContext(), lastCollection: props.collection }),
  values: { value: { fallback: [], equal: sameKeys } },
  onProps: { collection: "COLLECTION.CHANGE" },
  on: { "COLLECTION.CHANGE": { actions: ["repairCollection"] } },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused", actions: ["highlightFocused"] },
        // A press focuses its item (Safari does not: radix#703): the group is entered.
        PRESS: { target: "focused", actions: ["toggleKey", "focusHighlighted"] },
      },
    },
    focused: {
      exit: ["clearHighlight"],
      on: {
        NAVIGATE: { actions: ["navigate", "focusHighlighted"] },
        FOCUS: { actions: ["highlightFocused"] },
        PRESS: { actions: ["toggleKey", "focusHighlighted"] },
        BLUR: "idle",
      },
    },
  },
})

export type ToggleGroupMachine = typeof toggleGroupMachine
