// Toolbar (design §1): the collections' roving focus over the toolbar's controls (its own
// and the items of hosted composites), no selection. The highlight survives BLUR: it is
// the "last focused control" memory the tab stop is computed from. FOCUS only highlights
// (focus never commits); FOCUS_TOOLBAR is the programmatic `focus()`.

import { tabStop } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"

export type ToolbarEvent =
  | { readonly type: "NAVIGATE"; readonly move: "next" | "previous" | "first" | "last" }
  | { readonly type: "FOCUS"; readonly key: CollectionKey; readonly modality: Modality }
  | { readonly type: "BLUR" }
  /** The programmatic `focus()`: the current tab stop, with the programmatic source. */
  | { readonly type: "FOCUS_TOOLBAR" }
  | { readonly type: "COLLECTION.CHANGE" }

export interface ToolbarProps extends CollectionProps {
  readonly orientation?: "horizontal" | "vertical" | undefined
  readonly disabled?: boolean | undefined
}

const pieces = collectionPieces({})
type Args = Parameters<typeof pieces.actions.navigate>[0]

/** The tab stop: the remembered control if navigable, else the first navigable one. */
const stopOf = (props: ToolbarProps, highlighted: CollectionKey | null) =>
  tabStop({
    collection: props.collection,
    highlightedKey: highlighted,
    highlightSource: null,
    selection: new Set(),
    selectionMode: "none",
    focusableWhenDisabled: props.focusableWhenDisabled === true,
  })

export const toolbarMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ToolbarProps
    events: ToolbarEvent
    env: CollectionEnv
    context: CollectionContext
  }>(),
  actions: {
    navigate: (a) => pieces.actions.navigate(a as unknown as Args), // same args, wider event union
    focusHighlighted: (a) => pieces.actions.focusHighlighted(a as unknown as Args), // as above
    repairCollection: (a) => pieces.actions.repairCollection(a as unknown as Args), // as above
    keepFocusInside: (a) => pieces.actions.keepFocusInside(a as unknown as Args), // as above
    highlightFocused: ({ event, props, set }) => {
      if (event.type !== "FOCUS" || !props.collection.has(event.key)) return
      set("highlightedKey", event.key)
      const pointer = event.modality === "pointer" || event.modality === "touch"
      set("highlightSource", pointer ? "pointer" : "keyboard")
      set("scrollReason", null)
    },
    focusStop: ({ props, context, env, set }) => {
      const key = stopOf(props, context.highlightedKey)
      if (key === null) return
      set("highlightedKey", key)
      const el = env.dom.getById(props.ids.item(key))
      if (!el) return
      env.modality.markFocus(el, "programmatic")
      el.focus({ preventScroll: true })
    },
  },
}).machine({
  id: "toolbar",
  initial: "idle",
  context: (props) => ({ ...initialCollectionContext(), lastCollection: props.collection }),
  onProps: { collection: "COLLECTION.CHANGE" },
  on: {
    FOCUS_TOOLBAR: { actions: ["focusStop"] },
  },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused", actions: ["highlightFocused"] },
        "COLLECTION.CHANGE": { actions: ["repairCollection"] },
      },
    },
    focused: {
      on: {
        NAVIGATE: { actions: ["navigate", "focusHighlighted"] },
        FOCUS: { actions: ["highlightFocused"] },
        BLUR: "idle",
        // The focused control removed: focus follows the repaired highlight, never <body>.
        "COLLECTION.CHANGE": { actions: ["repairCollection", "keepFocusInside"] },
      },
    },
  },
})

export type ToolbarMachine = typeof toolbarMachine
