import { toKey } from "../../collection/key"
import { collectionContract } from "../../contract/collection"
import { contract, type Trait } from "../../contract/contract"
import type { Env } from "../../contract/env"
import type { ListboxProps } from "./listbox.machine"
import { listboxMachine } from "./listbox.machine"

const collection = collectionContract({ itemRole: "option" })
type P =
  | (typeof collection.anatomy)[number]
  | "root"
  | "label"
  | "item-text"
  | "item-description"
  | "item-indicator"
  | "empty"
  | "load-more"
type E = Env<P>

/** The traits of a props class (spec "Listbox Contract"); runs swap them into the contract. */
export function listboxTraits(
  props: Pick<ListboxProps, "selectionMode" | "virtualized" | "orientation">,
): readonly Trait[] {
  return [
    "composite-roving",
    ...((props.selectionMode ?? "single") === "none" ? [] : (["selectable"] as const)),
    ...(props.virtualized ? (["set-metadata"] as const) : []),
    ...(props.orientation === "horizontal" ? (["directional"] as const) : []),
  ]
}

/** The Listbox contract: the collection fragment, focus in and out, actions. */
export const listboxContract = contract("listbox", {
  machine: listboxMachine,
  anatomy: [
    ...collection.anatomy,
    "root",
    "label",
    "item-text",
    "item-description",
    "item-indicator",
    "empty",
    "load-more",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "listbox", name }),
  queries: {
    ...collection.queries,
    hasFocus: async (env: E) =>
      (await collection.queries.focusedItem(env)) !== null || (await env.part("list").isFocused()),
    isEmpty: async (env: E) => (await env.part("list").attr("data-empty")) !== null,
    selectionMode: async (env: E) => env.part("list").attr("data-selection-mode"),
  },
  actions: {
    ...collection.actions,
    /** Like Tab into the list: the roving tab stop (tabindex 0), else the list. */
    focusIn: {
      keyboard: async (env: E) => {
        for (const item of await env.part("item").all()) {
          if ((await item.attr("tabindex")) === "0") return item.focus()
        }
        return env.part("list").focus()
      },
      done: { hasFocus: true },
    },
    /** Tab moves focus past the list (the fixture page has a button after it). */
    tabOut: {
      keyboard: (env: E) => env.keyboard("Tab"),
      done: { hasFocus: false },
    },
    next: {
      keyboard: (env: E) => env.keyboard("ArrowDown"),
      done: async () => true,
    },
    typeB: {
      keyboard: (env: E) => env.focused().type("b"),
      done: async () => true,
    },
    chooseHighlighted: {
      keyboard: (env: E) => env.keyboard("Space"),
      done: async () => true,
    },
    /** The action on an item (press, or focus it and Enter); `onAction` is the fixture's. */
    act: {
      pointer: async (env: E, name: string) => {
        for (const item of await env.part("item").all()) {
          if ((await item.accessibleName()) === name) return item.click()
        }
      },
      keyboard: async (env: E, name: string) => {
        for (const item of await env.part("item").all()) {
          if ((await item.accessibleName()) === name) {
            await item.focus()
            return env.keyboard("Enter")
          }
        }
      },
      done: async () => true,
    },
  },
  states: { idle: { hasFocus: false }, focused: { hasFocus: true } },
  events: {
    FOCUS: "focusIn",
    "COMPOSITE.BLUR": "tabOut",
    NAVIGATE: { action: "next", event: () => ({ move: "next" }) },
    HIGHLIGHT: { skip: "sent by item focus and clicks; covered by the driver tests" },
    POINTER_MOVE: { skip: "a standalone list does not highlight on hover" },
    TYPEAHEAD: {
      action: "typeB",
      event: () => ({
        char: "b",
        composing: false,
        modifiers: { ctrl: false, meta: false, alt: false },
      }),
    },
    SELECT: {
      action: "chooseHighlighted",
      event: (view) => ({
        key: (view.context as { highlightedKey: string | null }).highlightedKey ?? toKey(""),
        modality: "keyboard",
        shift: false,
        mod: false,
      }),
    },
    SELECT_ALL: "selectAll",
    CLEAR_SELECTION: { skip: "programmatic only" },
    DESELECT: { skip: "explicit removal: no gesture in a listbox" },
    ACTION: { skip: "the action of a replace list (Enter, double press): scenario tests" },
    "COLLECTION.CHANGE": { skip: "sent by the $props:collection edge (a prop step)" },
    "$props:collection": {
      skip: "collection changes: the collections fixture's model and scenario tests",
    },
    EXPAND: { skip: "a listbox is flat" },
    COLLAPSE: { skip: "a listbox is flat" },
  },
  traits: ["composite-roving", "selectable", "set-metadata", "directional"],
  // Roving: the highlight follows DOM focus, and focus entering the list enters it.
  commitsOnFocus: [
    { part: "item", state: "idle" },
    { part: "item", state: "focused" },
    { part: "list", state: "idle" },
    { part: "list", state: "focused" },
  ],
})
