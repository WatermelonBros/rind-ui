import {
  type Collection,
  collectionContract,
  contract,
  createListCollection,
  toKey,
} from "@rind-ui/core"
import { listboxMachine } from "./listbox.machine"

/**
 * The collection a `$props:collection` step switches to; the model test sets it per
 * argument class (contracts are static, the classes are not).
 */
export const changedCollection: { current: Collection<unknown> } = {
  current: createListCollection({ items: [], getKey: String, getText: String }),
}

const collection = collectionContract({ itemRole: "option" })

/** The listbox fixture: the collection fragment plus focus in and out. */
export const listboxContract = contract("listbox", {
  machine: listboxMachine,
  anatomy: [...collection.anatomy],
  locate: (name: string) => ({ role: "listbox", name }),
  queries: {
    ...collection.queries,
    hasFocus: async (env) =>
      (await collection.queries.focusedItem(env)) !== null || (await env.part("list").isFocused()),
  },
  actions: {
    ...collection.actions,
    /** Like Tab into the list: the roving tab stop (tabindex 0), else the list. */
    focusIn: {
      keyboard: async (env) => {
        for (const item of await env.part("item").all()) {
          if ((await item.attr("tabindex")) === "0") return item.focus()
        }
        return env.part("list").focus()
      },
      done: { hasFocus: true },
    },
    /** Tab moves focus past the list (the fixture page has a button after it). */
    tabOut: {
      keyboard: (env) => env.keyboard("Tab"),
      done: { hasFocus: false },
    },
    next: {
      keyboard: (env) => env.keyboard("ArrowDown"),
      done: async () => true,
    },
    hoverLast: {
      pointer: async (env) => {
        const items = env.part("item")
        return items.nth((await items.count()) - 1).hover()
      },
      none: { keyboard: "a pointer hover has no keyboard equivalent (highlight covers it)" },
      done: async () => true,
    },
    /** Typeahead "b" (the model's TYPEAHEAD edge). */
    typeB: {
      keyboard: (env) => env.focused().type("b"),
      done: async () => true,
    },
    chooseHighlighted: {
      keyboard: (env) => env.keyboard("Space"),
      done: async () => true,
    },
  },
  states: { idle: { hasFocus: false }, focused: { hasFocus: true } },
  events: {
    FOCUS: "focusIn",
    "COMPOSITE.BLUR": "tabOut",
    NAVIGATE: { action: "next", event: () => ({ move: "next" }) },
    HIGHLIGHT: { skip: "sent by item focus and clicks; covered by the driver tests" },
    POINTER_MOVE: {
      action: "hoverLast",
      event: (view) => ({ key: lastKey(view) }),
    },
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
        shift: false,
        mod: false,
      }),
    },
    SELECT_ALL: "selectAll",
    CLEAR_SELECTION: { skip: "no gesture in the fixture: an API call only" },
    DESELECT: { skip: "explicit removal (a deleted tag): no gesture in a listbox" },
    "COLLECTION.CHANGE": { skip: "sent by the $props:collection edge (a prop step)" },
    // The new collection drops the first item (each argument class supplies its own).
    "$props:collection": { props: () => ({ collection: changedCollection.current }) },
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

/** The last item's key in the oracle's collection (the one `hoverLast` hovers). */
function lastKey(view: { context: unknown }): string {
  const { lastCollection } = view.context as { lastCollection: Collection<unknown> | null }
  return lastCollection?.lastKey() ?? ""
}
