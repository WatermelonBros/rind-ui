import { collectionContract } from "../../contract/collection"
import { contract, type Invariant, type Trait } from "../../contract/contract"
import type { Env } from "../../contract/env"
import type { GridListProps } from "./grid-list.machine"
import { gridListMachine } from "./grid-list.machine"

const collection = collectionContract({ itemRole: "row", naming: "accessible" })
type P =
  | (typeof collection.anatomy)[number]
  | "root"
  | "label"
  | "item-cell"
  | "item-text"
  | "item-description"
  | "item-checkbox"
  | "item-control"
  | "empty"
  | "load-more"
type E = Env<P>

/** The traits of a props class (spec "Grid List Contract"); runs swap them into the contract. */
export function gridListTraits(
  props: Pick<GridListProps, "selectionMode"> & { readonly layout?: "stack" | "grid" },
): readonly Trait[] {
  return [
    "composite-roving",
    ...((props.selectionMode ?? "none") === "none" ? [] : (["selectable"] as const)),
    ...(props.layout === "grid" ? (["directional"] as const) : []),
  ]
}

const row = (env: E, name: string) => env.part("item", { role: "row", name })
const rowText = async (env: E) => {
  const out: string[] = []
  for (const t of await env.part("item-text").all()) out.push(await t.text())
  return out
}
/** The controls (and the checkbox) inside a row. */
const controlsIn = async (r: ReturnType<E["part"]>) => [
  ...(await r.scoped("grid-list", "item-control").all()),
  ...(await r.scoped("grid-list", "item-checkbox").all()),
]
/** The selection checkbox of the row named `name`. */
const checkbox = async (env: E, name: string) => {
  const [cb] = await row(env, name).scoped("grid-list", "item-checkbox").all()
  return cb
}
/** The control named `controlName` inside the row named `name`. */
const control = async (env: E, name: string, controlName: string) => {
  for (const c of await row(env, name).scoped("grid-list", "item-control").all()) {
    if ((await c.accessibleName()) === controlName) return c
  }
  throw new Error(`no control "${controlName}" in row "${name}"`)
}
const focusInside = async (env: E) => {
  if ((await collection.queries.focusedItem(env)) !== null) return true
  if (await env.part("list").isFocused()) return true
  for (const c of [
    ...(await env.part("item-control").all()),
    ...(await env.part("item-checkbox").all()),
  ]) {
    if (await c.isFocused()) return true
  }
  return false
}

/** A row's selection and its action count (`data-action-count`, written per action). */
const rowState = async (env: E, name: string) => ({
  selected: await row(env, name).attr("aria-selected"),
  acted: await row(env, name).attr("data-action-count"),
})
let before: { selected: string | null; acted: string | null } = { selected: null, acted: null }
const remember = async (env: E, name: string) => {
  before = await rowState(env, name)
}

/** The highlighted row's text (else the first row's), for steps that act on it. */
const highlightedName = (view: unknown) => {
  const v = view as {
    context: {
      highlightedKey: string | null
      lastCollection: {
        get(k: string): { textValue: string } | undefined
        firstKey(): string | null
      }
    }
  }
  const c = v.context.lastCollection
  const key = v.context.highlightedKey ?? c.firstKey()
  return key === null ? "" : (c.get(key)?.textValue ?? key)
}
const highlightedKey = (view: unknown) => {
  const v = view as {
    context: { highlightedKey: string | null; lastCollection: { firstKey(): string | null } }
  }
  return v.context.highlightedKey ?? v.context.lastCollection.firstKey() ?? ""
}

/**
 * The row's children (spec "row-children"): arrow mode never makes a control tabbable; tab
 * mode only on the highlighted row; a disabled row's controls are disabled and not tabbable;
 * a row's name never contains a control's name.
 */
const rowChildren: Invariant<P> = {
  name: "grid-list-row-children",
  check: async ({ env }) => {
    const list = env.part("list")
    const mode = (await list.attr("data-child-navigation")) ?? "arrow"
    for (const r of await env.part("item").all()) {
      const highlighted = (await r.attr("data-highlighted")) !== null
      const disabled = (await r.attr("aria-disabled")) === "true"
      const name = await r.accessibleName()
      for (const c of await controlsIn(r)) {
        const tabbable = (await c.attr("tabindex")) === "0"
        const what = `control "${await c.accessibleName()}" of row "${name}"`
        if (tabbable && (mode === "arrow" || !highlighted || disabled)) {
          return `${what} is tabbable (${mode} mode, row ${highlighted ? "highlighted" : "not highlighted"}${disabled ? ", disabled" : ""})`
        }
        if (
          disabled &&
          (await c.attr("aria-disabled")) !== "true" &&
          (await c.attr("disabled")) === null
        ) {
          return `${what} is not disabled although its row is`
        }
        const cname = await c.accessibleName()
        if (cname !== "" && name.includes(cname) && cname !== name) {
          return `row "${name}" contains its ${what}'s name`
        }
      }
    }
    return undefined
  },
}

/** The Grid List contract (design §6): the collection fragment, controls and checkboxes. */
export const gridListContract = contract("grid-list", {
  machine: gridListMachine,
  anatomy: [
    ...collection.anatomy,
    "root",
    "label",
    "item-cell",
    "item-text",
    "item-description",
    "item-checkbox",
    "item-control",
    "empty",
    "load-more",
  ],
  // An empty list is a `group`: the same instance by the same name.
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: ["grid", "group"], name }),
  queries: {
    ...collection.queries,
    rows: rowText,
    hasFocus: focusInside,
    isEmpty: async (env: E) => (await env.part("list").attr("data-empty")) !== null,
    selectionMode: async (env: E) => env.part("list").attr("data-selection-mode"),
    /** The names of the controls in the row named `name`. */
    controls: async (env: E, name: string) => {
      const out: string[] = []
      for (const c of await row(env, name).scoped("grid-list", "item-control").all()) {
        out.push(await c.accessibleName())
      }
      return out
    },
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
    /** Tab until focus leaves the list (tab mode: past the highlighted row's controls). */
    tabOut: {
      keyboard: async (env: E) => {
        // A row and its controls: at most one Tab each, plus the one that leaves.
        const bound = (await env.part("item-control").all()).length + 2
        for (let i = 0; i < bound; i++) {
          await env.keyboard("Tab")
          if (!(await focusInside(env))) return
        }
      },
      done: async () => true,
    },
    next: {
      keyboard: (env: E) => env.keyboard("ArrowDown"),
      done: async () => true,
    },
    /** The row's action: a press on its body, or Enter on it. */
    act: {
      pointer: (env: E, name: string) => row(env, name).click(),
      keyboard: async (env: E, name: string) => {
        await row(env, name).focus()
        await env.keyboard("Enter")
      },
      done: async () => true,
    },
    /** Checks the row's selection checkbox (it always toggles its row). */
    check: {
      pointer: async (env: E, name: string) => (await checkbox(env, name))?.click(),
      keyboard: async (env: E, name: string) => {
        await (await checkbox(env, name))?.focus()
        await env.keyboard("Space")
      },
      done: async (env: E, name: string) => (await row(env, name).attr("aria-selected")) === "true",
    },
    /** Focuses a control: Arrow (arrow mode) from the row, or the control directly. */
    focusControl: {
      pointer: async (env: E, name: string, controlName: string) =>
        (await control(env, name, controlName)).focus(),
      // Arrow mode: from the row, ArrowRight until the control has focus; tab mode: focus it.
      keyboard: async (env: E, name: string, controlName: string) => {
        const target = await control(env, name, controlName)
        if ((await env.part("list").attr("data-child-navigation")) === "tab") return target.focus()
        await row(env, name).focus()
        const n = (await controlsIn(row(env, name))).length + 1
        for (let i = 0; i < n && !(await target.isFocused()); i++) await env.keyboard("ArrowRight")
      },
      done: async (env: E, name: string, controlName: string) =>
        (await control(env, name, controlName)).isFocused(),
    },
    /**
     * Presses a control; its row's selection and action are untouched (the row's
     * `aria-selected` and `data-action-count`, read before the press, are unchanged).
     */
    pressControl: {
      pointer: async (env: E, name: string, controlName: string) => {
        await remember(env, name)
        await (await control(env, name, controlName)).click()
      },
      keyboard: async (env: E, name: string, controlName: string) => {
        await remember(env, name)
        await (await control(env, name, controlName)).focus()
        await env.keyboard("Enter")
      },
      done: async (env: E, name: string) => {
        const now = await rowState(env, name)
        return now.selected === before.selected && now.acted === before.acted
      },
    },
    /** Space on the focused row: toggles it (every behaviour; never the action). */
    space: {
      keyboard: (env: E) => env.keyboard("Space"),
      done: async () => true,
    },
    /** Enter on the focused row: the action (a link: followed). */
    enter: {
      keyboard: (env: E) => env.keyboard("Enter"),
      done: async () => true,
    },
    /** A pointer press on the highlighted row. */
    pressRow: {
      pointer: (env: E, name: string) => row(env, name).click(),
      none: { keyboard: "a row press is a pointer gesture; Enter is the action step" },
      done: async () => true,
    },
    /** ArrowRight on the focused row: into its first control (arrow mode). */
    arrowIn: {
      keyboard: (env: E) => env.keyboard("ArrowRight"),
      done: async () => true,
    },
  },
  states: { idle: { hasFocus: false }, focused: { hasFocus: true } },
  events: {
    FOCUS: "focusIn",
    "COMPOSITE.BLUR": "tabOut",
    NAVIGATE: { action: "next", event: () => ({ move: "next" }) },
    HIGHLIGHT: { skip: "sent by row focus and presses; covered by the driver tests" },
    POINTER_MOVE: { skip: "rows do not highlight on hover" },
    TYPEAHEAD: { skip: "typeahead over rows: scenario tests" },
    SELECT: {
      from: {
        idle: { skip: "a selection gesture needs focus on a row: taken from focused" },
        focused: {
          action: "space",
          event: (view) => ({
            key: highlightedKey(view),
            modality: "keyboard",
            shift: false,
            mod: true,
          }),
        },
      },
    },
    SELECT_ALL: {
      from: {
        idle: { skip: "from outside the list: the select-all checkbox (its own DOM tests)" },
        focused: "selectAll",
      },
    },
    CLEAR_SELECTION: { skip: "programmatic only" },
    DESELECT: { skip: "programmatic only" },
    ACTION: {
      from: {
        idle: { skip: "Enter needs focus on a row: taken from focused" },
        focused: {
          action: "enter",
          event: (view) => ({ key: highlightedKey(view), modality: "keyboard", via: "enter" }),
        },
      },
    },
    PRESS_ROW: {
      from: {
        idle: { skip: "a press focuses the list first: taken from focused" },
        focused: {
          action: "pressRow",
          args: (view) => [highlightedName(view)],
          event: (view) => ({
            key: highlightedKey(view),
            modality: "pointer",
            shift: false,
            mod: false,
          }),
        },
      },
    },
    FOCUS_CHILD: { skip: "mirrors DOM focus; covered by focusControl" },
    NAVIGATE_CHILD: {
      from: {
        idle: { skip: "arrows need focus on a row: taken from focused" },
        // `count`: the highlighted row's controls; a model class with controls sets it.
        focused: { action: "arrowIn", event: () => ({ direction: "next", count: 0 }) },
      },
    },
    NAVIGATE_SPATIAL: { skip: "measured layout: browser tests" },
    "COLLECTION.CHANGE": { skip: "sent by the $props:collection edge (a prop step)" },
    "$props:collection": { skip: "the consumer's data: scenario tests" },
    // A parent clearing a controlled selection (a model class with `rerender` runs it).
    "$sync:value": { props: () => ({ value: null }) },
    EXPAND: { skip: "rows are flat" },
    COLLAPSE: { skip: "rows are flat" },
  },
  traits: ["composite-roving"],
  invariants: [rowChildren],
  commitsOnFocus: [
    { part: "item", state: "idle" },
    { part: "item", state: "focused" },
    { part: "list", state: "idle" },
    { part: "list", state: "focused" },
    { part: "item-control", state: "idle" },
    { part: "item-control", state: "focused" },
    { part: "item-checkbox", state: "idle" },
    { part: "item-checkbox", state: "focused" },
  ],
})
