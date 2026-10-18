import { collectionContract } from "../../contract/collection"
import { contract, type Invariant, type Trait } from "../../contract/contract"
import type { Env } from "../../contract/env"
import type { TagGroupProps } from "./tag-group.machine"
import { tagGroupMachine } from "./tag-group.machine"

const collection = collectionContract({ itemRole: "row", orientation: "horizontal" })
type P =
  | (typeof collection.anatomy)[number]
  | "root"
  | "label"
  | "description"
  | "item-cell"
  | "item-text"
  | "item-remove"
  | "empty"
  | "hint"
type E = Env<P>

/** The traits of a props class (spec "Tag Group Contract"); runs swap them into the contract. */
export function tagGroupTraits(props: Pick<TagGroupProps, "selectionMode">): readonly Trait[] {
  return [
    "composite-roving",
    "directional",
    ...((props.selectionMode ?? "none") === "none" ? [] : (["selectable"] as const)),
  ]
}

/** Tag names in order: each tag's text, not its remove button. */
const tagNames = async (env: E) => {
  const out: string[] = []
  for (const t of await env.part("item-text").all()) out.push(await t.text())
  return out
}
/** The row named `name` (its name is its text). */
const tag = (env: E, name: string) => env.part("item", { role: "row", name })
/** The remove button of the tag named `name`. */
const removeButton = async (env: E, name: string) => {
  for (const b of await env.part("item-remove").all()) {
    if ((await b.accessibleName()).endsWith(name)) return b
  }
  return null
}
const focusInside = async (env: E) =>
  (await collection.queries.focusedItem(env)) !== null || (await env.part("list").isFocused())

/**
 * The removal hint reaches every enabled removable tag (spec "Removal Hint"): in keyboard and
 * virtual modality the hidden hint exists, and while it is active each such tag lists it in
 * its `aria-describedby`. A wrapper that strips the description fails here.
 */
const removalHint: Invariant<P> = {
  name: "tag-group-removal-hint",
  check: async ({ env, props, modality }) => {
    if (props["onRemove"] === undefined) return undefined
    if (modality !== "keyboard" && modality !== "virtual") return undefined
    // The hint is hidden: read it by its attributes (`exists` means rendered and shown).
    const [hint] = await env.part("hint").all()
    const id = hint ? await hint.attr("id") : null
    if (!hint || id === null) return "the removal hint is missing (no hint part in the group)"
    if ((await hint.attr("data-state")) !== "active") return undefined
    for (const tag of await env.part("item").all()) {
      if ((await tag.attr("aria-disabled")) === "true") continue
      const ids = ((await tag.attr("aria-describedby")) ?? "").split(/\s+/)
      if (id === null || !ids.includes(id)) {
        return `the removable tag "${await tag.accessibleName()}" does not reference the removal hint (aria-describedby="${(await tag.attr("aria-describedby")) ?? ""}", hint id "${id ?? ""}")`
      }
    }
    return undefined
  },
}

/** The Tag Group contract (design §5): the collection fragment, removal, activation. */
export const tagGroupContract = contract("tag-group", {
  machine: tagGroupMachine,
  anatomy: [
    ...collection.anatomy,
    "root",
    "label",
    "description",
    "item-cell",
    "item-text",
    "item-remove",
    "empty",
    "hint",
  ],
  // The List changes role with its state: `grid`, `group` (empty) or `list` (display-only).
  locate: ({ name }: { readonly name: string | RegExp }) => ({
    role: ["grid", "group", "list"],
    name,
  }),
  queries: {
    ...collection.queries,
    tags: tagNames,
    hasFocus: focusInside,
    isEmpty: async (env: E) => (await env.part("list").attr("data-empty")) !== null,
    isRemovable: async (env: E, name: string) =>
      (await tag(env, name).attr("data-removable")) !== null,
  },
  actions: {
    ...collection.actions,
    focusIn: {
      keyboard: async (env: E) => {
        for (const item of await env.part("item").all()) {
          if ((await item.attr("tabindex")) === "0") return item.focus()
        }
        return env.part("list").focus()
      },
      done: { hasFocus: true },
    },
    tabOut: {
      keyboard: (env: E) => env.keyboard("Tab"),
      done: { hasFocus: false },
    },
    next: {
      keyboard: (env: E) => env.keyboard("ArrowRight"),
      done: async () => true,
    },
    typeR: {
      keyboard: (env: E) => env.focused().type("r"),
      done: async () => true,
    },
    /** Removes the tag `name`: its button (pointer, virtual click), or Delete on it. */
    remove: {
      // Pointer (and, by the runner, virtual): a bare click on the tag's button.
      pointer: async (env: E, name: string) => (await removeButton(env, name))?.click(),
      keyboard: async (env: E, name: string) => {
        await tag(env, name).focus()
        await env.keyboard("Delete")
      },
      // Gone, and focus on a neighbour or the List.
      done: async (env: E, name: string) =>
        !(await tagNames(env)).includes(name) && (await focusInside(env)),
    },
    /** Delete on a selected tag: every selected enabled tag is removed. */
    removeSelected: {
      keyboard: async (env: E) => {
        for (const item of await env.part("item").all()) {
          if ((await item.attr("aria-selected")) === "true") {
            await item.focus()
            return env.keyboard("Delete")
          }
        }
      },
      done: async () => true,
    },
    /** A tag's action, link or selection: a press, or Enter on it. */
    act: {
      pointer: (env: E, name: string) => tag(env, name).click(),
      keyboard: async (env: E, name: string) => {
        await tag(env, name).focus()
        await env.keyboard("Enter")
      },
      done: async () => true,
    },
  },
  states: { idle: { hasFocus: false }, focused: { hasFocus: true } },
  events: {
    FOCUS: "focusIn",
    "COMPOSITE.BLUR": "tabOut",
    NAVIGATE: { action: "next", event: () => ({ move: "next" }) },
    HIGHLIGHT: { skip: "sent by tag focus and presses; covered by the driver tests" },
    POINTER_MOVE: { skip: "tags do not highlight on hover" },
    TYPEAHEAD: {
      action: "typeR",
      event: () => ({
        char: "r",
        composing: false,
        modifiers: { ctrl: false, meta: false, alt: false },
      }),
    },
    SELECT: { skip: "sent by ACTIVATE on a selectable tag; covered by act" },
    SELECT_ALL: "selectAll",
    CLEAR_SELECTION: { skip: "programmatic only" },
    DESELECT: { skip: "removal deselects through the value; covered by remove" },
    ACTIVATE: { skip: "Enter, Space and presses per precedence: scenario tests" },
    REMOVE: { skip: "removal ends with a collection change from the consumer: scenario tests" },
    "COLLECTION.CHANGE": { skip: "sent by the $props:collection edge (a prop step)" },
    "$props:collection": { skip: "the consumer's data after a removal: scenario tests" },
    "$sync:value": { skip: "a parent-controlled selection: scenario tests" },
    EXPAND: { skip: "tags are flat" },
    COLLAPSE: { skip: "tags are flat" },
  },
  traits: ["composite-roving", "directional"],
  invariants: [removalHint],
  // Roving: the highlight follows DOM focus, and focus entering the list enters it.
  commitsOnFocus: [
    { part: "item", state: "idle" },
    { part: "item", state: "focused" },
    { part: "list", state: "idle" },
    { part: "list", state: "focused" },
    // Focus inside a tag (its remove button) is that tag's focus: the highlight follows.
    { part: "item-remove", state: "idle" },
    { part: "item-remove", state: "focused" },
  ],
})
