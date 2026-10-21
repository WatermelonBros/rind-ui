// Combobox (design §1): flat `closed | open`. Every text change is a transition (the input is
// never written imperatively); `commitText` is the one owner of the commit rules. The visible
// results are a derivation the adapter passes as `collection` (patternResults); the full
// collection, for texts and exact matches, is `items`. Chips (multiple) are input-chips.

import type { FocusCause, Modality } from "../../a11y/events"
import type { CollectionKey } from "../../collection/key"
import { toKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import {
  type CollectionEnv,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { quirkActive } from "../../dom/quirk-conditions"
import type { DomEnvironment } from "../../env/dom-environment"
import type { PositionEnv } from "../../env/position"
import { partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import {
  type Chip,
  type InputChipsContext,
  type InputChipsEvent,
  initialInputChipsContext,
  inputChipsActions,
  lastRemovable,
} from "../input-chips/input-chips"
import type { ComboboxMessages } from "./combobox.messages"
import {
  announceCount,
  highlightFirstTyped,
  initialPatternContext,
  type PatternContext,
  type PatternEvent,
  type PatternProps,
  patternIds,
  patternPieces,
  popupOverlay,
} from "./pattern/machine"
import { completion, exactMatch, type OpenReason } from "./pattern/pattern"

export type ComboboxValue = string | null | readonly string[]

/** The keyboard modifiers of the activation that ran an item. */
export interface ActionModifiers {
  readonly shift: boolean
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly mod: boolean
}

/** `onAction`'s details, the same in every configuration. */
export interface ComboboxActionDetails {
  readonly modality: Modality
  readonly modifiers: ActionModifiers
}

/** An inline combobox's page (`depth` 0: the root page). */
export interface ComboboxPage {
  readonly key: string
  readonly label: string
  readonly depth: number
}

const NO_MODIFIERS: ActionModifiers = {
  shift: false,
  alt: false,
  ctrl: false,
  meta: false,
  mod: false,
}

export type ComboboxEvent =
  | PatternEvent
  | InputChipsEvent
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
      readonly type: "ENTER"
      readonly composing: boolean
      readonly modifiers?: ActionModifiers | undefined
    }
  | { readonly type: "ESCAPE"; readonly composing: boolean }
  | { readonly type: "TAB"; readonly composing: boolean }
  /** Left, Right, Home, End: back to editing. */
  | { readonly type: "CARET" }
  | {
      readonly type: "ITEM.CHOOSE"
      readonly key: CollectionKey
      readonly modality: Modality
      readonly modifiers?: ActionModifiers | undefined
    }
  /** Inline: the `page` prop's key changed (onProps). */
  | { readonly type: "PAGE.CHANGE" }
  | { readonly type: "COMPOSITION.START" }
  | { readonly type: "COMPOSITION.END"; readonly text: string }
  /** A parent's value, or new items: the text follows when not dirty. */
  | { readonly type: "VALUE.SYNC" }
  /** A form reset: the default value and its text come back. */
  | { readonly type: "RESET" }
  /** The browser filled the hidden input: the option whose key, else whose text, it is. */
  | { readonly type: "AUTOFILL"; readonly text: string }
  | { readonly type: "OPEN" }
  | { readonly type: "CLOSE" }
  | { readonly type: "CLEAR" }

export interface ComboboxProps extends PatternProps {
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
  /** Multiple: Backspace in the empty input arms, then removes, the last chip (default true). */
  readonly removeOnBackspace?: boolean | undefined
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
  /** "both": inline completion of the highlighted option. */
  readonly autoComplete?: "list" | "both" | undefined
  readonly readOnly?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly locale: string
  readonly messages: ComboboxMessages
  /** Free text: Escape on a closed popup clears the text (default false). */
  readonly clearOnEscape?: boolean | undefined
  /** Runs an item (inline), or follows a choice (free text). */
  readonly onAction?: ((key: string, details: ComboboxActionDetails) => void) | undefined
  /** Inline: the current page. */
  readonly page?: ComboboxPage | undefined
  /** Inline: Backspace on an empty query above the root page. */
  readonly onBack?: (() => void) | undefined
  /**
   * Inline: Escape on an empty query asks the host to close (`onOpenChange(false)`); absent,
   * Escape is left to an enclosing layer.
   */
  readonly requestClose?: (() => void) | undefined
}

export interface ComboboxContext extends PatternContext, InputChipsContext {
  readonly openReason: OpenReason | null
  /** The last typing went forward with the caret at the end (inline completion may show). */
  readonly completable: boolean
  /** The inline completion shown in the input (the typed query plus the option's rest). */
  readonly completion: string | null
  /** Inline: the query the current highlight was made for (a new query highlights first). */
  readonly highlightQuery: string | null
}

export const comboboxIds = (root: string) => ({
  ...patternIds("combobox", root),
  trigger: partId("combobox", root, "trigger"),
  clear: partId("combobox", root, "clear-trigger"),
})

type Types = {
  props: ComboboxProps
  events: ComboboxEvent
  env: DomEnvironment & PositionEnv & CollectionEnv
  context: ComboboxContext
  values: "value" | "inputValue" | "open"
}
type Args = ActionArgs<Types>

const mode = (p: Pick<ComboboxProps, "selectionMode">) => p.selectionMode ?? "single"
const selectedKeys = (value: ComboboxValue | undefined): readonly string[] =>
  value == null ? [] : typeof value === "string" ? [value] : value
const textOf = (p: Pick<ComboboxProps, "items">, key: string | undefined) =>
  key === undefined ? "" : (p.items.get(toKey(key))?.textValue ?? "")
/** The text the selection implies: the selected option's (single), else empty. */
const selectionText = (p: ComboboxProps, value: ComboboxValue | undefined) =>
  mode(p) === "single" ? textOf(p, selectedKeys(value)[0]) : ""
const editable = (p: Pick<ComboboxProps, "disabled" | "readOnly">) =>
  p.disabled !== true && p.readOnly !== true

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

/** Calls `onAction` for an item (inline: runs it; free text: follows the fill). */
function runItem(a: Args, key: CollectionKey) {
  const { props, event } = a
  const node = props.collection.get(key) ?? props.items.get(key)
  if (!node || node.disabled) return
  props.onAction?.(String(key), {
    modality: "modality" in event ? event.modality : "keyboard",
    modifiers:
      (event.type === "ITEM.CHOOSE" || event.type === "ENTER" ? event.modifiers : undefined) ??
      NO_MODIFIERS,
  })
}

/** The first navigable listed item, highlighted as a typing highlight (its pause applies). */
function highlightFirst(a: Args) {
  a.set("highlightQuery", a.values.inputValue)
  if (a.props.autoHighlight === false || a.props.stale) return
  highlightFirstTyped(a)
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
  if (quirkActive("vo-activedescendant", a.env) && mode(props) !== "none") {
    a.env.announcer.announce({
      message: props.messages.selectedAnnouncement(node.textValue),
      key: `combobox-${props.root}:selection`,
    })
  }
  // Free text: the choice filled the input; the host may react to the key.
  if (mode(props) === "none") runItem(a, key)
}

/** The chips of a multiple selection: one per selected key, named by its option's text. */
export const chipsOf = (
  p: Pick<ComboboxProps, "items" | "selectionMode" | "disabled" | "readOnly">,
  value: ComboboxValue | undefined,
): readonly Chip[] =>
  mode(p) === "multiple"
    ? selectedKeys(value).map((key) => ({
        key,
        text: textOf(p, key) || key,
        disabled: !editable(p),
      }))
    : []

/** Deselects a chip's key and announces it on every platform (input-chips). */
function removeChip(a: Args, key: string) {
  const text = textOf(a.props, key) || key
  a.set(
    "value",
    selectedKeys(a.values.value).filter((k) => k !== key),
  )
  a.env.announcer.announce({
    message: a.props.messages.removedAnnouncement(text),
    priority: "polite",
    key: `combobox-${a.props.root}:chip-removed`,
  })
}

const closesOnSelect = (p: ComboboxProps) => p.closeOnSelect ?? mode(p) !== "multiple"

const pattern = patternPieces({
  scope: "combobox",
  selected: ({ values }) => selectedKeys(values["value"] as ComboboxValue | undefined),
  collection: pieces.actions,
})

/** One setup, two definitions: the popup combobox and the inline one (design §1). */
const comboboxSetup = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    ...pattern.guards,
    enabled: ({ props }) => props.disabled !== true,
    editable: ({ props }) => editable(props),
    isFocused: ({ context }) => context.focused,
    opensOnInput: ({ props, event }) =>
      props.openOnInput !== false &&
      editable(props) &&
      !(event.type === "INPUT.CHANGE" && event.composing),
    opensOnArrow: ({ props }) => props.openOnArrow !== false && props.disabled !== true,
    opensOnPress: ({ props }) => props.openOnInputPress === true && props.disabled !== true,
    opensOnFocus: ({ props, event, context }) =>
      !context.focused &&
      props.openOnFocus === true &&
      props.disabled !== true &&
      props.readOnly !== true &&
      event.type === "INPUT.FOCUS" &&
      event.cause !== "layer" &&
      event.cause !== "window",
    isDirty: ({ context }) => context.dirty,
    chipRemovable: ({ event, props, values }) =>
      event.type === "CHIP.REMOVE" &&
      editable(props) &&
      selectedKeys(values.value).includes(event.key),
    armedRemovable: ({ context, props }) => context.armedChip !== null && editable(props),
    armsOnBackspace: ({ props, values }) =>
      mode(props) === "multiple" &&
      props.removeOnBackspace !== false &&
      editable(props) &&
      lastRemovable(chipsOf(props, values.value)) !== null,
    hasCompletion: ({ context }) => context.completion !== null,
    tabChooses: ({ props, context }) =>
      props.selectOnTab === true &&
      context.openReason !== "focus" &&
      context.highlightSource !== "pointer" &&
      context.highlightedKey !== null,
    closesOnSelect: ({ props }) => closesOnSelect(props),
    hasQuery: ({ values }) => values.inputValue !== "",
    /** Inline: Backspace goes back only above the root page. */
    canBack: ({ props, values }) =>
      props.onBack !== undefined && (props.page?.depth ?? 0) > 0 && values.inputValue === "",
    escapeCloses: ({ props }) => props.requestClose !== undefined,
    /** Free text: Escape on a closed popup clears the text. */
    clearsOnEscape: ({ props, values }) =>
      mode(props) === "none" && props.clearOnEscape === true && values.inputValue !== "",
  },
  actions: {
    ...pieces.actions,
    ...pattern.actions,
    typed: (a) => {
      if (a.event.type !== "INPUT.CHANGE" && a.event.type !== "COMPOSITION.END") return
      const text = a.event.type === "INPUT.CHANGE" ? a.event.text : a.event.text
      setText(a, text)
      // The user types into a focused input (its focus event may come after, as in a test).
      a.set("focused", true)
      a.set("dirty", true)
      a.set("armedChip", null)
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
        pattern.actions.highlightOnArrowOpen(a)
      } else if (
        a.event.type === "TRIGGER.PRESS" &&
        a.event.modality !== "pointer" &&
        a.event.modality !== "touch"
      ) {
        pattern.highlightEntry(a, "first")
      }
    },
    /** A keyboard highlight completes inline (autoComplete both), when typing allowed it. */
    complete: (a) => {
      const { props, context, values } = a
      if (props.autoComplete !== "both" || !context.completable || context.composing) return
      const key = context.highlightedKey
      const node = key === null ? undefined : props.collection.get(key)
      a.set("completion", node ? completion(values.inputValue, node.textValue, props.locale) : null)
    },
    // A rejected completion (Escape, caret keys) does not come back until typing again.
    removeCompletion: ({ set }) => {
      set("completion", null)
      set("completable", false)
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
        // An unknown key (its option not registered yet) keeps the text it has.
        text !== "" &&
        text !== a.values.inputValue &&
        selectedKeys(a.values.value).length > 0
      ) {
        setText(a, text)
      }
    },
    /** A selection with no text yet (a default value at start) shows its text. */
    fillText: (a) => {
      if (a.values.inputValue === "" && !a.context.dirty) {
        const text = selectionText(a.props, a.values.value)
        if (text !== "") setText(a, text)
      }
    },
    restoreDefault: (a) => {
      const v = a.props.defaultValue ?? (mode(a.props) === "multiple" ? [] : EMPTY)
      a.set("value", v as never)
      a.set("dirty", false)
      a.set("completion", null)
      setText(a, a.props.defaultInputValue ?? selectionText(a.props, v))
    },
    autofill: (a) => {
      if (a.event.type !== "AUTOFILL") return
      const { props } = a
      const text = a.event.text
      const key = props.items.has(toKey(text))
        ? toKey(text)
        : exactMatch(props.items, text, props.locale)
      if (key === null) return
      a.set("dirty", false)
      if (mode(props) === "multiple") {
        if (!selectedKeys(a.values.value).includes(key))
          a.set("value", [...selectedKeys(a.values.value), key])
        return
      }
      a.set("value", key)
      setText(a, textOf(props, key))
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => {
      set("focused", false)
      set("armedChip", null)
    },
    ...inputChipsActions,
    arm: (a) => a.set("armedChip", lastRemovable(chipsOf(a.props, a.values.value))),
    removeArmed: (a) => {
      const key = a.context.armedChip
      a.set("armedChip", null)
      if (key !== null) removeChip(a, key)
    },
    removeChip: (a) => {
      if (a.event.type === "CHIP.REMOVE") removeChip(a, a.event.key)
    },
    /** Text typed on a chip goes to the input, like typing there. */
    chipType: (a) => {
      if (a.event.type !== "CHIP.TYPE") return
      setText(a, a.values.inputValue + a.event.text)
      a.set("focused", true)
      a.set("dirty", true)
      a.set("armedChip", null)
    },
    run: (a) => {
      if (a.event.type === "ITEM.CHOOSE") runItem(a, a.event.key)
      else if (a.context.highlightedKey !== null) runItem(a, a.context.highlightedKey)
    },
    /** Inline mount and page change: the first item highlighted, nothing scrolled or said. */
    highlightFirst: (a) => highlightFirst(a),
    /**
     * Inline results: a new query highlights its first item and announces the count; the
     * same query (items appended, async) keeps a surviving highlight (dip/cmdk#97).
     */
    inlineResults: (a) => {
      pieces.actions.repairCollection(a)
      const { context, values } = a
      const newQuery = context.highlightQuery !== values.inputValue
      if (newQuery || context.highlightedKey === null) highlightFirst(a)
      if (newQuery) announceCount(a, "combobox")
    },
    clearQuery: (a) => {
      a.set("dirty", false)
      setText(a, "")
    },
    requestClose: (a) => a.props.requestClose?.(),
    back: (a) => a.props.onBack?.(),
    pageChanged: (a) => {
      a.set("dirty", false)
      setText(a, "")
      // The page's items are the collection already (onProps: collection, then page).
      highlightFirst(a)
      const label = a.props.page?.label
      if (label) {
        a.env.announcer.announce({
          message: a.props.messages.pageAnnouncement(label),
          priority: "polite",
          key: `combobox-page:${a.props.root}`,
        })
      }
    },
    resetOpen: ({ set }) => {
      set("openReason", null)
    },
  },
  effects: {
    /** Inline: the mount highlight reaches aria-activedescendant after the typing pause. */
    mountLag: (a) => {
      if (a.context.typingLag !== -1) return undefined
      const handle = a.env.scheduler.setTimeout(
        () => a.send({ type: "ACTIVEDESCENDANT.FLUSH", token: -1 }),
        a.props.typingPause ?? 500,
      )
      return () => a.env.scheduler.clearTimeout(handle)
    },
    /** The non-modal listbox layer and its positioning (combobox-pattern "Popup Placement"). */
    overlay: (a) => popupOverlay(a, "combobox", a.props.root),
  },
})

const initialContext = (props: ComboboxProps): ComboboxContext => ({
  ...initialCollectionContext(),
  ...initialInputChipsContext(),
  ...initialPatternContext(),
  lastCollection: props.collection,
  openReason: null,
  completable: false,
  completion: null,
  highlightQuery: null,
})

/**
 * Inline: the first navigable item is highlighted from the start (a typing highlight, so the
 * active descendant follows after the pause the `mountLag` effect waits).
 */
const initialInlineContext = (props: ComboboxProps): ComboboxContext => {
  const first =
    props.autoHighlight === false
      ? undefined
      : [...props.collection].find((n) => n.type === "item" && !n.disabled)
  return {
    ...initialContext(props),
    highlightedKey: first?.key ?? null,
    highlightSource: first ? "typing" : null,
    // A token no later typing highlight reuses (they count up from 1).
    typingLag: first ? -1 : null,
    highlightQuery: props.inputValue ?? props.defaultInputValue ?? "",
  }
}

export const comboboxMachine = /* @__PURE__ */ comboboxSetup.machine({
  id: "combobox",
  initial: "closed",
  context: initialContext,
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
    "INPUT.FOCUS": { guard: { not: "isFocused" }, actions: ["setFocused"] },
    // Chips (multiple, input-chips).
    "CHIP.NAVIGATE": { actions: ["focusChip"] },
    "CHIP.BLUR": { actions: ["blurChip"] },
    "CHIP.REMOVE": { guard: "chipRemovable", actions: ["removeChip"] },
    "CHIP.TYPE": { guard: "editable", actions: ["chipType"] },
    BACKSPACE_EMPTY: [
      { guard: { and: ["keyable", "armedRemovable"] }, actions: ["removeArmed"] },
      { guard: { and: ["keyable", "armsOnBackspace"] }, actions: ["arm"] },
    ],
    CARET: { actions: ["disarm"] },
    "INPUT.PRESS": { actions: ["disarm"] },
    "COMPOSITION.START": { actions: ["startComposition"] },
    "VALUE.SYNC": { actions: ["syncText"] },
    RESET: { actions: ["restoreDefault"] },
    AUTOFILL: { guard: "editable", actions: ["autofill"] },
    CLEAR: { guard: "editable", actions: ["clear"] },
    "CLEAR.PRESS": { guard: "editable", actions: ["clear"] },
  },
  states: {
    closed: {
      entry: ["clearHighlight", "resetOpen", "fillText", "endLag", "resetPlacement"],
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
          guard: { and: ["keyable", "opensOnArrow"] },
          target: "open",
          actions: ["setOpenReason", "highlightOnOpen", "announceHighlight"],
        },
        "TRIGGER.PRESS": {
          guard: "enabled",
          target: "open",
          actions: ["setOpenReason", "highlightOnOpen", "announceHighlight"],
        },
        "INPUT.PRESS": {
          guard: "opensOnPress",
          target: "open",
          actions: ["disarm", "setOpenReason"],
        },
        "INPUT.FOCUS": [
          { guard: "opensOnFocus", target: "open", actions: ["setFocused", "setOpenReason"] },
          { guard: { not: "isFocused" }, actions: ["setFocused"] },
        ],
        OPEN: { guard: "enabled", target: "open", actions: ["setOpenReason"] },
        ENTER: { guard: "keyable", actions: ["commit"] },
        ESCAPE: [
          { guard: { and: ["keyable", "clearsOnEscape"] }, actions: ["clear"] },
          { guard: { and: ["keyable", "isDirty"] }, actions: ["commit"] },
        ],
        TAB: { guard: "keyable", actions: ["commit"] },
        "INPUT.BLUR": { guard: "isFocused", actions: ["clearFocused", "commit"] },
        "COLLECTION.CHANGE": { actions: ["repairCollection", "syncText"] },
      },
    },
    open: {
      entry: ["announceOpen"],
      effects: ["overlay"],
      on: {
        "INPUT.CHANGE": { actions: ["typed"] },
        "COMPOSITION.END": { actions: ["endComposition", "typed"] },
        ARROW: { guard: "keyable", actions: ["arrow"] },
        NAVIGATE: {
          actions: ["endLag", "navigate", "scrollToHighlighted", "announceHighlight", "complete"],
        },
        HIGHLIGHT: { actions: ["endLag", "highlight", "complete"] },
        POINTER_MOVE: { actions: ["endLag", "pointerMove"] },
        "LIST.POINTER_LEAVE": { guard: "leaveClears", actions: ["clearHighlight"] },
        CARET: { guard: "keyable", actions: ["disarm", "clearHighlight", "removeCompletion"] },
        "ITEM.CHOOSE": [
          { guard: "closesOnSelect", target: "closed", actions: ["choose"] },
          { actions: ["choose"] },
        ],
        ENTER: [
          {
            guard: { and: ["keyable", "hasHighlight", "closesOnSelect"] },
            target: "closed",
            actions: ["choose"],
          },
          { guard: { and: ["keyable", "hasHighlight"] }, actions: ["choose"] },
          { guard: "keyable", target: "closed", actions: ["commit"] },
        ],
        ESCAPE: [
          { guard: { and: ["keyable", "hasCompletion"] }, actions: ["removeCompletion"] },
          { guard: "keyable", target: "closed", actions: ["commit"] },
        ],
        TAB: [
          {
            guard: { and: ["keyable", "tabChooses"] },
            target: "closed",
            actions: ["choose", "commit"],
          },
          { guard: "keyable", target: "closed", actions: ["commit"] },
        ],
        "TRIGGER.PRESS": { target: "closed", actions: ["commit"] },
        OUTSIDE_PRESS: { target: "closed", actions: ["commit"] },
        "INPUT.BLUR": { guard: "isFocused", target: "closed", actions: ["clearFocused", "commit"] },
        CLOSE: { target: "closed", actions: ["commit"] },
        "COLLECTION.CHANGE": { actions: ["results", "complete"] },
        "LOADING.SYNC": { actions: ["announceLoading"] },
        "POSITION.PLACED": { actions: ["placed"] },
        "ACTIVEDESCENDANT.FLUSH": { actions: ["flush"] },
      },
    },
  },
})
export type ComboboxMachine = typeof comboboxMachine

/**
 * The inline combobox (combobox "Inline Mode"): the list in place, always shown. Its only
 * state is `open`: no closed node, no open or close transitions, no overlay or positioning;
 * items run `onAction`; Escape clears the query, then asks the host to close; Backspace on an
 * empty query goes back a page.
 */
export const inlineComboboxMachine = /* @__PURE__ */ comboboxSetup.machine({
  id: "combobox",
  initial: "open",
  context: initialInlineContext,
  values: {
    value: { fallback: EMPTY },
    inputValue: { fallback: "" },
    open: { fallback: true, states: { open: true } },
  },
  onProps: {
    collection: "COLLECTION.CHANGE",
    // After the collection: a page's items are listed when its change is handled.
    page: "PAGE.CHANGE",
    loading: "LOADING.SYNC",
  },
  on: {
    "INPUT.FOCUS": { guard: { not: "isFocused" }, actions: ["setFocused"] },
    "INPUT.BLUR": { guard: "isFocused", actions: ["clearFocused"] },
    "COMPOSITION.START": { actions: ["startComposition"] },
    CLEAR: { guard: "editable", actions: ["clearQuery"] },
    "CLEAR.PRESS": { guard: "editable", actions: ["clearQuery"] },
  },
  states: {
    open: {
      effects: ["mountLag"],
      on: {
        "INPUT.CHANGE": { guard: "editable", actions: ["typed"] },
        "COMPOSITION.END": { actions: ["endComposition", "typed"] },
        ARROW: { guard: "keyable", actions: ["arrow"] },
        NAVIGATE: { actions: ["endLag", "navigate", "scrollToHighlighted", "announceHighlight"] },
        HIGHLIGHT: { actions: ["endLag", "highlight"] },
        POINTER_MOVE: { actions: ["endLag", "pointerMove"] },
        "LIST.POINTER_LEAVE": { guard: "leaveClears", actions: ["clearHighlight"] },
        // Home, End, Left and Right edit the text; the highlight stays.
        CARET: {},
        "ITEM.CHOOSE": { actions: ["run"] },
        ENTER: { guard: { and: ["keyable", "hasHighlight"] }, actions: ["run"] },
        ESCAPE: [
          { guard: { and: ["keyable", "hasQuery"] }, actions: ["clearQuery"] },
          { guard: { and: ["keyable", "escapeCloses"] }, actions: ["requestClose"] },
        ],
        BACKSPACE_EMPTY: { guard: { and: ["keyable", "canBack"] }, actions: ["back"] },
        "COLLECTION.CHANGE": { actions: ["inlineResults"] },
        "PAGE.CHANGE": { actions: ["pageChanged"] },
        "LOADING.SYNC": { actions: ["announceLoading"] },
        "ACTIVEDESCENDANT.FLUSH": { actions: ["flush"] },
      },
    },
  },
})
export type InlineComboboxMachine = typeof inlineComboboxMachine
