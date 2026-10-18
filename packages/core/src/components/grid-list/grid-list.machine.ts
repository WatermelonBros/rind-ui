// Grid List (design §2): rows that are selected, acted on or followed, and may hold controls.
// Navigation, selection, typeahead and repair are the collection pieces; this adds the
// collection-grid child position (row or one of its controls), spatial moves over a wrapped
// layout, the press rules of "Selection And Action" and the WebKit selection announcement.

import type { Modality } from "../../a11y/events"
import { tabStop } from "../../collection/composite"
import { childMove } from "../../collection/grid"
import { type CollectionKey, toKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionEvent,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { isSelected, type SelectionValue, selectedKeys } from "../../collection/selection"
import { quirkActive } from "../../dom/quirks"
import { controlsOf } from "../../dom/row-controls"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { type GridListMessages, gridListMessages } from "./grid-list.messages"

/** The public value: one key or null (single), keys (multiple). */
export type GridListValue = string | null | readonly string[]

export type GridListActionVia = "press" | "enter" | "double-press"
export interface GridListActionDetails {
  readonly modality: Modality
  readonly via: GridListActionVia
}

export type GridListEvent =
  | CollectionEvent
  /** Focus entered the list; `inner`: on a control, field or nested composite of a row. */
  | { readonly type: "FOCUS"; readonly modality?: Modality; readonly inner?: boolean }
  | {
      readonly type: "ACTION"
      readonly key: CollectionKey
      readonly modality: Modality
      readonly via: GridListActionVia
    }
  /** A press on a row's body (not a control): selection or action per the rules. */
  | {
      readonly type: "PRESS_ROW"
      readonly key: CollectionKey
      readonly modality: Modality
      readonly shift: boolean
      readonly mod: boolean
    }
  /** DOM focus entered a row or one of its controls (index 0 = the row). */
  | {
      readonly type: "FOCUS_CHILD"
      readonly key: CollectionKey
      readonly index: number
      /** A click or tap focused it: no ring. */
      readonly pointer: boolean
    }
  /** Arrows (arrow mode) or Escape between a row and its controls; `count`: its controls. */
  | {
      readonly type: "NAVIGATE_CHILD"
      readonly direction: "next" | "previous" | "row"
      readonly count: number
    }
  /** ArrowUp/Down in a wrapped layout: `target` measured by connect (null: not measurable). */
  | {
      readonly type: "NAVIGATE_SPATIAL"
      readonly direction: "up" | "down"
      readonly target: CollectionKey | null
    }

export interface GridListProps extends CollectionProps {
  readonly value?: GridListValue | undefined
  readonly defaultValue?: GridListValue | undefined
  readonly onValueChange?:
    | ((value: GridListValue, details: ChangeDetails<GridListEvent>) => void)
    | undefined
  readonly onAction?: ((key: string, details: GridListActionDetails) => void) | undefined
  /** Rows that render an ItemCheckbox: a press on their body never selects. */
  readonly checkboxes?: ReadonlySet<CollectionKey> | undefined
  readonly disabled?: boolean | undefined
  readonly messages?: Partial<GridListMessages> | undefined
}

export interface GridListContext extends CollectionContext {
  /** 0: the row has focus; 1..n: one of its controls. */
  readonly childIndex: number
  /** How often each row's action ran (`data-action-count`: drivers check a press's effect). */
  readonly actionCounts: Readonly<Record<string, number>>
}

export function gridSelectionOf(value: GridListValue | undefined): SelectionValue {
  if (value === null || value === undefined) return new Set()
  return new Set((typeof value === "string" ? [value] : value).map(toKey))
}

export function gridListValueOf(
  s: SelectionValue,
  props: Pick<GridListProps, "selectionMode" | "collection">,
): GridListValue {
  const keys = selectedKeys(props.collection, s)
  const order = (k: string) => props.collection.get(toKey(k))?.index ?? Number.MAX_SAFE_INTEGER
  const sorted = [...keys].sort((a, b) => order(a) - order(b))
  return props.selectionMode === "multiple" ? sorted : (sorted[0] ?? null)
}

export function sameGridValue(a: GridListValue, b: GridListValue): boolean {
  if (a === b) return true
  const x = gridSelectionOf(a)
  const y = gridSelectionOf(b)
  if (x === "all" || y === "all") return x === y
  return x.size === y.size && [...x].every((k) => y.has(k))
}

const pieces = collectionPieces({
  selection: {
    read: (values) => gridSelectionOf(values["value"] as GridListValue | undefined),
    write: (s, collection, props) =>
      gridListValueOf(s, { selectionMode: props.selectionMode, collection }),
  },
})

/** null as the runtime's fallback: no selection (a controlled null is a value). */
const EMPTY = null as unknown as string
const mode = (p: GridListProps) => p.selectionMode ?? "none"
const enabled = (p: GridListProps, key: CollectionKey) =>
  p.disabled !== true && p.collection.get(key)?.disabled !== true
/** `disabledBehavior="selection"`: a disabled row is not selectable but still acts. */
const actionable = (p: GridListProps, key: CollectionKey) =>
  p.disabled !== true &&
  (p.disabledBehavior === "selection" || p.collection.get(key)?.disabled !== true)

export const gridListMachine = setup({
  types: type<{
    props: GridListProps
    events: GridListEvent
    env: CollectionEnv
    context: GridListContext
    values: "value"
  }>(),
  actions: {
    ...pieces.actions,
    highlightInitial: ({ context, props, values, event, set }) => {
      if (context.highlightedKey !== null && props.collection.has(context.highlightedKey)) return
      const key = tabStop({
        collection: props.collection,
        highlightedKey: null,
        highlightSource: null,
        selection: gridSelectionOf(values.value),
        selectionMode: mode(props),
        focusableWhenDisabled: props.focusableWhenDisabled,
        disabledBehavior: props.disabledBehavior,
      })
      set("highlightedKey", key)
      const m = event.type === "FOCUS" ? event.modality : undefined
      set(
        "highlightSource",
        m !== undefined && m !== "pointer" && m !== "touch" ? "keyboard" : "programmatic",
      )
      set("scrollReason", null)
    },
    /** Selection And Action: the checkbox, mode and behaviour rules for a press on a row. */
    pressRow: ({ event, props, values, send, context, set }) => {
      const countAction = (k: string) =>
        set("actionCounts", { ...context.actionCounts, [k]: (context.actionCounts[k] ?? 0) + 1 })
      if (event.type !== "PRESS_ROW" || !actionable(props, event.key)) return
      const { key, modality } = event
      const act = () => {
        if (props.onAction) countAction(key)
        props.onAction?.(key, { modality, via: "press" })
      }
      if (props.checkboxes?.has(key) || mode(props) === "none" || !enabled(props, key)) {
        return act()
      }
      const empty = gridSelectionOf(values.value)
      const nothingSelected = empty !== "all" && empty.size === 0
      if (props.onAction && (props.selectionBehavior ?? "toggle") === "toggle" && nothingSelected) {
        return act()
      }
      send({ type: "SELECT", key, modality, shift: event.shift, mod: event.mod })
    },
    act: ({ event, props, context, set }) => {
      if (event.type !== "ACTION" || !actionable(props, event.key)) return
      if (props.onAction) {
        const k = event.key
        set("actionCounts", { ...context.actionCounts, [k]: (context.actionCounts[k] ?? 0) + 1 })
      }
      props.onAction?.(event.key, { modality: event.modality, via: event.via })
    },
    /** The row and child the DOM focus is on (a click on a control, Tab in tab mode). */
    focusChild: ({ event, set, context }) => {
      if (event.type !== "FOCUS_CHILD") return
      if (context.highlightedKey !== event.key) {
        set("highlightedKey", event.key)
        set("highlightSource", event.pointer ? "pointer" : "keyboard")
        set("scrollReason", null)
      }
      set("childIndex", event.index)
    },
    /** Moves between the row and its controls, and puts DOM focus there (core/dom). */
    navigateChild: ({ event, context, props, env, set }) => {
      if (event.type !== "NAVIGATE_CHILD" || context.highlightedKey === null) return
      const next = childMove(context.childIndex, event.count, event.direction)
      if (next === null) return
      set("childIndex", next)
      const row = env.dom.getById(props.ids.item(context.highlightedKey))
      if (!row) return
      const target = next === 0 ? row : controlsOf(row)[next - 1]
      ;(target as HTMLElement | undefined)?.focus()
    },
    resetChild: ({ set }) => set("childIndex", 0),
    /** The highlighted row was removed: its controls went with it. */
    resetChildIfRemoved: ({ context, props, set }) => {
      if (context.highlightedKey !== null && !props.collection.has(context.highlightedKey)) {
        set("childIndex", 0)
      }
    },
    /** Keeps focus in the list, unless it is still on a control inside a row. */
    keepFocusUnlessInRow: (a) => {
      const active = a.env.dom.activeElement()
      const list = a.env.dom.getById(a.props.ids.list)
      const row = active?.closest('[role="row"]')
      if (active?.isConnected && row && list?.contains(row) && row !== active) return
      pieces.actions.keepFocusInside(a)
    },
    /** Entering the list: the highlighted row takes focus unless a control of it already has. */
    enterFocus: (a) => {
      // Focus that landed inside a row (a nested Tag Group, a field) stays there.
      if (a.context.childIndex > 0 || (a.event.type === "FOCUS" && a.event.inner)) return
      pieces.actions.focusHighlighted(a)
    },
    /** Up/Down in a wrapped layout: the measured item, else collection order. */
    navigateSpatial: ({ event, send, props }) => {
      if (event.type !== "NAVIGATE_SPATIAL") return
      if (event.target !== null && props.collection.has(event.target)) {
        send({ type: "HIGHLIGHT", key: event.target, source: "keyboard" })
        return
      }
      send({ type: "NAVIGATE", move: event.direction === "down" ? "next" : "previous" })
    },
    /** VoiceOver with WebKit stays silent on aria-selected changes (quirk entry). */
    announceSelection: ({ event, props, values, env }) => {
      if (!quirkActive("webkit-grid-selection-not-announced", env)) return
      const messages = { ...gridListMessages, ...props.messages }
      const s = gridSelectionOf(values.value)
      let message: string | null = null
      const range =
        (event.type === "SELECT" && event.shift) || (event.type === "NAVIGATE" && event.extend)
      if (range) {
        // A range: the count, when more than the pressed row is selected.
        const count = selectedKeys(props.collection, s).length
        if (count > 1) message = messages.selectedCountAnnouncement(count)
      }
      if (message === null && event.type === "SELECT") {
        const name = props.collection.get(event.key)?.textValue ?? event.key
        message = isSelected(props.collection, s, event.key)
          ? messages.selectedAnnouncement(name)
          : messages.deselectedAnnouncement(name)
      } else if (event.type === "SELECT_ALL") {
        message = messages.selectedCountAnnouncement(selectedKeys(props.collection, s).length)
      }
      if (message === null) return
      env.announcer.announce({
        message,
        priority: "polite",
        key: `${props.ids.list}:selection`,
        lang: env.locale.locale(),
      })
    },
  },
  guards: {
    ...pieces.guards,
    selectable: ({ event, props }) =>
      event.type === "SELECT" && mode(props) !== "none" && enabled(props, event.key),
  },
}).machine({
  id: "grid-list",
  initial: "idle",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: props.collection,
    childIndex: 0,
    actionCounts: {},
  }),
  values: { value: { fallback: EMPTY, equal: sameGridValue as never } },
  onProps: { collection: "COLLECTION.CHANGE" },
  on: {
    "COLLECTION.CHANGE": { actions: ["repairCollection", "resetChild"] },
    PRESS_ROW: { actions: ["pressRow"] },
    ACTION: { actions: ["act"] },
    FOCUS_CHILD: { actions: ["focusChild"] },
    SELECT: { guard: "selectable", actions: ["select", "announceSelection"] },
    // The select-all checkbox may sit outside the list (focus is then not in it).
    SELECT_ALL: { actions: ["selectAll", "announceSelection"] },
    CLEAR_SELECTION: { actions: ["clearSelection"] },
  },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused", actions: ["highlightInitial", "enterFocus"] },
        HIGHLIGHT: { actions: ["highlight"] },
      },
    },
    focused: {
      exit: ["resetTypeahead", "resetChild"],
      on: {
        "COMPOSITE.BLUR": "idle",
        "COLLECTION.CHANGE": {
          actions: ["resetChildIfRemoved", "repairCollection", "keepFocusUnlessInRow"],
        },
        FOCUS: {},
        NAVIGATE: {
          actions: [
            "resetChild",
            "navigate",
            "scrollToHighlighted",
            "focusHighlighted",
            "announceSelection",
          ],
        },
        NAVIGATE_CHILD: { actions: ["navigateChild"] },
        NAVIGATE_SPATIAL: { actions: ["navigateSpatial"] },
        HIGHLIGHT: {
          actions: ["resetChild", "highlight", "scrollToHighlighted", "focusHighlighted"],
        },
        TYPEAHEAD: {
          actions: ["resetChild", "typeahead", "scrollToHighlighted", "focusHighlighted"],
        },
        DESELECT: { actions: ["deselect"] },
      },
    },
  },
})
export type GridListMachine = typeof gridListMachine
