// Radio Group (design "Machine"): the collections' roving focus with a single selection.
// A keyboard move checks the radio it lands on in the same transition (no keydown flag can
// race focus: radix#4094); a focus alone never checks (radix#938); pressing the checked
// radio is a no-op (no user deselect). Segmented Control reuses this machine unchanged.

import { type CollectionKey, toKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import type { Modality } from "../../contract/env"
import {
  type IndicatorBox,
  type IndicatorCause,
  type MeasuredIndicator,
  nextIndicator,
} from "../../dom/selection-indicator"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type RadioGroupEvent =
  /** An arrow key on a radio (always keyboard: assistive technology moves by focus). */
  | { readonly type: "NAVIGATE"; readonly move: "next" | "previous" }
  /** A press on a radio or its label (pointer, touch, Space, a bare click). */
  | { readonly type: "PRESS"; readonly key: CollectionKey; readonly modality: Modality }
  /** A radio received focus (any cause). */
  | { readonly type: "FOCUS"; readonly key: CollectionKey; readonly modality: Modality }
  /** Focus left the group. */
  | { readonly type: "BLUR" }
  | { readonly type: "COLLECTION.CHANGE" }
  | { readonly type: "RESET" }
  | {
      readonly type: "INDICATOR.MEASURE"
      readonly box: IndicatorBox | null
      readonly cause: IndicatorCause
    }

export interface RadioGroupProps extends CollectionProps {
  readonly value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<RadioGroupEvent>) => void)
    | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
}

export type RadioGroupContext = CollectionContext & {
  /** The measured selection indicator (Segmented Control's; Radio Group renders none). */
  readonly indicator: MeasuredIndicator | null
}

const pieces = collectionPieces({})

/**
 * "Nothing checked". Controllable value types are non-nullable, but the runtime keeps a
 * `null` like any value (and a controlled `value={null}` is controlled, not undefined).
 */
const NONE = null as unknown as string

type Args = Parameters<typeof pieces.actions.navigate>[0]

export const radioGroupMachine = setup({
  types: type<{
    props: RadioGroupProps
    events: RadioGroupEvent
    env: CollectionEnv
    context: RadioGroupContext
    values: "value"
  }>(),
  guards: {
    /** Read-only and disabled groups move but never check. */
    canCheck: ({ props }) => props.readOnly !== true && props.disabled !== true,
  },
  actions: {
    navigate: (a) => pieces.actions.navigate(a as unknown as Args), // same args, wider event union
    focusHighlighted: (a) => pieces.actions.focusHighlighted(a as unknown as Args), // as above
    repairCollection: (a) => pieces.actions.repairCollection(a as unknown as Args), // as above
    /** The radio a keyboard move landed on is checked (never a disabled one). */
    checkHighlighted: ({ context, props, set }) => {
      const key = context.highlightedKey
      const node = key === null ? undefined : props.collection.get(key)
      if (key === null || !node || node.disabled) return
      set("value", key)
    },
    highlightFocused: ({ event, props, context, set }) => {
      if (event.type !== "FOCUS" || context.highlightedKey === event.key) return
      if (!props.collection.has(event.key)) return
      set("highlightedKey", event.key)
      // A click or tap focuses without a ring; Tab, script or assistive technology show it.
      const pointer = event.modality === "pointer" || event.modality === "touch"
      set("highlightSource", pointer ? "pointer" : "keyboard")
    },
    /** A press that cannot check (read-only): it still focuses its radio. */
    highlightPressed: ({ event, props, set }) => {
      if (event.type !== "PRESS" || !props.collection.has(event.key)) return
      set("highlightedKey", event.key)
      set("highlightSource", event.modality === "keyboard" ? "keyboard" : "pointer")
    },
    /** A press checks its radio (pressing the checked one changes nothing). */
    checkPressed: ({ event, props, set }) => {
      if (event.type !== "PRESS") return
      const node = props.collection.get(event.key)
      if (!node || node.disabled) return
      set("highlightedKey", event.key)
      set("highlightSource", event.modality === "keyboard" ? "keyboard" : "pointer")
      set("value", event.key)
    },
    /** Leaving the group: the tab stop goes back to the checked radio (else the first). */
    clearHighlight: ({ set }) => set("highlightedKey", null),
    resetToDefault: ({ props, set }) => set("value", props.defaultValue ?? NONE),
    setIndicator: ({ event, context, set }) => {
      if (event.type !== "INDICATOR.MEASURE") return
      const next = nextIndicator(context.indicator, event.box, event.cause)
      if (next !== undefined) set("indicator", next)
    },
  },
}).machine({
  id: "radio-group",
  initial: "idle",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: props.collection,
    indicator: null,
  }),
  values: { value: { fallback: NONE } },
  onProps: { collection: "COLLECTION.CHANGE" },
  on: {
    "COLLECTION.CHANGE": { actions: ["repairCollection"] },
    RESET: { actions: ["resetToDefault"] },
    "INDICATOR.MEASURE": { actions: ["setIndicator"] },
  },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused", actions: ["highlightFocused"] },
        // A press focuses its radio: the group is entered.
        PRESS: [
          {
            target: "focused",
            guard: "canCheck",
            actions: ["checkPressed", "focusHighlighted"],
          },
          { target: "focused", actions: ["highlightPressed", "focusHighlighted"] },
        ],
      },
    },
    focused: {
      exit: ["clearHighlight"],
      on: {
        NAVIGATE: [
          { guard: "canCheck", actions: ["navigate", "checkHighlighted", "focusHighlighted"] },
          { actions: ["navigate", "focusHighlighted"] },
        ],
        FOCUS: { actions: ["highlightFocused"] },
        PRESS: [
          { guard: "canCheck", actions: ["checkPressed", "focusHighlighted"] },
          { actions: ["highlightPressed", "focusHighlighted"] },
        ],
        BLUR: "idle",
      },
    },
  },
})

export type RadioGroupMachine = typeof radioGroupMachine

/** The selection as the collection helpers read it. */
export const radioSelection = (value: string | null | undefined): ReadonlySet<CollectionKey> =>
  value === null || value === undefined ? new Set() : new Set([toKey(value)])
