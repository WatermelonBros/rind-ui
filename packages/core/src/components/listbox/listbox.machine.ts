// Listbox (design §1): the collections reference list made public. Navigation, selection,
// typeahead and repair are the collection pieces; this adds selection-follows-focus in the
// replace behaviour, actions, the public value shapes and the entry highlight. Two states:
// only "focus is inside" changes behaviour.

import type { Modality } from "../../a11y/events"
import { tabStop } from "../../collection/composite"
import { type CollectionKey, toKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionEvent,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { type SelectionValue, selectedKeys } from "../../collection/selection"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

/** The public value: one key or null (single), keys or "all" (multiple). */
export type ListboxValue = string | null | readonly string[] | "all"

export type ListboxActionVia = "press" | "enter" | "double-press"

export interface ListboxActionDetails {
  readonly modality: Modality
  readonly via: ListboxActionVia
}

export type ListboxEvent =
  | CollectionEvent
  | { readonly type: "FOCUS"; readonly modality?: Modality }
  | {
      readonly type: "ACTION"
      readonly key: CollectionKey
      readonly modality: Modality
      readonly via: ListboxActionVia
    }

export interface ListboxProps extends CollectionProps {
  readonly value?: ListboxValue | undefined
  readonly defaultValue?: ListboxValue | undefined
  readonly onValueChange?:
    | ((value: ListboxValue, details: ChangeDetails<ListboxEvent>) => void)
    | undefined
  readonly onAction?: ((key: string, details: ListboxActionDetails) => void) | undefined
  readonly orientation?: "vertical" | "horizontal" | undefined
  readonly disabled?: boolean | undefined
}

/** The value as a selection. */
export function selectionOf(value: ListboxValue | undefined): SelectionValue {
  if (value === "all") return "all"
  if (value === null || value === undefined) return new Set()
  return new Set((typeof value === "string" ? [value] : value).map(toKey))
}

/** A selection in the public shape of the mode: keys in collection order. */
export function listboxValueOf(
  s: SelectionValue,
  props: Pick<ListboxProps, "selectionMode" | "collection">,
): ListboxValue {
  const mode = props.selectionMode ?? "single"
  if (mode === "multiple" && s === "all") return "all"
  const keys = selectedKeys(props.collection, s)
  const order = (k: string) => props.collection.get(toKey(k))?.index ?? Number.MAX_SAFE_INTEGER
  const sorted = [...keys].sort((a, b) => order(a) - order(b))
  return mode === "multiple" ? sorted : (sorted[0] ?? null)
}

/** Set equality: a parent passing a new array with the same keys is not a change (RA#7947). */
export function sameValue(a: ListboxValue, b: ListboxValue): boolean {
  if (a === b) return true
  const x = selectionOf(a)
  const y = selectionOf(b)
  if (x === "all" || y === "all") return x === y
  return x.size === y.size && [...x].every((k) => y.has(k))
}

const pieces = collectionPieces({
  selection: {
    read: (values) => selectionOf(values["value"] as ListboxValue | undefined),
    // The public shape of the mode, keys in collection order.
    write: (s, collection, props) =>
      listboxValueOf(s, { selectionMode: props.selectionMode, collection }),
  },
})

/** null as the runtime's fallback: no selection (a controlled null is a value). */
const EMPTY = null as unknown as string

const behaviour = (props: ListboxProps) => props.selectionBehavior ?? "toggle"
const mode = (props: ListboxProps) => props.selectionMode ?? "single"

export const listboxMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ListboxProps
    events: ListboxEvent
    env: CollectionEnv
    context: CollectionContext
    values: "value"
  }>(),
  actions: {
    ...pieces.actions,
    /** Entering the list: the last highlight, else the first selected, else the first item. */
    highlightInitial: ({ context, props, values, event, set }) => {
      if (context.highlightedKey !== null && props.collection.has(context.highlightedKey)) return
      const key = tabStop({
        collection: props.collection,
        highlightedKey: null,
        highlightSource: null,
        selection: selectionOf(values.value),
        selectionMode: props.selectionMode ?? "single",
        focusableWhenDisabled: props.focusableWhenDisabled,
        disabledBehavior: props.disabledBehavior,
      })
      set("highlightedKey", key)
      // Tabbing in shows the focus ring on the item (data-focus-visible).
      const m = event.type === "FOCUS" ? event.modality : undefined
      const keyboard = m !== undefined && m !== "pointer" && m !== "touch"
      set("highlightSource", keyboard ? "keyboard" : "programmatic")
      set("scrollReason", null)
    },
    /** Selection follows focus (replace): the new highlight replaces the selection. */
    selectHighlighted: (a) => {
      const key = a.context.highlightedKey
      if (key === null) return
      const shift = a.event.type === "NAVIGATE" && a.event.extend === true
      a.send({ type: "SELECT", key, modality: "keyboard", shift, mod: false })
    },
    act: ({ event, props }) => {
      if (event.type === "ACTION") {
        props.onAction?.(event.key, { modality: event.modality, via: event.via })
      } else if (event.type === "SELECT") {
        props.onAction?.(event.key, {
          modality: event.modality,
          via: event.modality === "keyboard" ? "enter" : "press",
        })
      }
    },
  },
  guards: {
    ...pieces.guards,
    /** Replace: arrows (without mod) select; a screen reader's focus never does (rule 13). */
    followsFocus: ({ event, props }) =>
      event.type === "NAVIGATE" &&
      behaviour(props) === "replace" &&
      mode(props) !== "none" &&
      event.mod !== true &&
      // Shift+arrows extend the range in `navigate` itself: selecting again would fire twice.
      event.extend !== true &&
      event.move !== "expand" &&
      event.move !== "collapse",
    /** Typeahead in a single replace list selects the match. */
    typeaheadSelects: ({ props }) => behaviour(props) === "replace" && mode(props) === "single",
    noneMode: ({ props }) => mode(props) === "none",
    selectEnabled: ({ event, props }) =>
      event.type === "SELECT" && props.collection.get(event.key)?.disabled !== true,
    canAct: ({ event, props }) => {
      if (event.type !== "ACTION" || !props.onAction) return false
      const node = props.collection.get(event.key)
      return node !== undefined && !node.disabled
    },
  },
}).machine({
  id: "listbox",
  initial: "idle",
  context: (props) => ({ ...initialCollectionContext(), lastCollection: props.collection }),
  values: { value: { fallback: EMPTY, equal: sameValue as never } },
  onProps: { collection: "COLLECTION.CHANGE" },
  computed: {
    /** Keys a virtualizer must keep mounted: the highlighted item. */
    persistedKeys: (view) =>
      view.context.highlightedKey === null ? [] : [view.context.highlightedKey],
  },
  on: { "COLLECTION.CHANGE": { actions: ["repairCollection"] } },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused", actions: ["highlightInitial", "focusHighlighted"] },
        // An item focused by a click or by Tab reports itself before the list's FOCUS.
        HIGHLIGHT: { actions: ["highlight"] },
      },
    },
    focused: {
      exit: ["resetTypeahead"],
      on: {
        "COMPOSITE.BLUR": "idle",
        "COLLECTION.CHANGE": { actions: ["repairCollection", "keepFocusInside"] },
        FOCUS: { actions: ["focusHighlighted"] },
        NAVIGATE: [
          {
            guard: "followsFocus",
            actions: [
              "navigate",
              "scrollToHighlighted",
              "focusHighlighted",
              "selectHighlighted",
              "announceHighlighted",
            ],
          },
          {
            actions: ["navigate", "scrollToHighlighted", "focusHighlighted", "announceHighlighted"],
          },
        ],
        HIGHLIGHT: { actions: ["highlight", "scrollToHighlighted", "focusHighlighted"] },
        TYPEAHEAD: [
          {
            guard: "typeaheadSelects",
            actions: [
              "typeahead",
              "scrollToHighlighted",
              "focusHighlighted",
              "selectHighlighted",
              "announceHighlighted",
            ],
          },
          {
            actions: [
              "typeahead",
              "scrollToHighlighted",
              "focusHighlighted",
              "announceHighlighted",
            ],
          },
        ],
        // With no selection, a press or Enter is an action.
        SELECT: [
          // A disabled item never acts (a click reaches it through the composite).
          { guard: { and: ["noneMode", "selectEnabled"] }, actions: ["act"] },
          { guard: "noneMode" },
          { actions: ["select"] },
        ],
        SELECT_ALL: { actions: ["selectAll"] },
        CLEAR_SELECTION: { actions: ["clearSelection"] },
        DESELECT: { actions: ["deselect"] },
        ACTION: { guard: "canAct", actions: ["act"] },
      },
    },
  },
})
export type ListboxMachine = typeof listboxMachine
