// The Combobox contract (combobox "Combobox Contract", combobox-pattern "Pattern Contract"):
// located by role combobox and name; the keyboard is the input's, the options are reached
// through aria-activedescendant.

import { contract, type Trait } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import type { ComboboxProps } from "./combobox.machine"
import { comboboxMachine } from "./combobox.machine"
import { comboboxMessages } from "./combobox.messages"

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
type E = Env<P>

const optionNames = async (
  env: E,
  test: (attr: (n: string) => Promise<string | null>) => Promise<boolean>,
) => {
  const out: string[] = []
  for (const p of await env.part("item").all()) {
    if ((await p.attr("role")) === "option" && (await test((n) => p.attr(n))))
      out.push(await p.text())
  }
  return out
}
const highlighted = async (env: E) =>
  (await optionNames(env, async (a) => (await a("data-highlighted")) !== null))[0] ?? null
const isOpen = async (env: E) => (await env.part("input").attr("data-state")) === "open"
const input = (env: E) => env.part("input")
/** Settled for pointer input: closed, empty (nothing to press), or open and placed. */
const settled = async (env: E) =>
  !(await isOpen(env)) ||
  (await input(env).attr("aria-expanded")) === "false" ||
  (await positioningQueries.isPlaced(env))
const focusInput = async (env: E) => {
  if (!(await input(env).isFocused())) await input(env).focus()
}
/** Opens with ArrowDown if needed, then arrows until `name` is highlighted. */
const arrowTo = async (env: E, name: string) => {
  await focusInput(env)
  if (!(await isOpen(env))) await input(env).press("ArrowDown")
  const count = await env.part("item").count()
  for (let i = 0; i <= count && (await highlighted(env)) !== name; i++) {
    await input(env).press("ArrowDown")
  }
}

/** The traits of a props class: `selectable` unless nothing can be selected. */
export function comboboxTraits(
  props: Pick<ComboboxProps, "selectionMode" | "virtualized">,
): readonly Trait[] {
  return [
    "composite-activedescendant",
    "layer",
    "presence",
    "anchored",
    ...((props.selectionMode ?? "single") === "none" ? [] : (["selectable"] as const)),
    ...(props.virtualized ? (["set-metadata"] as const) : []),
  ]
}

export const comboboxContract = contract("combobox", {
  machine: comboboxMachine,
  anatomy: [
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
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "combobox", name }),
  queries: {
    ...positioningQueries,
    inputValue: (env: E) => input(env).value(),
    isOpen,
    /** Open with no options listed (the empty state). */
    isEmpty: async (env: E) =>
      (await isOpen(env)) && (await input(env).attr("aria-expanded")) === "false",
    isLoading: async (env: E) => (await env.part("list").attr("aria-busy")) === "true",
    /** Listed option names in order. */
    items: (env: E) => optionNames(env, async () => true),
    highlighted,
    /** Selected option names among the listed ones (the popup must be open). */
    selected: (env: E) => optionNames(env, async (a) => (await a("aria-selected")) === "true"),
    /** Selected option names (single: the committed text while something is selected). */
    value: async (env: E) =>
      (await env.part("control").attr("data-empty-value")) !== null
        ? []
        : [await input(env).value()],
    hasFocus: (env: E) => input(env).isFocused(),
  },
  actions: {
    focusIn: { keyboard: (env: E) => input(env).focusWithTab(), done: { hasFocus: true } },
    type: {
      keyboard: async (env: E, text: string) => {
        await focusInput(env)
        await input(env).type(text)
      },
      done: async (env: E, text: string) =>
        (await input(env).value()).endsWith(text) && (await settled(env)),
    },
    compose: {
      keyboard: async (env: E, text: string, commit: boolean) => {
        await focusInput(env)
        await input(env).compose(
          [...text].map((_, i) => text.slice(0, i + 1)),
          commit ? text : undefined,
        )
      },
      done: async () => true,
    },
    open: {
      pointer: (env: E) => env.part("trigger").click(),
      keyboard: async (env: E) => {
        await focusInput(env)
        await input(env).press("ArrowDown")
      },
      done: async (env: E) => (await isOpen(env)) && (await settled(env)),
    },
    close: { keyboard: (env: E) => input(env).press("Escape"), done: { isOpen: false } },
    arrowDown: { keyboard: (env: E) => input(env).press("ArrowDown"), done: async () => true },
    arrowUp: { keyboard: (env: E) => input(env).press("ArrowUp"), done: async () => true },
    altArrowDown: {
      keyboard: (env: E) => input(env).press("ArrowDown", { alt: true }),
      done: async () => true,
    },
    caret: { keyboard: (env: E) => input(env).press("ArrowRight"), done: async () => true },
    pressEnter: { keyboard: (env: E) => input(env).press("Enter"), done: async () => true },
    pressEscape: { keyboard: (env: E) => input(env).press("Escape"), done: async () => true },
    tabOut: { keyboard: (env: E) => env.keyboard("Tab"), done: { hasFocus: false } },
    blur: {
      pointer: (env: E) => env.pointerOutside(),
      none: { keyboard: "the keyboard blur is tabOut" },
      done: { hasFocus: false },
    },
    /** One letter typed (the model's text change). */
    typeR: {
      keyboard: async (env: E) => {
        await focusInput(env)
        await input(env).type("r")
      },
      done: async () => true,
    },
    clearText: {
      keyboard: async (env: E) => {
        await focusInput(env)
        await input(env).press("A", { mod: true })
        await input(env).press("Backspace")
      },
      done: async (env: E) => (await input(env).value()) === "",
    },
    /** Chooses the option `name`: a press on it, or arrows to it and Enter. */
    choose: {
      pointer: async (env: E, name: string) => {
        if (!(await isOpen(env))) await env.part("trigger").click()
        await env.part("item", { role: "option", name }).click()
      },
      keyboard: async (env: E, name: string) => {
        await arrowTo(env, name)
        await input(env).press("Enter")
      },
      done: async () => true,
    },
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
  },
  states: { closed: { isOpen: false }, open: { isOpen: true } },
  announcements: {
    focusAnnouncement: (o) =>
      comboboxMessages.focusAnnouncement(
        String(o.highlighted ?? ""),
        (o.selected ?? []).includes(String(o.highlighted ?? "")),
      ),
    countAnnouncement: (o) =>
      (o.items?.length ?? 0) === 0
        ? comboboxMessages.noResults
        : comboboxMessages.count(o.items?.length ?? 0),
    selectionAnnouncement: (o) => comboboxMessages.selectedAnnouncement(String(o.inputValue ?? "")),
  },
  events: {
    "INPUT.CHANGE": {
      action: "typeR",
      event: (view) => ({
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
    "$props:loading": { skip: "async: scenario tests" },
  },
  traits: ["composite-activedescendant", "layer", "presence", "anchored", "selectable"],
  commitsOnFocus: [
    { part: "input", state: "closed" },
    { part: "input", state: "open" },
  ],
})
