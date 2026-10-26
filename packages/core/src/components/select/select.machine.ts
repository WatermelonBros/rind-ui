// Select (design §1): a flat closed | open graph with two controllables, `open` and `value`.
// Everything inside the popup is the collection pieces (as Listbox); on the closed trigger a
// typeahead selects the match (single mode). The overlay (modal layer of kind `listbox`, the
// trigger and label inside it), positioning and initial focus are one effect of `open`;
// initial focus waits for the first placement and centres the selected option first.

import type { Modality } from "../../a11y/events"
import type { CollectionKey } from "../../collection/key"
import { toKey } from "../../collection/key"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionEvent,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { move, navigableWhen } from "../../collection/navigation"
import { isSelected, type SelectionValue } from "../../collection/selection"
import { idleTypeahead, typeahead } from "../../collection/typeahead"
import type { DismissRequest } from "../../dom/dismiss"
import { focusSafely } from "../../dom/focus-safely"
import { deepActiveElement, focusInitial } from "../../dom/focus-scope"
import { type LayerId, layerId } from "../../dom/layer-stack"
import { overlayEffect } from "../../dom/overlay"
import { type PlacementState, placementFrom, unplaced } from "../../dom/position/connect"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import type { BaseDomEnvironment } from "../../env/base-environment"
import type {
  Align,
  PositionEnv,
  PositioningOptions,
  PositioningProps,
  Side,
} from "../../env/position"
import { collator } from "../../i18n/messages"
import { itemId, partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { listboxValueOf, sameValue, selectionOf } from "../listbox/listbox.machine"

/** One key (single; null: none) or the selected keys (multiple). */
export type SelectValue = string | null | readonly string[]

type Dismissal<K extends string> = { readonly type: K; readonly request: DismissRequest }

export type SelectEvent =
  /** A press on the trigger (release): toggles the popup. */
  | { readonly type: "TRIGGER_PRESS"; readonly modality: Modality }
  /** ArrowDown / Alt+ArrowDown (first) and ArrowUp (last) on the closed trigger. */
  | { readonly type: "TRIGGER_KEY"; readonly key: "first" | "last" }
  /** A press on the label: focuses the trigger. */
  | { readonly type: "LABEL_PRESS" }
  | Dismissal<"ESCAPE_KEY">
  | Dismissal<"OUTSIDE_PRESS">
  | Dismissal<"OUTSIDE_FOCUS">
  | Dismissal<"PARENT_DISMISSED">
  | { readonly type: "TAB_KEY"; readonly shift: boolean }
  | { readonly type: "WINDOW_BLUR" }
  | {
      readonly type: "POSITION.PLACED"
      readonly side: Side
      readonly align: Align
      readonly anchorHidden: boolean
      readonly first: boolean
    }
  /** The form was reset: the default value comes back. */
  | { readonly type: "FORM.RESET" }
  /** The browser (or a password manager) wrote into the hidden input. */
  | { readonly type: "FORM.AUTOFILL"; readonly text: string }
  /** Programmatic (`actionsRef`). */
  | { readonly type: "OPEN" }
  | { readonly type: "CLOSE" }
  | CollectionEvent

export type SelectOpenReason = "trigger" | "trigger-key" | "api"
export type SelectCloseReason =
  | "trigger"
  | "item-select"
  | "escape-key"
  | "tab-key"
  | "outside-press"
  | "outside-focus"
  | "parent-dismissed"
  | "window-blur"
  | "api"

/** `onOpenChange`'s details: why it opens or closes. */
export type SelectOpenChangeDetails = Omit<ChangeDetails<SelectEvent>, "reason"> & {
  readonly reason: SelectOpenReason | SelectCloseReason
}

export interface SelectProps extends CollectionProps {
  readonly value?: SelectValue | undefined
  readonly defaultValue?: SelectValue | undefined
  readonly onValueChange?:
    | ((value: SelectValue, details: ChangeDetails<SelectEvent>) => void)
    | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: SelectOpenChangeDetails) => void) | undefined
  /** Default true. */
  readonly modal?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly positioning?: PositioningProps | undefined
  /** The instance id (part ids derive from it). */
  readonly root: string
  /** The layer the trigger is in (the adapter's layer context). */
  readonly parent?: LayerId | undefined
  readonly getTrigger: () => HTMLElement | null
  /** The label element when rendered (inside the layer: the list's name resolves). */
  readonly getLabel?: (() => HTMLElement | null) | undefined
}

export interface SelectContext extends CollectionContext {
  readonly placement: PlacementState
  readonly openModality: Modality | null
  readonly openToLast: boolean
  readonly closeReason: SelectCloseReason | null
  /** Closing restores focus to the trigger (not after Tab or a window blur). */
  readonly restoreFocus: boolean
  /** The value came from autofill: `data-autofill` until the next user change. */
  readonly autofilled: boolean
}

export type SelectEnv = BaseDomEnvironment & PositionEnv & CollectionEnv

export const selectIds = (root: string) => ({
  trigger: partId("select", root, "trigger"),
  label: partId("select", root, "label"),
  valueText: partId("select", root, "value-text"),
  description: partId("select", root, "description"),
  positioner: partId("select", root, "positioner"),
  content: partId("select", root, "content"),
  list: partId("select", root, "list"),
  hiddenInput: partId("select", root, "hidden-input"),
  item: (key: CollectionKey) => itemId("select", root, "item", key),
})

export const selectLayerId = (root: string) => layerId(`select-${root}`)

/** The `dropdown` preset under the consumer's options. */
export const selectPositioning = (props: Pick<SelectProps, "positioning">): PositioningOptions =>
  resolvePositioning(props.positioning, positioningPresets.dropdown)

const initialPlacement = (props: SelectProps) => {
  const o = selectPositioning(props)
  const side = o.side === "inline-start" ? "left" : o.side === "inline-end" ? "right" : o.side
  return unplaced(side, o.align)
}

const mode = (props: SelectProps) => (props.selectionMode === "multiple" ? "multiple" : "single")

const pieces = collectionPieces({
  selection: {
    read: (values) => selectionOf(values["value"] as SelectValue | undefined),
    write: (s, collection, props) =>
      listboxValueOf(s, { selectionMode: props.selectionMode, collection }),
  },
})
type Args = Parameters<typeof pieces.actions.navigate>[0]

/** The collection pieces' arguments: a Select is single unless it says multiple. */
const args = (a: unknown): Args => {
  // Sound: the same args object, the event union wider than the pieces' own.
  const x = a as Args
  return { ...x, props: { ...x.props, selectionMode: mode(x.props as SelectProps) } } as Args
}

/** null as the runtime's fallback: no selection (a controlled null is a value). */
const NONE = null as unknown as string

const docOf = (env: SelectEnv) => {
  const node = env.dom.getRootNode()
  return "body" in node ? node : node.ownerDocument
}

const DISMISS_TYPE = {
  "escape-key": "ESCAPE_KEY",
  "outside-press": "OUTSIDE_PRESS",
  "outside-focus": "OUTSIDE_FOCUS",
  "parent-dismissed": "PARENT_DISMISSED",
} as const

const CLOSE_REASON: Partial<Record<string, SelectCloseReason>> = {
  TRIGGER_PRESS: "trigger",
  SELECT: "item-select",
  ESCAPE_KEY: "escape-key",
  TAB_KEY: "tab-key",
  OUTSIDE_PRESS: "outside-press",
  OUTSIDE_FOCUS: "outside-focus",
  PARENT_DISMISSED: "parent-dismissed",
  WINDOW_BLUR: "window-blur",
  CLOSE: "api",
}

/** The first selected key in collection order that keyboard navigation can reach. */
function firstSelected(props: SelectProps, s: SelectionValue): CollectionKey | null {
  const navigable = navigableWhen(props.focusableWhenDisabled === true)
  for (let i = 0; i < props.collection.size; i++) {
    const node = props.collection.at(i)
    if (node && navigable(node) && isSelected(props.collection, s, node.key)) return node.key
  }
  return null
}

/** The selected option (first in order), else the last for ArrowUp, else the first. */
function initialKey(
  props: SelectProps,
  value: SelectValue | undefined,
  toLast: boolean,
): CollectionKey | null {
  const navigable = navigableWhen(props.focusableWhenDisabled === true)
  return (
    firstSelected(props, selectionOf(value)) ??
    move(props.collection, null, toLast ? "last" : "first", { loop: false, navigable })
  )
}

export const selectMachine = /* @__PURE__ */ setup({
  types: type<{
    props: SelectProps
    events: SelectEvent
    env: SelectEnv
    context: SelectContext
    values: "open" | "value"
  }>(),
  guards: {
    ...pieces.guards,
    /** Opens: not disabled, not read-only. */
    interactive: ({ props }) => props.disabled !== true && props.readOnly !== true,
    isSingle: ({ props }) => mode(props) === "single",
    isMultiple: ({ props }) => mode(props) === "multiple",
    /** A selection that applies: an enabled option. */
    selectable: (a) => pieces.guards.canSelect(args(a)),
  },
  actions: {
    navigate: (a) => pieces.actions.navigate(args(a)),
    highlight: (a) => pieces.actions.highlight(args(a)),
    pointerMove: (a) => pieces.actions.pointerMove(args(a)),
    typeahead: (a) => pieces.actions.typeahead(args(a)),
    resetTypeahead: (a) => pieces.actions.resetTypeahead(args(a)),
    repairCollection: (a) => pieces.actions.repairCollection(args(a)),
    scrollToHighlighted: (a) => pieces.actions.scrollToHighlighted(args(a)),
    focusHighlighted: (a) => pieces.actions.focusHighlighted(args(a)),
    select: (a) => pieces.actions.select(args(a)),
    enterOpen: ({ event, props, set, values }) => {
      const modality =
        event.type === "TRIGGER_PRESS"
          ? event.modality
          : event.type === "TRIGGER_KEY"
            ? "keyboard"
            : null
      const toLast = event.type === "TRIGGER_KEY" && event.key === "last"
      set("openModality", modality)
      set("openToLast", toLast)
      set("closeReason", null)
      set("restoreFocus", true)
      // The option initial focus lands on, highlighted from the start (the effect scrolls to
      // it and focuses it once placed).
      const key = initialKey(props, values.value, toLast)
      set("highlightedKey", key)
      set(
        "highlightSource",
        key === null
          ? null
          : modality === "keyboard" || modality === "virtual"
            ? "keyboard"
            : "pointer",
      )
      set("placement", initialPlacement(props))
    },
    /** Exit (before the layer's cleanup reads it): Tab and a window blur keep focus. */
    decideRestore: ({ event, set }) => {
      set("restoreFocus", event.type !== "TAB_KEY" && event.type !== "WINDOW_BLUR")
      const reason = CLOSE_REASON[event.type]
      if (reason) set("closeReason", reason)
    },
    /** A chosen option is the highlighted one (the press or Enter landed on it). */
    highlightChosen: ({ event, props, set }) => {
      if (event.type !== "SELECT") return
      const node = props.collection.get(event.key)
      if (!node || !navigableWhen(props.focusableWhenDisabled === true)(node)) return
      set("highlightedKey", event.key)
    },
    clearHighlight: ({ set }) => {
      set("highlightedKey", null)
      set("highlightSource", null)
    },
    setPlacement: ({ event, set }) => {
      if (event.type === "POSITION.PLACED") set("placement", placementFrom(event))
    },
    /** Tab: the trigger takes focus now; the key's default moves on from it. */
    focusTrigger: ({ props }) => props.getTrigger()?.focus({ preventScroll: true }),
    /** A label press: the trigger, with no ring for a pointer (label-interaction). */
    labelFocus: ({ env, props }) => {
      const el = props.getTrigger()
      if (el && props.disabled !== true) void focusSafely(el, env, "programmatic")
    },
    /** The closed trigger's typeahead: the match becomes the value (single mode). */
    typeaheadSelect: ({ context, env, event, props, set, values }) => {
      if (event.type !== "TYPEAHEAD") return
      const { modifiers, composing, char } = event
      if (composing || modifiers.ctrl || modifiers.meta || modifiers.alt) return
      // From the selected option: the search starts after it, as a native select.
      const from = firstSelected(props, selectionOf(values.value))
      const r = typeahead(
        context.typeahead,
        { char, now: env.clock.now() },
        props.collection,
        from,
        {
          timeout: props.typeaheadTimeout ?? 1000,
          collator: collator(env.locale.locale()),
          // Disabled options are never chosen by typing (mui/base-ui#5776).
          navigable: navigableWhen(false),
        },
      )
      set("typeahead", r.state)
      if (r.key === null || r.key === from) return
      set("value", r.key)
      set("autofilled", false)
    },
    userChange: ({ set }) => set("autofilled", false),
    /** Form reset: the current default value (and a fresh search). */
    resetValue: ({ props, set }) => {
      // Sound: the controllable is typed by its non-null single shape (see NONE).
      set("value", (props.defaultValue ?? NONE) as string)
      set("typeahead", idleTypeahead)
      set("autofilled", false)
    },
    /** Autofill: the written key, else the option whose text matches under the collator. */
    autofill: ({ env, event, props, set }) => {
      if (event.type !== "FORM.AUTOFILL") return
      const text = event.text
      let key: CollectionKey | null = props.collection.has(toKey(text)) ? toKey(text) : null
      if (key === null) {
        const c = collator(env.locale.locale())
        for (let i = 0; i < props.collection.size && key === null; i++) {
          const node = props.collection.at(i)
          if (node && !node.disabled && c.compare(node.textValue, text) === 0) key = node.key
        }
      }
      if (key === null) return
      set("value", key)
      set("autofilled", true)
    },
  },
  effects: {
    /** While open: the layer, positioning, initial focus after placement, window blur. */
    open: (a) => {
      const { env, send } = a
      if (typeof document === "undefined") return undefined
      const ids = selectIds(a.props.root)
      const byId = (id: string) => env.dom.getById(id)
      const content = () => byId(ids.content)
      const modal = a.props.modal !== false
      const doc = docOf(env)
      const focusAtOpen = deepActiveElement(doc)
      let cancelFocus = () => {}
      const stopLayer = overlayEffect(env, {
        id: selectLayerId(a.props.root),
        kind: "listbox",
        family: "listbox",
        modal,
        parent: a.props.parent,
        opener: a.props.getTrigger,
        // Trigger and label are inside: pressing the trigger toggles, and the list's name
        // (the label) resolves while the page is inert (react-spectrum#9737).
        elements: () =>
          [
            byId(ids.positioner),
            content(),
            a.props.getTrigger(),
            a.props.getLabel?.() ?? null,
          ].filter((e): e is HTMLElement => e !== null),
        container: content,
        initialFocus: () => false,
        finalFocus: () => (a.context.restoreFocus ? null : false),
        modality: env.modality.modality(),
        tabCloses: true,
        dismiss: {
          escape: true,
          outsidePress: true,
          outsideFocus: !modal,
          onRequest: (request) => {
            // The event type is the reason's (DISMISS_TYPE maps every reason).
            send({ type: DISMISS_TYPE[request.reason], request } as SelectEvent)
            if (request.reason === "escape-key") request.event?.preventDefault()
          },
        },
      })
      const track = env.position.track({
        anchor: {
          kind: "virtual",
          get: () => {
            const el = a.props.getTrigger()
            return el
              ? { getBoundingClientRect: () => el.getBoundingClientRect(), contextElement: el }
              : null
          },
        },
        positioner: ids.positioner,
        options: () => selectPositioning(a.props),
        onPlacement: (p, first) => {
          send({ type: "POSITION.PLACED", ...p, first })
          if (!first) return
          // The selected option (first in order), else the last for ArrowUp, else the first;
          // centred before focus so the page never scrolls (react-spectrum#3910).
          const key = initialKey(a.props, a.values.value, a.context.openToLast)
          const m = a.context.openModality
          const keyboard = m === "keyboard" || m === "virtual"
          if (key !== null) {
            send({ type: "HIGHLIGHT", key, source: keyboard ? "keyboard" : "pointer", open: true })
          }
          const list = byId(ids.list)
          if (!list) return
          const pick = () => (key === null ? list : byId(ids.item(key)))
          cancelFocus = focusInitial(env, list, pick, m ?? undefined, focusAtOpen)
        },
      })
      const view = doc.defaultView
      const onBlur = () => send({ type: "WINDOW_BLUR" })
      view?.addEventListener("blur", onBlur)
      return () => {
        view?.removeEventListener("blur", onBlur)
        cancelFocus()
        track.stop()
        stopLayer()
      }
    },
  },
}).machine({
  id: "select",
  initial: "closed",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: props.collection,
    placement: initialPlacement(props),
    openModality: null,
    openToLast: false,
    closeReason: null,
    restoreFocus: true,
    autofilled: false,
  }),
  values: {
    open: { fallback: false, states: { open: true, closed: false } },
    value: { fallback: NONE, equal: sameValue as never },
  },
  onProps: { collection: "COLLECTION.CHANGE" },
  on: {
    "COLLECTION.CHANGE": { actions: ["repairCollection"] },
    "FORM.RESET": { actions: ["resetValue"] },
    LABEL_PRESS: { actions: ["labelFocus"] },
  },
  states: {
    closed: {
      on: {
        TRIGGER_PRESS: {
          guard: "interactive",
          target: "open",
          reason: "trigger",
          actions: ["enterOpen", "resetTypeahead"],
        },
        TRIGGER_KEY: {
          guard: "interactive",
          target: "open",
          reason: "trigger-key",
          actions: ["enterOpen", "resetTypeahead"],
        },
        OPEN: {
          guard: "interactive",
          target: "open",
          reason: "api",
          actions: ["enterOpen", "resetTypeahead"],
        },
        TYPEAHEAD: { guard: { and: ["interactive", "isSingle"] }, actions: ["typeaheadSelect"] },
        "FORM.AUTOFILL": { guard: { and: ["interactive", "isSingle"] }, actions: ["autofill"] },
      },
    },
    open: {
      effects: ["open"],
      exit: ["decideRestore", "clearHighlight", "resetTypeahead"],
      on: {
        TRIGGER_PRESS: { target: "closed", reason: "trigger" },
        ESCAPE_KEY: { target: "closed", reason: "escape-key" },
        OUTSIDE_PRESS: { target: "closed", reason: "outside-press" },
        OUTSIDE_FOCUS: { target: "closed", reason: "outside-focus" },
        PARENT_DISMISSED: { target: "closed", reason: "parent-dismissed" },
        TAB_KEY: { target: "closed", reason: "tab-key", actions: ["focusTrigger"] },
        WINDOW_BLUR: { target: "closed", reason: "window-blur" },
        CLOSE: { target: "closed", reason: "api" },
        SELECT: [
          { guard: { not: "selectable" }, actions: ["highlightChosen"] },
          {
            guard: "isSingle",
            target: "closed",
            reason: "item-select",
            actions: ["select", "userChange"],
          },
          { actions: ["select", "userChange", "highlightChosen"] },
        ],
        NAVIGATE: { actions: ["navigate", "scrollToHighlighted", "focusHighlighted"] },
        TYPEAHEAD: { actions: ["typeahead", "scrollToHighlighted", "focusHighlighted"] },
        HIGHLIGHT: { actions: ["highlight", "scrollToHighlighted", "focusHighlighted"] },
        POINTER_MOVE: { actions: ["pointerMove", "focusHighlighted"] },
        "POSITION.PLACED": { actions: ["setPlacement"] },
      },
    },
  },
})

export type SelectMachine = typeof selectMachine
