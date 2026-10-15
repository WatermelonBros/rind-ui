// Tabs (design "Machine"): the collections' roving focus with one selected tab. A focus
// never selects (any modality: a virtual cursor, a script, a dialog: radix#1047); in
// automatic mode a keyboard move selects in the same transition; a press selects in both
// modes. Uncontrolled Tabs pick the first enabled tab once the tabs register (reason
// INITIAL) and repair a removed selection (reason COLLECTION.CHANGE).

import { type CollectionKey, toKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { navigableWhen, repair } from "../../collection/navigation"
import type { Modality } from "../../contract/env"
import {
  type IndicatorBox,
  type IndicatorCause,
  type MeasuredIndicator,
  nextIndicator,
} from "../../dom/selection-indicator"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type TabsEvent =
  /** Arrows, Home, End (always keyboard). */
  | { readonly type: "NAVIGATE"; readonly move: "next" | "previous" | "first" | "last" }
  /** A press on a tab: pointer, touch, Enter, Space or a bare click. */
  | { readonly type: "PRESS"; readonly key: CollectionKey; readonly modality: Modality }
  | { readonly type: "FOCUS"; readonly key: CollectionKey; readonly modality: Modality }
  | { readonly type: "BLUR" }
  | { readonly type: "COLLECTION.CHANGE" }
  /** The first enabled tab, once the tabs registered (uncontrolled, no default). */
  | { readonly type: "INITIAL"; readonly key: CollectionKey }
  /** `beforematch` on an inactive panel (until-found). */
  | { readonly type: "find-in-page"; readonly key: CollectionKey }
  | { readonly type: "PANEL.TABBABLE"; readonly key: CollectionKey; readonly tabbable: boolean }
  | {
      readonly type: "INDICATOR.MEASURE"
      readonly box: IndicatorBox | null
      readonly cause: IndicatorCause
    }

export interface TabsProps extends CollectionProps {
  readonly value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<TabsEvent>) => void)
    | undefined
  /** `automatic` (default): a keyboard move selects; `manual`: Enter or Space selects. */
  readonly activationMode?: "automatic" | "manual" | undefined
  readonly disabled?: boolean | undefined
}

export type TabsContext = CollectionContext & {
  readonly indicator: MeasuredIndicator | null
  /** Whether each visible panel contains a tabbable element (else it is itself a stop). */
  readonly panelTabbable: Readonly<Record<string, boolean>>
  /** The direction of the last selection change in collection order. */
  readonly direction: "next" | "previous" | "none"
  /** The tab whose panel find-in-page revealed, until the next selection (data-reveal). */
  readonly revealed: CollectionKey | null
}

const pieces = collectionPieces({})
type Args = Parameters<typeof pieces.actions.navigate>[0]
/** "Nothing selected": controllable value types are non-nullable; the runtime keeps null. */
const NONE = null as unknown as string

/** A tab that can hold the roving focus (a disabled one only with focusableWhenDisabled). */
const focusable = (props: TabsProps, key: CollectionKey) => {
  const node = props.collection.get(key)
  if (!node) return false
  return props.focusableWhenDisabled === true || (!node.disabled && props.disabled !== true)
}

type Direction = TabsContext["direction"]
/** The selection of `key` (never a disabled tab) and its direction, or null when refused. */
function selection(
  props: TabsProps,
  from: string | undefined,
  key: CollectionKey,
): { readonly key: CollectionKey; readonly direction: Direction } | null {
  const node = props.collection.get(key)
  if (!node || node.disabled || props.disabled === true) return null
  const fromIndex = from == null ? -1 : (props.collection.get(toKey(from))?.index ?? -1)
  const direction: Direction =
    fromIndex < 0 || node.index === fromIndex
      ? "none"
      : node.index > fromIndex
        ? "next"
        : "previous"
  return { key, direction }
}

export const tabsMachine = setup({
  types: type<{
    props: TabsProps
    events: TabsEvent
    env: CollectionEnv
    context: TabsContext
    values: "value"
  }>(),
  guards: {
    automatic: ({ props }) => props.activationMode !== "manual",
  },
  actions: {
    navigate: (a) => pieces.actions.navigate(a as unknown as Args), // same args, wider event union
    focusHighlighted: (a) => pieces.actions.focusHighlighted(a as unknown as Args), // as above
    scrollToHighlighted: (a) => pieces.actions.scrollToHighlighted(a as unknown as Args), // as above
    repairCollection: (a) => pieces.actions.repairCollection(a as unknown as Args), // as above
    selectHighlighted: (a) => {
      const key = a.context.highlightedKey
      const next = key === null ? null : selection(a.props, a.values.value, key)
      if (!next) return
      a.set("direction", next.direction)
      a.set("revealed", null)
      a.set("value", next.key)
    },
    highlightFocused: ({ event, props, context, set }) => {
      if (event.type !== "FOCUS" || context.highlightedKey === event.key) return
      if (!focusable(props, event.key)) return
      set("highlightedKey", event.key)
      const pointer = event.modality === "pointer" || event.modality === "touch"
      set("highlightSource", pointer ? "pointer" : "keyboard")
      set("scrollReason", null)
    },
    selectPressed: (a) => {
      const { event, props, set } = a
      if (event.type !== "PRESS" && event.type !== "find-in-page" && event.type !== "INITIAL") {
        return
      }
      if (!props.collection.has(event.key)) return
      if (event.type === "PRESS" && focusable(props, event.key)) {
        set("highlightedKey", event.key)
        set("highlightSource", event.modality === "keyboard" ? "keyboard" : "pointer")
        // A press never scrolls the list under the pointer (ariakit#4132).
        set("scrollReason", null)
      }
      const next = selection(props, a.values.value, event.key)
      if (!next) return
      set("direction", next.direction)
      set("revealed", event.type === "find-in-page" ? event.key : null)
      set("value", next.key)
    },
    /**
     * Uncontrolled only: a first selection once the tabs registered (INITIAL), or a
     * repair when the selected tab left the collection. Controlled values are untouched.
     */
    ensureSelection: ({ props, values, context, send, set }) => {
      if (props.value !== undefined) return
      const c = props.collection
      if (c.size === 0) return
      const navigable = navigableWhen(false)
      let first: CollectionKey | null = null
      for (let i = 0; i < c.size && first === null; i++) {
        const node = c.at(i)
        if (node && navigable(node)) first = node.key
      }
      const current = values.value
      if (current == null) {
        if (props.defaultValue != null || first === null) return
        send({ type: "INITIAL", key: first })
        return
      }
      if (c.has(toKey(current))) return
      // The selected tab left (or a stale default never existed): the repair target, else
      // the first enabled tab (headlessui#1092).
      const target = repair(context.lastCollection, c, toKey(current), navigable) ?? first
      set("value", target ?? NONE)
    },
    /** Leaving the list: the roving stop follows the selection (base-ui#2100). */
    syncHighlightToSelection: ({ set }) => set("highlightedKey", null),
    setPanelTabbable: ({ event, context, set }) => {
      if (event.type !== "PANEL.TABBABLE") return
      if (context.panelTabbable[event.key] === event.tabbable) return
      set("panelTabbable", { ...context.panelTabbable, [event.key]: event.tabbable })
    },
    setIndicator: ({ event, context, set }) => {
      if (event.type !== "INDICATOR.MEASURE") return
      const next = nextIndicator(context.indicator, event.box, event.cause)
      if (next !== undefined) set("indicator", next)
    },
  },
}).machine({
  id: "tabs",
  initial: "idle",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: props.collection,
    indicator: null,
    panelTabbable: {},
    direction: "none",
    revealed: null,
  }),
  values: { value: { fallback: NONE } },
  onProps: { collection: "COLLECTION.CHANGE" },
  on: {
    // The prior collection is read by the repair, so ensureSelection runs first.
    "COLLECTION.CHANGE": { actions: ["ensureSelection", "repairCollection"] },
    INITIAL: { actions: ["selectPressed"] },
    "find-in-page": { actions: ["selectPressed"] },
    "PANEL.TABBABLE": { actions: ["setPanelTabbable"] },
    "INDICATOR.MEASURE": { actions: ["setIndicator"] },
  },
  states: {
    idle: {
      // Tabs given a collection at creation (no registration step) pick theirs at start;
      // idempotent on later entries.
      entry: ["ensureSelection"],
      on: {
        FOCUS: { target: "focused", actions: ["highlightFocused"] },
        // A press focuses its tab: the list is entered.
        PRESS: { target: "focused", actions: ["selectPressed", "focusHighlighted"] },
      },
    },
    focused: {
      exit: ["syncHighlightToSelection"],
      on: {
        NAVIGATE: [
          {
            guard: "automatic",
            actions: ["navigate", "selectHighlighted", "focusHighlighted", "scrollToHighlighted"],
          },
          { actions: ["navigate", "focusHighlighted", "scrollToHighlighted"] },
        ],
        FOCUS: { actions: ["highlightFocused"] },
        PRESS: { actions: ["selectPressed", "focusHighlighted"] },
        BLUR: "idle",
      },
    },
  },
})

export type TabsMachine = typeof tabsMachine
