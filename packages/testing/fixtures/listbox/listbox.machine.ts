// Test-only listbox fixture (add-collections): a list built only on the collection modules,
// in either focus strategy, with sections, disabled items, typeahead and multiple
// selection. Not published (Listbox gets its own change).
import {
  type ChangeDetails,
  type CollectionContext,
  type CollectionEnv,
  type CollectionEvent,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
  type Modality,
  type SelectionValue,
  selectedKeys,
  setup,
  tabStop,
  toKey,
  type,
} from "@rind-ui/core"

export type ListboxEvent = CollectionEvent | { type: "FOCUS"; modality?: Modality }

export interface ListboxProps extends CollectionProps {
  /** Selected keys (plain strings: branded at this boundary). */
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<ListboxEvent>) => void)
    | undefined
  readonly orientation?: "vertical" | "horizontal" | undefined
}

const pieces = collectionPieces({
  selection: {
    read: (values) =>
      new Set(((values["value"] as readonly string[] | undefined) ?? []).map(toKey)),
    // Public shape: keys in collection order (select all enumerates the loaded items).
    write: (s: SelectionValue, collection) => {
      const keys = selectedKeys(collection, s)
      const order = (k: string) => collection.get(toKey(k))?.index ?? Number.MAX_SAFE_INTEGER
      return [...keys].sort((a, b) => order(a) - order(b))
    },
  },
})

const sameKeys = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((k) => b.includes(k))

export const listboxMachine = setup({
  types: type<{
    props: ListboxProps
    events: ListboxEvent
    env: CollectionEnv
    context: CollectionContext
    values: "value"
  }>(),
  actions: {
    ...pieces.actions,
    /** Entering the list: the highlight starts at the tab stop (selected, else first). */
    highlightInitial: ({ context, props, values, event, set }) => {
      if (context.highlightedKey !== null) return
      const key = tabStop({
        collection: props.collection,
        highlightedKey: null,
        highlightSource: null,
        selection: new Set((values.value ?? []).map(toKey)),
        selectionMode: props.selectionMode ?? "none",
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
  },
  guards: pieces.guards,
}).machine({
  id: "listbox",
  initial: "idle",
  // The first collection is the baseline a later change is repaired against.
  context: (props) => ({ ...initialCollectionContext(), lastCollection: props.collection }),
  values: { value: { fallback: [], equal: sameKeys } },
  onProps: { collection: "COLLECTION.CHANGE" },
  computed: {
    /** Keys a virtualizer must keep mounted: the highlighted (and, roving, focused) item. */
    persistedKeys: (view) =>
      view.context.highlightedKey === null ? [] : [view.context.highlightedKey],
  },
  // Collection changes repair the highlight whether or not the list has focus.
  on: { "COLLECTION.CHANGE": { actions: ["repairCollection"] } },
  states: {
    idle: {
      on: {
        // Roving: focus on the list itself moves to the highlighted item.
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
        // Focus on the list itself (roving) is forwarded to the highlighted item.
        FOCUS: { actions: ["focusHighlighted"] },
        NAVIGATE: {
          actions: ["navigate", "scrollToHighlighted", "focusHighlighted", "announceHighlighted"],
        },
        HIGHLIGHT: {
          actions: ["highlight", "scrollToHighlighted", "focusHighlighted", "announceHighlighted"],
        },
        POINTER_MOVE: { actions: ["pointerMove"] },
        TYPEAHEAD: {
          actions: ["typeahead", "scrollToHighlighted", "focusHighlighted", "announceHighlighted"],
        },
        SELECT: { actions: ["select"] },
        SELECT_ALL: { actions: ["selectAll"] },
        CLEAR_SELECTION: { actions: ["clearSelection"] },
        DESELECT: { actions: ["deselect"] },
      },
    },
  },
})

export type ListboxMachine = typeof listboxMachine
