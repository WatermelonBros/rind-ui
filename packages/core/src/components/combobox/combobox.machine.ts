// Combobox (design §1): flat `closed | open`. Every text change is a transition (the input is
// never written imperatively); `commitText` is the one owner of the commit rules. The visible
// results are a derivation the adapter passes as `collection` (patternResults); the full
// collection, for texts and exact matches, is `items`. Chips (multiple) are input-chips.

import type { FocusCause, Modality } from "../../a11y/events"
import type { CollectionKey } from "../../collection/key"
import { toKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import {
  type CollectionContext,
  type CollectionEnv,
  type CollectionEvent,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import type { DismissRequest } from "../../dom/dismiss"
import { layerId } from "../../dom/layer-stack"
import { overlayEffect } from "../../dom/overlay"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import { quirkActive } from "../../dom/quirks"
import type { DomEnvironment } from "../../env/dom-environment"
import type { PositionEnv, PositioningProps } from "../../env/position"
import { partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import type { ComboboxMessages } from "./combobox.messages"
import { completion, exactMatch, type OpenReason } from "./pattern/pattern"

export type ComboboxValue = string | null | readonly string[]

export type ComboboxEvent =
  | CollectionEvent
  | {
      readonly type: "INPUT.CHANGE"
      readonly text: string
      readonly inputType: string
      readonly composing: boolean
      /** The caret is at the end (forward typing may complete inline). */
      readonly caretAtEnd: boolean
    }
  | { readonly type: "INPUT.FOCUS"; readonly modality: Modality; readonly cause: FocusCause }
  | { readonly type: "INPUT.BLUR" }
  | { readonly type: "INPUT.PRESS"; readonly modality: Modality }
  | { readonly type: "TRIGGER.PRESS"; readonly modality: Modality }
  | { readonly type: "CLEAR.PRESS"; readonly modality: Modality }
  | {
      readonly type: "ARROW"
      readonly key: "NEXT" | "PREV"
      readonly alt: boolean
      readonly composing: boolean
    }
  | { readonly type: "ENTER"; readonly composing: boolean }
  | { readonly type: "ESCAPE"; readonly composing: boolean }
  | { readonly type: "TAB"; readonly composing: boolean }
  /** Left, Right, Home, End: back to editing. */
  | { readonly type: "CARET" }
  | { readonly type: "ITEM.CHOOSE"; readonly key: CollectionKey; readonly modality: Modality }
  | { readonly type: "COMPOSITION.START" }
  | { readonly type: "COMPOSITION.END"; readonly text: string }
  | { readonly type: "OUTSIDE_PRESS"; readonly request: DismissRequest }
  | {
      readonly type: "POSITION.PLACED"
      readonly first: boolean
      readonly side: string
      readonly align: string
      readonly anchorHidden: boolean
    }
  /** A parent's value, or new items: the text follows when not dirty. */
  | { readonly type: "VALUE.SYNC" }
  | { readonly type: "LOADING.SYNC" }
  /** A form reset: the default value and its text come back. */
  | { readonly type: "RESET" }
  | { readonly type: "OPEN" }
  | { readonly type: "CLOSE" }
  | { readonly type: "CLEAR" }

export interface ComboboxProps extends CollectionProps {
  /** Every option (the visible results are `collection`). */
  readonly items: Collection<unknown>
  readonly value?: ComboboxValue | undefined
  readonly defaultValue?: ComboboxValue | undefined
  readonly onValueChange?:
    | ((value: ComboboxValue, details: ChangeDetails<ComboboxEvent>) => void)
    | undefined
  readonly inputValue?: string | undefined
  readonly defaultInputValue?: string | undefined
  readonly onInputValueChange?:
    | ((text: string, details: ChangeDetails<ComboboxEvent>) => void)
    | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<ComboboxEvent>) => void)
    | undefined
  readonly allowCustomValue?: boolean | undefined
  /** Default: true in single mode, false in multiple. */
  readonly closeOnSelect?: boolean | undefined
  /** Multiple: clear the text after a choice (default true). */
  readonly clearInputOnSelect?: boolean | undefined
  readonly selectOnTab?: boolean | undefined
  /** Default true. */
  readonly openOnInput?: boolean | undefined
  /** Default true. */
  readonly openOnArrow?: boolean | undefined
  readonly openOnInputPress?: boolean | undefined
  readonly openOnFocus?: boolean | undefined
  readonly autoHighlight?: boolean | undefined
  readonly keepHighlight?: boolean | undefined
  /** "both": inline completion of the highlighted option. */
  readonly autoComplete?: "list" | "both" | undefined
  readonly readOnly?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly locale: string
  readonly messages: ComboboxMessages
  readonly root: string
  readonly positioning?: PositioningProps | undefined
  /** The results answer an older query (async): no highlight, count or empty state. */
  readonly stale?: boolean | undefined
}

export interface ComboboxContext extends CollectionContext {
  readonly focused: boolean
  /** Text typed since the last commit. */
  readonly dirty: boolean
  readonly openReason: OpenReason | null
  readonly composing: boolean
  /** The last typing went forward with the caret at the end (inline completion may show). */
  readonly completable: boolean
  /** The inline completion shown in the input (the typed query plus the option's rest). */
  readonly completion: string | null
}

export const comboboxIds = (root: string) => ({
  label: partId("combobox", root, "label"),
  control: partId("combobox", root, "control"),
  input: partId("combobox", root, "input"),
  trigger: partId("combobox", root, "trigger"),
  positioner: partId("combobox", root, "positioner"),
  popup: partId("combobox", root, "popup"),
  list: partId("combobox", root, "list"),
  item: (key: CollectionKey) => `${partId("combobox", root, "item")}-${encodeURIComponent(key)}`,
})

type Types = {
  props: ComboboxProps
  events: ComboboxEvent
  env: DomEnvironment & PositionEnv & CollectionEnv
  context: ComboboxContext
  values: "value" | "inputValue" | "open"
}
type Args = ActionArgs<Types>

const mode = (p: ComboboxProps) => p.selectionMode ?? "single"
const selectedKeys = (value: ComboboxValue | undefined): readonly string[] =>
  value == null ? [] : typeof value === "string" ? [value] : value
const textOf = (p: ComboboxProps, key: string | undefined) =>
  key === undefined ? "" : (p.items.get(toKey(key))?.textValue ?? "")
/** The text the selection implies: the selected option's (single), else empty. */
const selectionText = (p: ComboboxProps, value: ComboboxValue | undefined) =>
  mode(p) === "single" ? textOf(p, selectedKeys(value)[0]) : ""
const editable = (p: ComboboxProps) => p.disabled !== true && p.readOnly !== true

/** null as the runtime's fallback (a controlled null is a value). */
const EMPTY = null as unknown as string

const pieces = collectionPieces({
  selection: {
    read: (values) =>
      new Set(selectedKeys(values["value"] as ComboboxValue | undefined).map(toKey)),
    // The combobox writes its value itself (choose / commit): the pieces never select.
    write: (_s, _c, props) => (props as ComboboxProps).value ?? null,
  },
})

function setText(a: Args, text: string) {
  a.set("inputValue", text)
}

/** The one place the commit rules live (combobox "Commit Of Typed Text"). */
function commit(a: Args) {
  const { props, values, context } = a
  a.set("completion", null)
  if (!context.dirty) return
  a.set("dirty", false)
  const text = values.inputValue
  if (props.readOnly) return setText(a, selectionText(props, values.value))
  if (mode(props) === "none") return
  const match = exactMatch(props.items, text, props.locale)
  if (mode(props) === "multiple") {
    if (match !== null && !selectedKeys(values.value).includes(match)) {
      a.set("value", [...selectedKeys(values.value), match])
    }
    if (!props.allowCustomValue) setText(a, "")
    return
  }
  if (match !== null) {
    a.set("value", match)
    return setText(a, textOf(props, match))
  }
  if (text.trim() === "") {
    if (props.disallowEmptySelection) return setText(a, selectionText(props, values.value))
    a.set("value", EMPTY)
    return setText(a, "")
  }
  if (props.allowCustomValue) {
    a.set("value", EMPTY)
    return
  }
  setText(a, selectionText(props, values.value))
}

function choose(a: Args, key: CollectionKey) {
  const { props, values } = a
  const node = props.collection.get(key) ?? props.items.get(key)
  if (!node || node.disabled || props.readOnly) return
  a.set("completion", null)
  a.set("dirty", false)
  if (mode(props) === "multiple") {
    const keys = selectedKeys(values.value)
    a.set("value", keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key])
    if (props.clearInputOnSelect !== false) setText(a, "")
  } else {
    if (mode(props) === "single" && selectedKeys(values.value)[0] !== key) a.set("value", key)
    setText(a, node.textValue)
  }
  if (quirkActive("vo-activedescendant", a.env)) {
    a.env.announcer.announce({
      message: props.messages.selectedAnnouncement(node.textValue),
      key: `combobox-${props.root}:selection`,
    })
  }
}

const closesOnSelect = (p: ComboboxProps) => p.closeOnSelect ?? mode(p) !== "multiple"

/** The first or last navigable option, or the selected one (arrow and keyboard opens). */
function highlightEntry(a: Args, edge: "first" | "last") {
  const c = a.props.collection
  const selected = selectedKeys(a.values.value).find((k) => c.has(toKey(k)))
  let key: CollectionKey | null = selected === undefined ? null : toKey(selected)
  if (key === null) {
    const step = edge === "first" ? 1 : -1
    for (let i = edge === "first" ? 0 : c.size - 1; i >= 0 && i < c.size; i += step) {
      const n = c.at(i)
      if (n && !n.disabled) {
        key = n.key
        break
      }
    }
  }
  a.set("highlightedKey", key)
  a.set("highlightSource", "keyboard")
  a.set("scrollReason", "open")
}

function announceCount(a: Args) {
  const { props } = a
  if (props.stale || props.loading === "loading" || props.loading === "loading-more") return
  const n = props.collection.size
  a.env.announcer.announce({
    message: n === 0 ? props.messages.noResults : props.messages.count(n),
    priority: "polite",
    key: `combobox-count:${props.root}`,
  })
}

export const comboboxMachine = setup({
  types: type<Types>(),
  guards: {
    enabled: ({ props }) => props.disabled !== true,
    editable: ({ props }) => editable(props),
    notComposing: ({ event, context }) =>
      !context.composing && !("composing" in event && event.composing === true),
    opensOnInput: ({ props, event }) =>
      props.openOnInput !== false &&
      editable(props) &&
      !(event.type === "INPUT.CHANGE" && event.composing),
    opensOnArrow: ({ props }) => props.openOnArrow !== false && props.disabled !== true,
    opensOnPress: ({ props }) => props.openOnInputPress === true && props.disabled !== true,
    opensOnFocus: ({ props, event }) =>
      props.openOnFocus === true &&
      props.disabled !== true &&
      props.readOnly !== true &&
      event.type === "INPUT.FOCUS" &&
      event.cause !== "layer" &&
      event.cause !== "window",
    hasHighlight: ({ context, props }) =>
      context.highlightedKey !== null && props.collection.has(context.highlightedKey),
    isDirty: ({ context }) => context.dirty,
    hasCompletion: ({ context }) => context.completion !== null,
    tabChooses: ({ props, context }) =>
      props.selectOnTab === true &&
      context.openReason !== "focus" &&
      context.highlightSource !== "pointer" &&
      context.highlightedKey !== null,
    closesOnSelect: ({ props }) => closesOnSelect(props),
  },
  actions: {
    ...pieces.actions,
    typed: (a) => {
      if (a.event.type !== "INPUT.CHANGE" && a.event.type !== "COMPOSITION.END") return
      const text = a.event.type === "INPUT.CHANGE" ? a.event.text : a.event.text
      setText(a, text)
      a.set("dirty", true)
      a.set("completion", null)
      // A text change clears the highlight (auto highlight re-applies on the new results).
      a.set("highlightedKey", null)
      a.set("highlightSource", null)
      a.set(
        "completable",
        a.event.type === "COMPOSITION.END" ||
          (a.event.caretAtEnd &&
            /^insert(Text|CompositionText|ReplacementText)?$/.test(a.event.inputType)),
      )
    },
    setOpenReason: (a) => {
      const reason: OpenReason =
        a.event.type === "ARROW"
          ? "arrow"
          : a.event.type === "TRIGGER.PRESS"
            ? "trigger"
            : a.event.type === "INPUT.PRESS"
              ? "press"
              : a.event.type === "INPUT.FOCUS"
                ? "focus"
                : a.event.type === "OPEN"
                  ? "api"
                  : "input"
      a.set("openReason", reason)
    },
    highlightOnOpen: (a) => {
      if (a.event.type === "ARROW") {
        if (a.event.alt) return
        highlightEntry(a, a.event.key === "NEXT" ? "first" : "last")
      } else if (
        a.event.type === "TRIGGER.PRESS" &&
        a.event.modality !== "pointer" &&
        a.event.modality !== "touch"
      ) {
        highlightEntry(a, "first")
      }
    },
    arrow: (a) => {
      if (a.event.type !== "ARROW") return
      a.send({ type: "NAVIGATE", move: a.event.key === "NEXT" ? "next" : "previous" })
    },
    /** A keyboard highlight completes inline (autoComplete both), when typing allowed it. */
    complete: (a) => {
      const { props, context, values } = a
      if (props.autoComplete !== "both" || !context.completable || context.composing) return
      const key = context.highlightedKey
      const node = key === null ? undefined : props.collection.get(key)
      a.set("completion", node ? completion(values.inputValue, node.textValue, props.locale) : null)
    },
    removeCompletion: ({ set }) => set("completion", null),
    clearHighlight: ({ set }) => {
      set("highlightedKey", null)
      set("highlightSource", null)
    },
    choose: (a) => {
      if (a.event.type === "ITEM.CHOOSE") choose(a, a.event.key)
      else if (a.context.highlightedKey !== null) choose(a, a.context.highlightedKey)
    },
    commit,
    clear: (a) => {
      a.set("completion", null)
      a.set("dirty", false)
      a.set("value", mode(a.props) === "multiple" ? [] : EMPTY)
      setText(a, "")
    },
    syncText: (a) => {
      if (a.context.dirty) return
      const text = selectionText(a.props, a.values.value)
      if (
        mode(a.props) === "single" &&
        text !== a.values.inputValue &&
        selectedKeys(a.values.value).length > 0
      ) {
        setText(a, text)
      }
    },
    restoreDefault: (a) => {
      const v = a.props.defaultValue ?? (mode(a.props) === "multiple" ? [] : EMPTY)
      a.set("value", v as never)
      a.set("dirty", false)
      a.set("completion", null)
      setText(a, a.props.defaultInputValue ?? selectionText(a.props, v))
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
    startComposition: ({ set }) => set("composing", true),
    endComposition: ({ set }) => set("composing", false),
    /** New results while open: repair, auto highlight a typing result, count. */
    results: (a) => {
      pieces.actions.repairCollection(a)
      const { props, context } = a
      if (props.autoHighlight && context.dirty && !context.composing && !props.stale) {
        const first = [...props.collection].find((n) => n.type === "item" && !n.disabled)
        if (first) {
          a.set("highlightedKey", first.key)
          a.set("highlightSource", "typing")
          a.set("scrollReason", null)
        }
      }
      announceCount(a)
    },
    announceOpen: (a) => {
      if (a.context.highlightedKey === null) announceCount(a)
    },
    announceLoading: (a) => {
      if (a.props.loading === "loading" || a.props.loading === "loading-more") {
        a.env.announcer.announce({
          message: a.props.messages.loading,
          priority: "polite",
          key: `combobox-count:${a.props.root}`,
        })
      }
    },
    placed: (a) => {
      if (a.event.type === "POSITION.PLACED" && a.event.first) pieces.actions.scrollToHighlighted(a)
    },
    resetOpen: ({ set }) => {
      set("openReason", null)
    },
  },
  effects: {
    /** The non-modal listbox layer and its positioning (combobox-pattern "Popup Placement"). */
    overlay: (a) => {
      const { env, send } = a
      if (typeof document === "undefined") return undefined
      const ids = comboboxIds(a.props.root)
      const byId = (id: string) => env.dom.getById(id) as HTMLElement | null
      const stop = overlayEffect(env, {
        id: layerId(`combobox-${a.props.root}`),
        kind: "listbox",
        family: "listbox",
        modal: false,
        opener: () => byId(ids.input),
        // The control (input, trigger, clear, chips) is inside: its presses never dismiss.
        elements: () =>
          [byId(ids.control), byId(ids.positioner), byId(ids.popup)].filter(
            (e): e is HTMLElement => e !== null,
          ),
        container: () => byId(ids.popup),
        initialFocus: () => false,
        finalFocus: () => false,
        modality: env.modality.modality(),
        dismiss: {
          // Escape is the input's key (the machine decides and prevents only when it acted).
          escape: false,
          outsidePress: true,
          outsideFocus: false,
          onRequest: (request: DismissRequest) => send({ type: "OUTSIDE_PRESS", request }),
        },
      })
      const track = env.position.track({
        anchor: { kind: "element", id: ids.control },
        positioner: ids.positioner,
        arrow: `${ids.positioner}-arrow`,
        options: () => resolvePositioning(a.props.positioning, positioningPresets.dropdown),
        onPlacement: (p, first) => send({ type: "POSITION.PLACED", ...p, first }),
      })
      return () => {
        track.stop()
        stop()
      }
    },
  },
}).machine({
  id: "combobox",
  initial: "closed",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: props.collection,
    focused: false,
    dirty: false,
    openReason: null,
    composing: false,
    completable: false,
    completion: null,
  }),
  values: {
    value: { fallback: EMPTY },
    inputValue: { fallback: "" },
    open: { fallback: false, states: { open: true, closed: false } },
  },
  onProps: {
    collection: "COLLECTION.CHANGE",
    value: "VALUE.SYNC",
    items: "VALUE.SYNC",
    loading: "LOADING.SYNC",
  },
  on: {
    "INPUT.FOCUS": { actions: ["setFocused"] },
    "COMPOSITION.START": { actions: ["startComposition"] },
    "VALUE.SYNC": { actions: ["syncText"] },
    RESET: { actions: ["restoreDefault"] },
    CLEAR: { guard: "editable", actions: ["clear"] },
    "CLEAR.PRESS": { guard: "editable", actions: ["clear"] },
  },
  states: {
    closed: {
      entry: ["clearHighlight", "resetOpen"],
      on: {
        "INPUT.CHANGE": [
          { guard: "opensOnInput", target: "open", actions: ["typed", "setOpenReason"] },
          { guard: "editable", actions: ["typed"] },
        ],
        "COMPOSITION.END": [
          {
            guard: "opensOnInput",
            target: "open",
            actions: ["endComposition", "typed", "setOpenReason"],
          },
          { actions: ["endComposition", "typed"] },
        ],
        ARROW: {
          guard: { and: ["notComposing", "opensOnArrow"] },
          target: "open",
          actions: ["setOpenReason", "highlightOnOpen"],
        },
        "TRIGGER.PRESS": {
          guard: "enabled",
          target: "open",
          actions: ["setOpenReason", "highlightOnOpen"],
        },
        "INPUT.PRESS": { guard: "opensOnPress", target: "open", actions: ["setOpenReason"] },
        "INPUT.FOCUS": [
          { guard: "opensOnFocus", target: "open", actions: ["setFocused", "setOpenReason"] },
          { actions: ["setFocused"] },
        ],
        OPEN: { guard: "enabled", target: "open", actions: ["setOpenReason"] },
        ENTER: { guard: "notComposing", actions: ["commit"] },
        ESCAPE: { guard: { and: ["notComposing", "isDirty"] }, actions: ["commit"] },
        TAB: { guard: "notComposing", actions: ["commit"] },
        "INPUT.BLUR": { actions: ["clearFocused", "commit"] },
        "COLLECTION.CHANGE": { actions: ["repairCollection", "syncText"] },
      },
    },
    open: {
      entry: ["announceOpen"],
      effects: ["overlay"],
      on: {
        "INPUT.CHANGE": { actions: ["typed"] },
        "COMPOSITION.END": { actions: ["endComposition", "typed"] },
        ARROW: { guard: "notComposing", actions: ["arrow"] },
        NAVIGATE: {
          actions: ["navigate", "scrollToHighlighted", "announceHighlighted", "complete"],
        },
        HIGHLIGHT: { actions: ["highlight", "complete"] },
        POINTER_MOVE: { actions: ["pointerMove"] },
        CARET: { actions: ["clearHighlight", "removeCompletion"] },
        "ITEM.CHOOSE": [
          { guard: "closesOnSelect", target: "closed", actions: ["choose"] },
          { actions: ["choose"] },
        ],
        ENTER: [
          {
            guard: { and: ["notComposing", "hasHighlight", "closesOnSelect"] },
            target: "closed",
            actions: ["choose"],
          },
          { guard: { and: ["notComposing", "hasHighlight"] }, actions: ["choose"] },
          { guard: "notComposing", target: "closed", actions: ["commit"] },
        ],
        ESCAPE: [
          { guard: { and: ["notComposing", "hasCompletion"] }, actions: ["removeCompletion"] },
          { guard: "notComposing", target: "closed", actions: ["commit"] },
        ],
        TAB: [
          {
            guard: { and: ["notComposing", "tabChooses"] },
            target: "closed",
            actions: ["choose", "commit"],
          },
          { guard: "notComposing", target: "closed", actions: ["commit"] },
        ],
        "TRIGGER.PRESS": { target: "closed", actions: ["commit"] },
        OUTSIDE_PRESS: { target: "closed", actions: ["commit"] },
        "INPUT.BLUR": { target: "closed", actions: ["clearFocused", "commit"] },
        CLOSE: { target: "closed", actions: ["commit"] },
        "COLLECTION.CHANGE": { actions: ["results", "complete"] },
        "LOADING.SYNC": { actions: ["announceLoading"] },
        "POSITION.PLACED": { actions: ["placed"] },
      },
    },
  },
})
export type ComboboxMachine = typeof comboboxMachine
