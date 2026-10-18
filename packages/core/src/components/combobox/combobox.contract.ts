// The Combobox contract (combobox "Combobox Contract", combobox-pattern "Pattern Contract"):
// located by role combobox and name; the keyboard is the input's, the options are reached
// through aria-activedescendant.

import { contract, type Trait } from "../../contract/contract"
import type { Env } from "../../contract/env"
import type { ComboboxProps } from "./combobox.machine"
import { comboboxMachine, inlineComboboxMachine } from "./combobox.machine"
import { comboboxMessages } from "./combobox.messages"
import { patternContract } from "./pattern/contract"
import { optionsNeverSelected } from "./pattern/invariants"

type P =
  | "root"
  | "label"
  | "control"
  | "input"
  | "trigger"
  | "clear-trigger"
  | "positioner"
  | "popup"
  | "list"
  | "item"
  | "item-text"
  | "item-indicator"
  | "section"
  | "section-label"
  | "empty"
  | "load-more"
  | "chips"
  | "chip"
  | "chip-remove"
  | "chips-summary"
  | "hidden-input"
type E = Env<P>

/** The machine's state is the control's (the input's follows aria-expanded). */
const isOpen = async (env: E) => (await env.part("control").attr("data-state")) === "open"
const input = (env: E) => env.part("input")
const pattern = patternContract({
  isOpen,
  openByPointer: (env) => (env as E).part("trigger").click(),
  messages: comboboxMessages,
})
const { highlighted, focusInput } = pattern
/** Chip names in order: each chip's text without its remove button's. */
const chipNames = async (env: E) => {
  const chips = await env.part("chip").all()
  const removes = await env.part("chip-remove").all()
  const out: string[] = []
  for (const [i, chip] of chips.entries()) {
    const remove = removes.length === chips.length ? await removes[i]?.text() : ""
    const text = await chip.text()
    out.push((remove && text.endsWith(remove) ? text.slice(0, -remove.length) : text).trim())
  }
  return out
}
/** The traits of a props class: `selectable` unless nothing can be selected. */
export function comboboxTraits(
  props: Pick<ComboboxProps, "selectionMode" | "virtualized">,
): readonly Trait[] {
  const freeText = (props.selectionMode ?? "single") === "none"
  return [
    "composite-activedescendant",
    "layer",
    "presence",
    "anchored",
    // Free text: the visible input is the native form control (no hidden input to compare).
    ...(freeText ? [] : (["form-associated"] as const)),
    "field-associated",
    ...(freeText ? [] : (["selectable"] as const)),
    ...(props.virtualized ? (["set-metadata"] as const) : []),
  ]
}

/** The per-component invariants of a props class: never selected when nothing can be. */
export const comboboxInvariants = (props: Pick<ComboboxProps, "selectionMode">) =>
  (props.selectionMode ?? "single") === "none" ? [optionsNeverSelected] : []

const anatomy = [
  "root",
  "label",
  "control",
  "input",
  "trigger",
  "clear-trigger",
  "positioner",
  "popup",
  "list",
  "item",
  "item-text",
  "item-indicator",
  "section",
  "section-label",
  "empty",
  "load-more",
  "chips",
  "chip",
  "chip-remove",
  "chips-summary",
  "hidden-input",
  "item-description",
  "loading",
] as const

const locate = ({ name }: { readonly name: string | RegExp }) => ({ role: "combobox", name })

const queries = {
  ...pattern.queries,
  /** Selected option names (single: the committed text while something is selected). */
  value: async (env: E) =>
    (await env.part("control").attr("data-empty-value")) !== null ? [] : [await input(env).value()],
  /** Multiple: the chip names in order (input-chips). */
  chips: chipNames,
  /** Inline: the current page's key. */
  page: async (env: E) => env.part("root").attr("data-page"),
}

const actions = {
  ...pattern.actions,
  open: { ...pattern.open, pointer: (env: E) => env.part("trigger").click() },
  /** Multiple: removes the chip `name` (its remove button, or focus it and Backspace). */
  removeChip: {
    pointer: async (env: E, name: string) => {
      const chips = await chipNames(env)
      const removes = await env.part("chip-remove").all()
      await removes[chips.indexOf(name)]?.click()
    },
    keyboard: async (env: E, name: string) => {
      const chips = await chipNames(env)
      const all = await env.part("chip").all()
      await all[chips.indexOf(name)]?.focus()
      await env.keyboard("Backspace")
    },
    done: async (env: E, name: string) => !(await chipNames(env)).includes(name),
  },
  backspace: { keyboard: (env: E) => env.keyboard("Backspace"), done: async () => true },
  /** Pointer: the clear button; keyboard: select all text, Delete, then blur. */
  clear: {
    pointer: (env: E) => env.part("clear-trigger").click(),
    keyboard: async (env: E) => {
      await focusInput(env)
      await input(env).press("A", { mod: true })
      await input(env).press("Delete")
      await env.keyboard("Tab")
    },
    done: async (env: E) => (await input(env).value()) === "",
  },
  /** Inline: runs the item `name` (a press on it, or arrows to it and Enter). */
  run: {
    pointer: async (env: E, name: string) => env.part("item", { role: "option", name }).click(),
    keyboard: async (env: E, name: string) => {
      await focusInput(env)
      const count = await env.part("item").count()
      for (let i = 0; i <= count && (await highlighted(env)) !== name; i++) {
        await input(env).press("ArrowDown")
      }
      await input(env).press("Enter")
    },
    done: async () => true,
  },
  /** Inline: Backspace on an empty query (back a page). */
  back: {
    keyboard: async (env: E) => {
      await focusInput(env)
      await input(env).press("Backspace")
    },
    done: async () => true,
  },
}

const events = {
  "INPUT.CHANGE": {
    action: "typeR",
    event: (view: { readonly values: Readonly<Record<string, unknown>> }) => ({
      text: `${String(view.values["inputValue"] ?? "")}r`,
      inputType: "insertText",
      composing: false,
      caretAtEnd: true,
    }),
  },
  "INPUT.FOCUS": "focusIn",
  "INPUT.BLUR": "tabOut",
  "INPUT.PRESS": { skip: "openOnInputPress: scenario tests" },
  "TRIGGER.PRESS": { skip: "the trigger press: open() through the driver and scenario tests" },
  "CLEAR.PRESS": { skip: "the clear button: clear() through the driver and scenario tests" },
  ARROW: { action: "arrowDown", event: () => ({ key: "NEXT", alt: false, composing: false }) },
  ENTER: { action: "pressEnter", event: () => ({ composing: false }) },
  ESCAPE: { action: "pressEscape", event: () => ({ composing: false }) },
  TAB: { skip: "sent with INPUT.BLUR by tabOut; the Tab rules are scenario tests" },
  CARET: "caret",
  "ITEM.CHOOSE": { skip: "a press on an option: choose() scenario and driver tests" },
  BACKSPACE_EMPTY: "backspace",
  "CHIP.NAVIGATE": { skip: "chip focus: chip scenario tests (roving between chips)" },
  "CHIP.BLUR": { skip: "chip focus: chip scenario tests" },
  "CHIP.REMOVE": { skip: "removeChip(): chip scenario and driver tests" },
  "CHIP.TYPE": { skip: "typing on a chip: chip scenario tests" },
  AUTOFILL: { skip: "browser autofill: form scenario tests" },
  "COMPOSITION.START": { skip: "IME: compose() scenario and driver tests" },
  "COMPOSITION.END": { skip: "IME: compose() scenario and driver tests" },
  OUTSIDE_PRESS: { skip: "an outside press: scenario tests (dismiss layer)" },
  "POSITION.PLACED": { skip: "sent by positioning" },
  "ACTIVEDESCENDANT.FLUSH": { skip: "the typing pause: scenario tests with fake time" },
  "LIST.POINTER_LEAVE": { skip: "pointer leave: scenario tests" },
  "VALUE.SYNC": { skip: "sent by $props:value / $props:items edges" },
  "LOADING.SYNC": { skip: "sent by the $props:loading edge" },
  RESET: { skip: "a form reset: form scenario tests" },
  OPEN: { skip: "programmatic" },
  CLOSE: { skip: "programmatic" },
  CLEAR: { skip: "programmatic" },
  NAVIGATE: { skip: "sent by ARROW" },
  HIGHLIGHT: { skip: "sent by item clicks; covered by scenario tests" },
  POINTER_MOVE: { skip: "pointer highlight: scenario tests (real movement only)" },
  TYPEAHEAD: { skip: "a combobox types into its input, no typeahead" },
  SELECT: { skip: "the combobox chooses through ITEM.CHOOSE" },
  SELECT_ALL: { skip: "mod+A selects the input's text" },
  CLEAR_SELECTION: { skip: "programmatic only" },
  DESELECT: { skip: "chip removal (multiple): input-chips tests" },
  EXPAND: { skip: "flat" },
  COLLAPSE: { skip: "flat" },
  "COMPOSITE.BLUR": { skip: "the list is never focused" },
  "COLLECTION.CHANGE": { skip: "sent by the $props:collection edge" },
  "$props:collection": { skip: "results are a derivation of the typed text (INPUT.CHANGE)" },
  "$props:items": { skip: "collection changes: scenario tests (async label)" },
  "$props:value": { skip: "controlled value: scenario tests" },
  "$sync:open": { skip: "a controlled open: scenario tests" },
  "$props:loading": { skip: "async: scenario tests" },
  "PAGE.CHANGE": { skip: "inline only: sent by the $props:page edge" },
} as const

export const comboboxContract = contract("combobox", {
  machine: comboboxMachine,
  anatomy,
  locate,
  queries,
  actions,
  states: { closed: { isOpen: false }, open: { isOpen: true } },
  announcements: pattern.announcements,
  events,
  traits: [
    "composite-activedescendant",
    "layer",
    "presence",
    "anchored",
    "selectable",
    "form-associated",
    "field-associated",
  ],
  // The constraint input holds the selected keys (empty exactly when nothing is selected).
  formInput: {
    // Only the selection is submitted; the text and the open state are not form values.
    values: ["value"],
    expected: (vals) => {
      const v = vals["value"] as string | null | readonly string[] | undefined
      return { value: v == null ? "" : typeof v === "string" ? v : v.join(",") }
    },
  },
  // Focus on the input is a focus event; programmatic focus on a button leaves the input.
  commitsOnFocus: [
    { part: "input", state: "closed" },
    { part: "input", state: "open" },
    { part: "trigger", state: "closed" },
    { part: "trigger", state: "open" },
    { part: "clear-trigger", state: "closed" },
    { part: "clear-trigger", state: "open" },
    // The scrolling popup and list are focusable by script (scrollable-region-focusable):
    // a programmatic focus there leaves the input, inside the component.
    { part: "popup", state: "open" },
    { part: "list", state: "open" },
    // hidden-form-input: a focus on the constraint input moves to the visible input.
    { part: "hidden-input", state: "closed" },
    { part: "hidden-input", state: "open" },
    { part: "chip", state: "closed" },
    { part: "chip", state: "open" },
  ],
})

/**
 * The inline combobox (combobox "Inline Mode"): the inline machine's graph (one state, no
 * open or close edges), no popup traits, items run `onAction`, Backspace goes back a page.
 */
export const inlineComboboxContract = contract("combobox", {
  machine: inlineComboboxMachine,
  anatomy,
  locate,
  queries,
  actions,
  // The machine never closes; the control's data-state follows aria-expanded.
  states: { open: {} },
  announcements: pattern.announcements,
  events: {
    ...events,
    "ITEM.CHOOSE": { skip: "a press on an item: run() scenario and driver tests" },
    "INPUT.BLUR": "tabOut",
    BACKSPACE_EMPTY: "back",
    "PAGE.CHANGE": { skip: "sent by the $props:page edge" },
    "$props:page": { skip: "pages: scenario tests" },
  },
  traits: ["composite-activedescendant"],
  invariants: [optionsNeverSelected],
  commitsOnFocus: [
    { part: "input", state: "open" },
    { part: "list", state: "open" },
  ],
})
