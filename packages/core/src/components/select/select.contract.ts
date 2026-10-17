import { contract, type Trait } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { positioningQueries } from "../../contract/positioning"
import type { SelectProps } from "./select.machine"
import { selectMachine } from "./select.machine"

type P =
  | "label"
  | "trigger"
  | "value-text"
  | "indicator"
  | "description"
  | "positioner"
  | "content"
  | "list"
  | "item"
  | "item-text"
  | "item-indicator"
  | "item-description"
  | "section"
  | "section-label"
  | "separator"
  | "empty"
  | "hidden-input"
type E = Env<P>

/** The option a model run chooses (set by the model test). */
export const selectArgs: { current: { readonly key: string; readonly label: string } } = {
  current: { key: "", label: "" },
}

const isOpen = async (env: E) => (await env.part("trigger").attr("aria-expanded")) === "true"
const closed = async (env: E) => !(await isOpen(env))

const option = (env: E, name: string | RegExp): Part => env.find({ role: "option", name })

const focusedItem = async (env: E) => {
  const f = env.focused()
  if (!(await f.exists())) return null
  return (await f.attr("role")) === "option" ? f.accessibleName() : null
}

const focusInList = async (env: E) =>
  (await focusedItem(env)) !== null || (await env.part("list").isFocused())

/** Arrows from wherever focus is in the list to `target` (bounded: one pass). */
async function arrowTo(env: E, target: Part) {
  const count = (await env.find({ role: "option" }).all()).length
  for (let i = 0; i <= count && !(await target.isFocused()); i++) await env.keyboard("ArrowDown")
}

const openedDone = async (env: E) =>
  (await isOpen(env)) && (await positioningQueries.isPlaced(env)) && (await focusInList(env))

/** The traits of a props class: a non-modal select is not modal. */
export function selectTraits(props: Pick<SelectProps, "modal">): readonly Trait[] {
  return props.modal === false
    ? ["layer", "restores-focus", "presence", "anchored"]
    : ["layer", "restores-focus", "presence", "anchored", "modal"]
}

/** The Select contract: open and close, choose by gesture or typing, form queries. */
export const selectContract = contract("select", {
  machine: selectMachine,
  anatomy: [
    "label",
    "trigger",
    "value-text",
    "indicator",
    "description",
    "positioner",
    "content",
    "list",
    "item",
    "item-text",
    "item-indicator",
    "item-description",
    "section",
    "section-label",
    "separator",
    "empty",
    "hidden-input",
  ],
  // Located through its trigger: a closed select renders no list.
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "combobox" as const, name }),
  queries: {
    ...positioningQueries,
    isOpen,
    /** What the trigger shows: the selected texts, else the placeholder. */
    valueText: async (env: E) => (await env.part("value-text").text()).trim(),
    hasPlaceholder: async (env: E) => (await env.part("trigger").attr("data-placeholder")) !== null,
    /** The submitted value of a single select ("" with none). */
    formValue: async (env: E) => env.part("hidden-input").value(),
    options: async (env: E) => {
      if (!(await env.part("list").exists())) return []
      const out: string[] = []
      for (const p of await env.find({ role: "option" }).all()) out.push(await p.accessibleName())
      return out
    },
    selected: async (env: E) => {
      const out: string[] = []
      for (const p of await env.find({ role: "option" }).all()) {
        if ((await p.attr("aria-selected")) === "true") out.push(await p.accessibleName())
      }
      return out
    },
    highlighted: async (env: E) => {
      for (const p of await env.find({ role: "option" }).all()) {
        if ((await p.attr("data-highlighted")) !== null) return p.accessibleName()
      }
      return null
    },
    focusedItem,
    isDisabled: async (env: E, name: string | RegExp) =>
      (await option(env, name).attr("aria-disabled")) === "true",
    /** The last close reason ("escape-key"), while the content is mounted. */
    closeReason: async (env: E) =>
      (await env.part("content").exists()) ? env.part("content").attr("data-close-reason") : null,
  },
  actions: {
    open: {
      pointer: async (env: E) => env.part("trigger").click(),
      touch: async (env: E) => env.part("trigger").tap(),
      keyboard: async (env: E) => env.part("trigger").press("Enter"),
      // Placed, then focused (never the other way round).
      done: openedDone,
    },
    openWithArrowDown: {
      keyboard: async (env: E) => env.part("trigger").press("ArrowDown"),
      done: openedDone,
    },
    openWithArrowUp: {
      keyboard: async (env: E) => env.part("trigger").press("ArrowUp"),
      done: openedDone,
    },
    /** Presses the trigger of the open select (Escape for the keyboard). */
    close: {
      pointer: async (env: E) => env.part("trigger").click(),
      touch: async (env: E) => env.part("trigger").tap(),
      keyboard: async (env: E) => env.keyboard("Escape"),
      done: closed,
    },
    /** Opens the select if needed and chooses the option named `name`. */
    choose: {
      pointer: async (env: E, name: string | RegExp) => {
        if (!(await isOpen(env))) await env.part("trigger").click()
        await env.until(() => openedDone(env), Boolean)
        await option(env, name).click()
      },
      touch: async (env: E, name: string | RegExp) => {
        if (!(await isOpen(env))) await env.part("trigger").tap()
        await env.until(() => openedDone(env), Boolean)
        await option(env, name).tap()
      },
      keyboard: async (env: E, name: string | RegExp) => {
        if (!(await isOpen(env))) await env.part("trigger").press("Enter")
        await env.until(() => openedDone(env), Boolean)
        await arrowTo(env, option(env, name))
        await env.keyboard("Enter")
      },
      done: async () => true,
    },
    /** Types on the focused trigger or list (closed: selects the match; open: highlights). */
    typeahead: {
      keyboard: async (env: E, text: string) => {
        await env.focused().type(text)
      },
      done: async () => true,
    },
    arrowDown: { keyboard: async (env: E) => env.keyboard("ArrowDown"), done: async () => true },
    pressEscape: { keyboard: async (env: E) => env.keyboard("Escape"), done: closed },
    pressOutside: {
      pointer: async (env: E) => env.pointerOutside(),
      none: { keyboard: "an outside press is a pointer interaction" },
      done: closed,
    },
    tabOut: { keyboard: async (env: E) => env.keyboard("Tab"), done: closed },
    /** Presses the label: the trigger takes focus, the popup stays closed. */
    pressLabel: {
      pointer: async (env: E) => env.part("label").click(),
      none: { keyboard: "a label is pressed with a pointer" },
      done: async (env: E) => (await env.part("trigger").isFocused()) && (await closed(env)),
    },
  },
  states: {
    open: { isOpen: true, isPlaced: true },
    closed: { isOpen: false },
  },
  dataState: {
    open: { trigger: "open", positioner: "open", content: "open" },
    closed: { trigger: "closed" },
  },
  events: {
    TRIGGER_PRESS: { from: { closed: "open", open: "close" } },
    TRIGGER_KEY: { action: "openWithArrowUp", event: () => ({ key: "last" }) },
    LABEL_PRESS: "pressLabel",
    SELECT: {
      action: "choose",
      // The mapping's args type misses the action's own arguments (text-field's gap).
      args: (() => [selectArgs.current.label]) as never,
      event: () => ({
        key: selectArgs.current.key,
        modality: "keyboard",
        shift: false,
        mod: false,
      }),
    },
    NAVIGATE: { action: "arrowDown", event: () => ({ move: "next" }) },
    ESCAPE_KEY: "pressEscape",
    OUTSIDE_PRESS: "pressOutside",
    TAB_KEY: { action: "tabOut", event: () => ({ shift: false }) },
    TYPEAHEAD: { skip: "state-dependent (closed selects, open highlights): the DOM tests" },
    HIGHLIGHT: { skip: "focus follows the highlight: every keyboard step" },
    POINTER_MOVE: { skip: "pointer paths: covered by the browser tests" },
    OUTSIDE_FOCUS: { skip: "non-modal focus leaving: covered by the DOM tests" },
    PARENT_DISMISSED: { skip: "closing the parent layer: covered by the nesting DOM tests" },
    WINDOW_BLUR: { skip: "window focus: covered by the DOM tests" },
    OPEN: { skip: "programmatic (actionsRef.open): covered by the machine tests" },
    CLOSE: { skip: "programmatic (actionsRef.close): covered by the machine tests" },
    "FORM.RESET": { skip: "a form reset: covered by the form tests" },
    "FORM.AUTOFILL": { skip: "the browser's autofill: covered by the form tests" },
    "POSITION.PLACED": {
      skip: "sent by the position capability, not a gesture (fakePositioning in the node tests)",
    },
    SELECT_ALL: { skip: "a select has no select-all gesture" },
    CLEAR_SELECTION: { skip: "programmatic only" },
    DESELECT: { skip: "explicit removal: no gesture in a select" },
    EXPAND: { skip: "a select is flat" },
    COLLAPSE: { skip: "a select is flat" },
    "COLLECTION.CHANGE": { skip: "sent by the $props:collection edge (a prop step)" },
    "$props:collection": { skip: "collection changes: covered by the DOM tests" },
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
  },
  traits: ["layer", "restores-focus", "presence", "anchored", "modal"],
  // Focus moving inside the open popup is navigation by definition.
  commitsOnFocus: [
    { part: "trigger", state: "open" },
    { part: "list", state: "open" },
    { part: "item", state: "open" },
  ],
  semantics: { trigger: "trigger", content: "content", item: "item" },
})
