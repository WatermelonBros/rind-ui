// The Tree View contract (design §4): items located by accessible name or by a name path
// (names repeat across folders), keyboard actions that reveal hidden nodes first, and the
// own per-item expansion invariant (branches only, mirroring the expansion state) instead
// of the disclosure trait.

import { toKey } from "../../collection/key"
import { contract, type Invariant, type Trait } from "../../contract/contract"
import type { Env, Key, Part } from "../../contract/env"
import type { TreeViewProps } from "./tree-view.machine"
import { treeViewMachine } from "./tree-view.machine"

type P =
  | "root"
  | "label"
  | "tree"
  | "item"
  | "item-indicator"
  | "item-checkbox"
  | "item-text"
  | "loading"
  | "empty"
type E = Env<P>

/** An item: its accessible name, or the names from a root to it. */
export type TreeItemRef = string | readonly string[]

interface Row {
  readonly part: Part
  readonly id: string
  readonly name: string
  readonly level: number
  readonly expanded: string | null
}

async function rows(env: E): Promise<Row[]> {
  const out: Row[] = []
  for (const part of await env.part("item").all()) {
    out.push({
      part,
      id: (await part.attr("id")) ?? "",
      name: await part.accessibleName(),
      level: Number((await part.attr("aria-level")) ?? 1),
      expanded: await part.attr("aria-expanded"),
    })
  }
  return out
}

const pathOf = (item: TreeItemRef): readonly string[] => (typeof item === "string" ? [item] : item)

/** The visible row a name path leads to (a name alone: the first row with that name). */
function locate(list: readonly Row[], item: TreeItemRef): Row | undefined {
  if (typeof item === "string") return list.find((r) => r.name === item)
  let from = 0
  let found: Row | undefined
  for (const [depth, name] of item.entries()) {
    found = undefined
    for (let i = from; i < list.length; i++) {
      const row = list[i]
      if (!row) continue
      // Left the parent's subtree.
      if (depth > 0 && row.level <= depth) break
      if (row.level === depth + 1 && row.name === name) {
        found = row
        from = i + 1
        break
      }
    }
    if (!found) return undefined
  }
  return found
}

const highlightedId = async (env: E) => {
  for (const part of await env.part("item").all()) {
    if ((await part.attr("data-highlighted")) !== null) return (await part.attr("id")) ?? null
  }
  return null
}

const focusInside = async (env: E) => {
  if (await env.part("tree").isFocused()) return true
  for (const p of await env.part("item").all()) if (await p.isFocused()) return true
  return false
}

/** Like Tab into the tree: the roving stop (tabindex 0), else the tree. */
const focusIn = async (env: E) => {
  if (await focusInside(env)) return
  for (const item of await env.part("item").all()) {
    if ((await item.attr("tabindex")) === "0") return item.focus()
  }
  return env.part("tree").focus()
}

/** Highlights the visible row with the keyboard: focus in, Home, then ArrowDown. */
async function arrowTo(env: E, row: Row) {
  await focusIn(env)
  if ((await highlightedId(env)) === row.id) return
  await env.keyboard("Home")
  const count = await env.part("item").count()
  for (let i = 0; i < count && (await highlightedId(env)) !== row.id; i++) {
    await env.keyboard("ArrowDown")
  }
}

/** Expands every collapsed ancestor of the path with ArrowRight, then returns its row. */
async function reveal(env: E, item: TreeItemRef): Promise<Row | undefined> {
  const path = pathOf(item)
  for (let depth = 1; depth < path.length; depth++) {
    const ancestor = locate(await rows(env), path.slice(0, depth))
    if (!ancestor) return undefined
    if (ancestor.expanded === "false") {
      await arrowTo(env, ancestor)
      await env.keyboard("ArrowRight")
    }
  }
  return locate(await rows(env), item)
}

const rowOf = async (env: E, item: TreeItemRef) => locate(await rows(env), item)
const isExpanded = async (env: E, item: TreeItemRef) =>
  (await rowOf(env, item))?.expanded === "true"
const names = async (env: E, attr: string, value: string) => {
  const out: string[] = []
  for (const part of await env.part("item").all()) {
    if ((await part.attr(attr)) === value) out.push(await part.accessibleName())
  }
  return out
}

const keyboardOn = (key: Key | "*") => async (env: E, item: TreeItemRef) => {
  const row = await reveal(env, item)
  if (!row) return
  await arrowTo(env, row)
  // `*` is a character, typed into the focused row.
  if (key === "*") await env.focused().type("*")
  else await env.keyboard(key)
}

/** The traits of a props class (spec "Tree View Contract"); runs swap them in. */
export function treeViewTraits(
  props: Pick<TreeViewProps, "selectionMode" | "checkable">,
): readonly Trait[] {
  return [
    "composite-roving",
    "set-metadata",
    ...(props.checkable || props.selectionMode === "none" ? [] : (["selectable"] as const)),
  ]
}

/** Branches carry aria-expanded, mirroring the expansion; leaves never carry it. */
const expansionMirrors: Invariant<P, "idle" | "focused"> = {
  name: "tree-view-expansion",
  check: async ({ env, values }) => {
    const expanded = new Set(
      ((values["expandedValue"] as readonly string[] | undefined) ?? []).map(toKey),
    )
    for (const part of await env.part("item").all()) {
      const key = (await part.attr("data-key")) ?? ""
      const attr = await part.attr("aria-expanded")
      const branch = (await part.attr("data-branch")) !== null
      const name = await part.accessibleName()
      if (!branch && attr !== null) return `leaf "${name}" carries aria-expanded="${attr}"`
      if (branch && attr === null) return `branch "${name}" has no aria-expanded`
      if (branch && (attr === "true") !== expanded.has(toKey(key))) {
        return `branch "${name}" aria-expanded="${attr}" disagrees with the expansion`
      }
    }
    return undefined
  },
}

/** aria-level is the node's depth + 1 (the visible Tab stop is the composite-roving trait). */
const levelIsDepth: Invariant<P, "idle" | "focused"> = {
  name: "tree-view-level",
  check: async ({ env }) => {
    for (const part of await env.part("item").all()) {
      const level = await part.attr("aria-level")
      if (level === null || level !== (await part.attr("data-level"))) {
        return `item "${await part.accessibleName()}" aria-level="${level}" is not its depth + 1`
      }
    }
    return undefined
  },
}

export const treeViewContract = contract("tree-view", {
  machine: treeViewMachine,
  anatomy: [
    "root",
    "label",
    "tree",
    "item",
    "item-indicator",
    "item-checkbox",
    "item-text",
    "loading",
    "empty",
  ],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "tree", name }),
  queries: {
    /** The visible items in order, with their level and state. */
    items: async (env: E) => {
      const out: {
        name: string
        level: number
        expanded: boolean | null
        selected: boolean
        checked: string | null
      }[] = []
      for (const part of await env.part("item").all()) {
        const expanded = await part.attr("aria-expanded")
        out.push({
          name: await part.accessibleName(),
          level: Number((await part.attr("aria-level")) ?? 1),
          expanded: expanded === null ? null : expanded === "true",
          selected: (await part.attr("aria-selected")) === "true",
          checked: await part.attr("aria-checked"),
        })
      }
      return out
    },
    isExpanded,
    /** Names of the expanded visible branches, in order. */
    expandedNames: (env: E) => names(env, "aria-expanded", "true"),
    isBusy: async (env: E, item: TreeItemRef) =>
      (await (await rowOf(env, item))?.part.attr("aria-busy")) === "true",
    isEmpty: async (env: E) => (await env.part("tree").attr("data-empty")) !== null,
    /** The highlighted item's name, or null. */
    highlighted: async (env: E) => {
      for (const part of await env.part("item").all()) {
        if ((await part.attr("data-highlighted")) !== null) return part.accessibleName()
      }
      return null
    },
    selected: (env: E) => names(env, "aria-selected", "true"),
    checked: (env: E) => names(env, "aria-checked", "true"),
    hasFocus: focusInside,
  },
  actions: {
    expand: {
      keyboard: async (env: E, item: TreeItemRef) => {
        const row = await reveal(env, item)
        if (row === undefined) return
        if (row.expanded !== "false") return
        await arrowTo(env, row)
        await env.keyboard("ArrowRight")
      },
      done: async (env: E, item: TreeItemRef) => isExpanded(env, item),
    },
    collapse: {
      keyboard: async (env: E, item: TreeItemRef) => {
        const row = await reveal(env, item)
        if (row === undefined) return
        if (row.expanded !== "true") return
        await arrowTo(env, row)
        await env.keyboard("ArrowLeft")
      },
      done: async (env: E, item: TreeItemRef) => !(await isExpanded(env, item)),
    },
    toggle: {
      keyboard: async (env: E, item: TreeItemRef) => {
        const row = await reveal(env, item)
        if (!row || row.expanded === null) return
        await arrowTo(env, row)
        await env.keyboard(row.expanded === "true" ? "ArrowLeft" : "ArrowRight")
      },
      done: async () => true,
    },
    /** Space on the item (a checkable tree checks, a selectable one selects). */
    check: {
      keyboard: keyboardOn("Space"),
      done: async () => true,
    },
    expandSiblings: {
      keyboard: keyboardOn("*"),
      done: async () => true,
    },
    /** The activation: a press, or Enter on the highlighted row. */
    act: {
      pointer: async (env: E, item: TreeItemRef) => {
        const row = await reveal(env, item)
        await row?.part.click()
      },
      keyboard: keyboardOn("Enter"),
      done: async () => true,
    },
    /** Expands every visible collapsed branch until none is left. */
    expandAll: {
      keyboard: async (env: E) => {
        let last: string | null = null
        for (;;) {
          const row = (await rows(env)).find((r) => r.expanded === "false")
          // None left, or one that does not expand (a disabled branch): stop.
          if (!row || row.id === last) return
          last = row.id
          await arrowTo(env, row)
          await env.keyboard("ArrowRight")
        }
      },
      done: async (env: E) => (await rows(env)).every((r) => r.expanded !== "false"),
    },
    focusIn: { keyboard: focusIn, done: { hasFocus: true } },
    /** Tab moves focus past the tree (the fixture page has a button after it). */
    tabOut: { keyboard: (env: E) => env.keyboard("Tab"), done: { hasFocus: false } },
    next: { keyboard: (env: E) => env.keyboard("ArrowDown"), done: async () => true },
    typeS: { keyboard: (env: E) => env.focused().type("s"), done: async () => true },
    space: { keyboard: (env: E) => env.keyboard("Space"), done: async () => true },
    enter: { keyboard: (env: E) => env.keyboard("Enter"), done: async () => true },
    star: { keyboard: (env: E) => env.focused().type("*"), done: async () => true },
    selectAll: {
      keyboard: async (env: E) => {
        await focusIn(env)
        await env.keyboard("A", { mod: true })
      },
      done: async () => true,
    },
    /** Alt+arrow on the row (add-tree-view-dnd): "up", "down", "in" or "out". */
    moveNode: {
      keyboard: async (env: E, item: TreeItemRef, direction: "up" | "down" | "in" | "out") => {
        const row = await reveal(env, item)
        if (row === undefined) return
        await arrowTo(env, row)
        const key = {
          up: "ArrowUp",
          down: "ArrowDown",
          in: "ArrowRight",
          out: "ArrowLeft",
        } as const
        await env.keyboard(key[direction], { alt: true })
      },
      done: async () => true,
    },
    /** A pointer drag of `item` onto `over`'s zone (before, inside or after). */
    dragNode: {
      pointer: async (
        env: E,
        item: TreeItemRef,
        over: TreeItemRef,
        zone: "before" | "inside" | "after",
      ) => {
        const from = await reveal(env, item)
        const to = await reveal(env, over)
        const a = await from?.part.box()
        const b = await to?.part.box()
        if (!from || !a || !b) return
        const y = b.y + b.height * (zone === "before" ? 0.12 : zone === "inside" ? 0.5 : 0.88)
        await from.part.drag({ x: 0, y: y - (a.y + a.height / 2) })
      },
      none: { keyboard: "Alt with the arrows is `moveNode`" },
      done: async () => true,
    },
  },
  states: { idle: { hasFocus: false }, focused: { hasFocus: true } },
  events: {
    FOCUS: "focusIn",
    "COMPOSITE.BLUR": "tabOut",
    NAVIGATE: { action: "next", event: () => ({ move: "next" }) },
    HIGHLIGHT: { skip: "sent by item focus and clicks; covered by the driver tests" },
    POINTER_MOVE: { skip: "a tree does not highlight on hover" },
    TYPEAHEAD: {
      action: "typeS",
      event: () => ({
        char: "s",
        composing: false,
        modifiers: { ctrl: false, meta: false, alt: false },
      }),
    },
    SELECT: {
      action: "space",
      event: (view) => ({
        key: (view.context as { highlightedKey: string | null }).highlightedKey ?? toKey(""),
        modality: "keyboard",
        shift: false,
        mod: false,
      }),
    },
    ACTION: {
      action: "enter",
      event: (view) => ({
        key: (view.context as { highlightedKey: string | null }).highlightedKey ?? toKey(""),
        modality: "keyboard",
      }),
    },
    EXPAND_SIBLINGS: {
      action: "star",
      event: (view) => ({
        key: (view.context as { highlightedKey: string | null }).highlightedKey ?? toKey(""),
      }),
    },
    SELECT_ALL: "selectAll",
    PRESS: { skip: "a press (and its modality rules) is covered by the scenario tests and act()" },
    INDICATOR: { skip: "a press on the indicator: scenario tests" },
    CHECK: { skip: "a press on the item checkbox (Space checks through SELECT): scenario tests" },
    CLEAR_SELECTION: { skip: "programmatic only" },
    DESELECT: { skip: "programmatic only" },
    EXPAND: { skip: "programmatic (the driver expands with ArrowRight: NAVIGATE)" },
    COLLAPSE: { skip: "programmatic (the driver collapses with ArrowLeft: NAVIGATE)" },
    EXPAND_ALL: { skip: "programmatic" },
    COLLAPSE_ALL: { skip: "programmatic" },
    "CHILDREN.SETTLED": { skip: "the lazy loader settles: scenario tests" },
    "TREE.CHANGE": { skip: "a new tree prop: scenario tests" },
    "MOVE.KEY": { skip: "moving needs `movable`: the move DOM tests" },
    "DRAG.START": { skip: "a pointer drag: the move DOM tests" },
    "DRAG.OVER": { skip: "a pointer drag: the move DOM tests" },
    "DRAG.END": { skip: "a pointer drag: the move DOM tests" },
    "DRAG.CANCEL": { skip: "a pointer drag: the move DOM tests" },
    "COLLECTION.CHANGE": { skip: "a controlled expandedValue: scenario tests" },
    "$props:tree": { skip: "a new tree prop (lazy children arriving): scenario tests" },
    "$props:expandedValue": { skip: "a controlled expandedValue: scenario tests" },
  },
  traits: ["composite-roving", "set-metadata", "selectable"],
  invariants: [expansionMirrors, levelIsDepth],
  // Roving: the highlight follows DOM focus, and focus entering the tree enters it.
  commitsOnFocus: [
    { part: "item", state: "idle" },
    { part: "item", state: "focused" },
    { part: "tree", state: "idle" },
    { part: "tree", state: "focused" },
  ],
})
