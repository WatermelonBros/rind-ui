// Tree View (design §1): the collection pieces over the visible nodes of a tree, plus
// expansion, activation, tri-state checking and lazy children. The visible collection is
// derived here from the tree and the expanded keys (memoised), so the machine needs no DOM
// and no adapter to compute it. Two states: only "focus is inside" changes behaviour.

import type { Modality } from "../../a11y/events"
import { tabStop } from "../../collection/composite"
import { type CollectionKey, toKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import {
  type CollectionArgs,
  type CollectionContext,
  type CollectionEnv,
  type CollectionEvent,
  type CollectionProps,
  collectionPieces,
  initialCollectionContext,
} from "../../collection/machine"
import { type SelectionValue, selectedKeys, select as selectKeys } from "../../collection/selection"
import type { TreeCollection } from "../../collection/tree"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { type CheckPropagation, toggle } from "./check"
import { type TreeViewMessages, treeViewMessages } from "./tree-view.messages"

/** The selection: one key or null (single), keys (multiple). Never a select-all sentinel. */
export type TreeViewValue = string | null | readonly string[]

export type TreeViewActionVia = "enter" | "press"

export interface TreeViewActionDetails {
  readonly modality: Modality
  readonly via: TreeViewActionVia
}

export type TreeViewEvent =
  | CollectionEvent
  | { readonly type: "FOCUS"; readonly modality?: Modality }
  | { readonly type: "EXPAND_SIBLINGS"; readonly key: CollectionKey }
  | { readonly type: "EXPAND_ALL" }
  | { readonly type: "COLLAPSE_ALL" }
  /** Space in a checkable tree, a press on the item checkbox, or the api. */
  | { readonly type: "CHECK"; readonly key: CollectionKey }
  /** Enter on an item that is not a link. */
  | { readonly type: "ACTION"; readonly key: CollectionKey; readonly modality: Modality }
  /** A press on an item (a link item's press is its native activation). */
  | {
      readonly type: "PRESS"
      readonly key: CollectionKey
      readonly modality: Modality
      readonly shift: boolean
      readonly mod: boolean
      readonly link: boolean
    }
  /** A press on the expand indicator: toggles, nothing else. */
  | { readonly type: "INDICATOR"; readonly key: CollectionKey }
  | { readonly type: "CHILDREN.SETTLED"; readonly key: CollectionKey; readonly ok: boolean }
  | { readonly type: "TREE.CHANGE" }

export interface LoadChildrenOptions {
  /** Aborted when the branch collapses or the tree unmounts while loading. */
  readonly signal: AbortSignal
}

export interface TreeViewProps
  extends Omit<CollectionProps, "collection" | "strategy" | "loading" | "onLoadMore"> {
  /** The whole tree; the visible nodes are derived from it and the expanded keys. */
  readonly tree: TreeCollection<unknown>
  readonly value?: TreeViewValue | undefined
  readonly defaultValue?: TreeViewValue | undefined
  readonly onValueChange?:
    | ((value: TreeViewValue, details: ChangeDetails<TreeViewEvent>) => void)
    | undefined
  readonly expandedValue?: readonly string[] | undefined
  readonly defaultExpandedValue?: readonly string[] | undefined
  readonly onExpandedValueChange?:
    | ((value: readonly string[], details: ChangeDetails<TreeViewEvent>) => void)
    | undefined
  readonly checkedValue?: readonly string[] | undefined
  readonly defaultCheckedValue?: readonly string[] | undefined
  readonly onCheckedValueChange?:
    | ((value: readonly string[], details: ChangeDetails<TreeViewEvent>) => void)
    | undefined
  /** Items carry `aria-checked`; selection is off. */
  readonly checkable?: boolean | undefined
  /** Default `both`: a branch is derived from its leaves. */
  readonly checkPropagation?: CheckPropagation | undefined
  /** A press on a branch toggles it (default true). */
  readonly expandOnClick?: boolean | undefined
  readonly onAction?: ((key: string, details: TreeViewActionDetails) => void) | undefined
  /** Called once per unloaded branch when it is first expanded. */
  readonly onLoadChildren?:
    | ((key: string, options: LoadChildrenOptions) => Promise<unknown> | undefined)
    | undefined
  readonly disabled?: boolean | undefined
  readonly messages?: TreeViewMessages | undefined
}

export interface TreeViewContext extends CollectionContext {
  /** Branches whose children are loading. */
  readonly loading: ReadonlySet<CollectionKey>
  /** Branches whose last load failed (a later expand retries). */
  readonly failed: ReadonlySet<CollectionKey>
  /** Branches whose load settled: never requested again. */
  readonly loaded: ReadonlySet<CollectionKey>
  readonly controllers: ReadonlyMap<CollectionKey, AbortController>
}

// ---------------------------------------------------------------------------------------
// Value shapes

/** The value as a selection. */
export function treeSelectionOf(value: TreeViewValue | undefined): SelectionValue {
  if (value === null || value === undefined) return new Set()
  return new Set((typeof value === "string" ? [value] : value).map(toKey))
}

/** Keys as a set (expanded, checked). */
export const keySetOf = (keys: readonly string[] | undefined): ReadonlySet<CollectionKey> =>
  new Set((keys ?? []).map(toKey))

/** Keys in tree order (unknown keys last, in their given order). */
const inTreeOrder = (tree: TreeCollection<unknown>, keys: Iterable<CollectionKey>) => {
  const order = (k: CollectionKey) => tree.get(k)?.index ?? Number.MAX_SAFE_INTEGER
  return [...keys].sort((a, b) => order(a) - order(b))
}

/** Set equality: a parent passing a new array with the same keys is not a change. */
export function sameKeys(a: TreeViewValue | undefined, b: TreeViewValue | undefined): boolean {
  if (a === b) return true
  const x = treeSelectionOf(a)
  const y = treeSelectionOf(b)
  return x !== "all" && y !== "all" && x.size === y.size && [...x].every((k) => y.has(k))
}

const visibleMemo = new WeakMap<object, { sig: string; c: Collection<unknown> }>()
/** The nodes not hidden by a collapsed ancestor, one collection per (tree, expanded keys). */
export function visibleOf(
  tree: TreeCollection<unknown>,
  expanded: readonly string[] | undefined,
): Collection<unknown> {
  const keys = [...(expanded ?? [])].sort()
  const sig = keys.join("\u0000")
  const hit = visibleMemo.get(tree)
  if (hit && hit.sig === sig) return hit.c
  const c = tree.visible(keySetOf(keys))
  visibleMemo.set(tree, { sig, c })
  return c
}

const mode = (p: TreeViewProps) => (p.checkable ? "none" : (p.selectionMode ?? "single"))

// ---------------------------------------------------------------------------------------
// The collection pieces, bound to the tree's value shapes

type TreeArgsProps = CollectionProps & TreeViewProps

const pieces = collectionPieces({
  selection: {
    read: (values) => treeSelectionOf(values["value"] as TreeViewValue | undefined),
    // Keys in tree order; select-all (the visible selectable items) as an explicit list.
    write: (s, collection, props) => {
      const p = props as TreeArgsProps
      const keys = inTreeOrder(p.tree, s === "all" ? selectedKeys(collection, "all") : s)
      return mode(p) === "multiple" ? keys : (keys[0] ?? null)
    },
  },
  expansion: {
    read: (values) => keySetOf(values["expandedValue"] as readonly string[] | undefined),
    write: (expanded) => [...expanded],
    key: "expandedValue",
    tree: (props) => (props as TreeArgsProps).tree,
  },
})

const adapted = new WeakMap<object, { expanded: unknown; out: TreeArgsProps }>()
/** The props the collection pieces read: the visible collection, roving, no loop default. */
function adapt(props: TreeViewProps, expanded: readonly string[] | undefined): TreeArgsProps {
  const hit = adapted.get(props)
  if (hit && hit.expanded === expanded) return hit.out
  const out: TreeArgsProps = {
    ...props,
    collection: visibleOf(props.tree, expanded),
    strategy: "roving",
    selectionMode: mode(props),
    loop: props.loop === true,
  }
  adapted.set(props, { expanded, out })
  return out
}

interface MachineArgs {
  readonly props: TreeViewProps
  readonly values: { readonly expandedValue?: readonly string[] | undefined }
}
/** The same args with the derived props; context and values stay live (getters). */
const args = (a: MachineArgs): CollectionArgs =>
  // Sound: the runtime's args carry every CollectionArgs field; only props are derived.
  Object.create(a, {
    props: { get: () => adapt(a.props, a.values.expandedValue), enumerable: true },
  }) as CollectionArgs

// ---------------------------------------------------------------------------------------

const messagesOf = (p: TreeViewProps) => p.messages ?? treeViewMessages
const isBranch = (tree: TreeCollection<unknown>, key: CollectionKey) =>
  tree.get(key)?.hasChildren === true
const nameOf = (tree: TreeCollection<unknown>, key: CollectionKey) =>
  tree.get(key)?.textValue ?? key
/** The user may act on the item: present, not disabled (the item or the whole tree). */
const actionable = (p: TreeViewProps, key: CollectionKey) => {
  const node = p.tree.get(key)
  return node !== undefined && !node.disabled && p.disabled !== true
}

interface WriteArgs {
  readonly props: TreeViewProps
  readonly context: TreeViewContext
  readonly values: {
    readonly expandedValue?: readonly string[] | undefined
    readonly checkedValue?: readonly string[] | undefined
  }
  readonly env: CollectionEnv
  set(key: string, value: unknown): void
  send(event: TreeViewEvent): void
}

const expandedOf = (a: { values: { expandedValue?: readonly string[] | undefined } }) =>
  keySetOf(a.values.expandedValue)

function writeExpanded(a: WriteArgs, next: ReadonlySet<CollectionKey>) {
  a.set("expandedValue", inTreeOrder(a.props.tree, next))
}

function announce(a: WriteArgs, message: string, priority: "polite" | "assertive" = "polite") {
  a.env.announcer.announce({ message, priority, lang: a.env.locale.locale() })
}

/** Starts loading `key`: once until it settles or is aborted. */
function startLoad(a: WriteArgs, key: CollectionKey) {
  const load = a.props.onLoadChildren
  if (!load || a.context.loading.has(key)) return
  const controller = new AbortController()
  const loading = new Set(a.context.loading)
  loading.add(key)
  const failed = new Set(a.context.failed)
  failed.delete(key)
  a.set("loading", loading)
  a.set("failed", failed)
  a.set("controllers", new Map(a.context.controllers).set(key, controller))
  announce(a, messagesOf(a.props).loadingAnnouncement(nameOf(a.props.tree, key)))
  const result = load(key, { signal: controller.signal })
  if (result && typeof (result as Promise<unknown>).then === "function") {
    ;(result as Promise<unknown>).then(
      () => {
        if (!controller.signal.aborted) a.send({ type: "CHILDREN.SETTLED", key, ok: true })
      },
      () => {
        if (!controller.signal.aborted) a.send({ type: "CHILDREN.SETTLED", key, ok: false })
      },
    )
  }
}

/** Ends a load: `ok` marks it loaded and announces the children, else marks it failed. */
function endLoad(a: WriteArgs, key: CollectionKey, ok: boolean) {
  if (!a.context.loading.has(key)) return
  const loading = new Set(a.context.loading)
  loading.delete(key)
  const controllers = new Map(a.context.controllers)
  controllers.delete(key)
  a.set("loading", loading)
  a.set("controllers", controllers)
  const name = nameOf(a.props.tree, key)
  const m = messagesOf(a.props)
  if (ok) {
    a.set("loaded", new Set(a.context.loaded).add(key))
    announce(a, m.loadedAnnouncement(name, a.props.tree.children(key).length))
  } else {
    a.set("failed", new Set(a.context.failed).add(key))
    announce(a, m.loadFailedAnnouncement(name), "assertive")
  }
}

/**
 * After the expanded keys changed: loads collapsed while pending are aborted, and every
 * expanded branch with no loaded children (never loaded, not failed) starts loading.
 */
function syncLoads(a: WriteArgs) {
  const expanded = expandedOf(a)
  const { tree } = a.props
  for (const key of a.context.loading) {
    if (expanded.has(key)) continue
    a.context.controllers.get(key)?.abort()
    const loading = new Set(a.context.loading)
    loading.delete(key)
    const controllers = new Map(a.context.controllers)
    controllers.delete(key)
    a.set("loading", loading)
    a.set("controllers", controllers)
  }
  for (const key of expanded) {
    if (!isBranch(tree, key) || tree.children(key).length > 0) continue
    if (a.context.loaded.has(key) || a.context.failed.has(key)) continue
    startLoad(a, key)
  }
}

function toggleExpansion(a: WriteArgs, key: CollectionKey) {
  if (!isBranch(a.props.tree, key)) return
  const expanded = new Set(expandedOf(a))
  if (expanded.has(key)) expanded.delete(key)
  else expanded.add(key)
  writeExpanded(a, expanded)
}

/** A failed branch asked to expand again: retried. */
function retryIfFailed(a: WriteArgs, key: CollectionKey | null) {
  if (key !== null && a.context.failed.has(key) && expandedOf(a).has(key)) startLoad(a, key)
}

function checkKey(a: WriteArgs, key: CollectionKey) {
  if (!actionable(a.props, key)) return
  const checked = keySetOf(a.values.checkedValue)
  const next = toggle(a.props.tree, checked, key, a.props.checkPropagation ?? "both")
  if (next !== checked) a.set("checkedValue", inTreeOrder(a.props.tree, next))
}

// ---------------------------------------------------------------------------------------

/** null as the runtime's fallback: no selection (a controlled null is a value). */
const EMPTY = null as unknown as string

export const treeViewMachine = setup({
  types: type<{
    props: TreeViewProps
    events: TreeViewEvent
    env: CollectionEnv
    context: TreeViewContext
    values: "value" | "expandedValue" | "checkedValue"
  }>(),
  actions: {
    /** Entering the tree: the last highlight, else the first selected visible row, else the first. */
    highlightInitial: (a) => {
      const p = adapt(a.props, a.values.expandedValue)
      const h = a.context.highlightedKey
      if (h !== null && p.collection.has(h)) return
      const key = tabStop({
        collection: p.collection,
        highlightedKey: null,
        highlightSource: null,
        selection: treeSelectionOf(a.values.value),
        selectionMode: mode(a.props),
        focusableWhenDisabled: a.props.focusableWhenDisabled,
        tree: a.props.tree,
        expanded: expandedOf(a),
      })
      a.set("highlightedKey", key)
      const m = a.event.type === "FOCUS" ? a.event.modality : undefined
      const keyboard = m !== undefined && m !== "pointer" && m !== "touch"
      a.set("highlightSource", keyboard ? "keyboard" : "programmatic")
      a.set("scrollReason", null)
    },
    navigate: (a) => {
      const e = a.event
      if (e.type !== "NAVIGATE") return
      const h = a.context.highlightedKey
      if ((e.move === "expand" || e.move === "collapse") && h !== null) {
        // A disabled row is navigable (focusableWhenDisabled) but never expands or collapses.
        const open = expandedOf(a).has(h)
        const toggles = isBranch(a.props.tree, h) && (e.move === "expand" ? !open : open)
        if (toggles && !actionable(a.props, h)) return
        if (e.move === "expand") retryIfFailed(a, h)
      }
      pieces.actions.navigate(args(a))
    },
    highlight: (a) => pieces.actions.highlight(args(a)),
    pointerMove: (a) => pieces.actions.pointerMove(args(a)),
    typeahead: (a) => pieces.actions.typeahead(args(a)),
    resetTypeahead: (a) => pieces.actions.resetTypeahead(args(a)),
    repairCollection: (a) => pieces.actions.repairCollection(args(a)),
    scrollToHighlighted: (a) => pieces.actions.scrollToHighlighted(args(a)),
    focusHighlighted: (a) => pieces.actions.focusHighlighted(args(a)),
    keepFocusInside: (a) => pieces.actions.keepFocusInside(args(a)),
    select: (a) => pieces.actions.select(args(a)),
    selectAll: (a) => pieces.actions.selectAll(args(a)),
    clearSelection: (a) => pieces.actions.clearSelection(args(a)),
    deselect: (a) => pieces.actions.deselect(args(a)),
    /** Selection follows focus (replace): the new highlight replaces the selection. */
    selectHighlighted: (a) => {
      const key = a.context.highlightedKey
      if (key === null) return
      const shift = a.event.type === "NAVIGATE" && a.event.extend === true
      a.send({ type: "SELECT", key, modality: "keyboard", shift, mod: false })
    },
    expand: (a) => {
      const e = a.event
      if (e.type !== "EXPAND" || !actionable(a.props, e.key)) return
      retryIfFailed(a, e.key)
      pieces.actions.expand(args(a))
    },
    collapse: (a) => {
      const e = a.event
      if (e.type === "COLLAPSE" && actionable(a.props, e.key)) pieces.actions.collapse(args(a))
    },
    expandSiblings: (a) => {
      const e = a.event
      if (e.type !== "EXPAND_SIBLINGS") return
      const { tree } = a.props
      const parent = tree.get(e.key)?.parentKey ?? null
      const expanded = new Set(expandedOf(a))
      for (let i = 0; i < tree.size; i++) {
        const node = tree.at(i)
        if (!node || node.parentKey !== parent || !node.hasChildren) continue
        if (actionable(a.props, node.key)) expanded.add(node.key)
      }
      writeExpanded(a, expanded)
    },
    expandAll: (a) => {
      const { tree } = a.props
      const expanded = new Set(expandedOf(a))
      for (let i = 0; i < tree.size; i++) {
        const node = tree.at(i)
        // Loaded branches only: expanding everything never fires every lazy load at once.
        if (node && tree.children(node.key).length > 0) expanded.add(node.key)
      }
      writeExpanded(a, expanded)
    },
    collapseAll: (a) => writeExpanded(a, new Set()),
    indicator: (a) => {
      const e = a.event
      if (e.type === "INDICATOR" && actionable(a.props, e.key)) toggleExpansion(a, e.key)
    },
    check: (a) => {
      const e = a.event
      if (e.type === "CHECK") checkKey(a, e.key)
      else if (e.type === "SELECT") checkKey(a, e.key)
    },
    /**
     * Enter: `onAction` first, then select (a selectable tree) or, with no action, toggle a
     * branch. A checkable tree never checks on Enter.
     */
    act: (a) => {
      const e = a.event
      if (e.type !== "ACTION" || !actionable(a.props, e.key)) return
      a.props.onAction?.(e.key, { modality: e.modality, via: "enter" })
      if (mode(a.props) !== "none") {
        a.send({ type: "SELECT", key: e.key, modality: "keyboard", shift: false, mod: false })
      } else if (!a.props.onAction) {
        toggleExpansion(a, e.key)
      }
    },
    /**
     * A press: a link is activated natively (only `onAction` here); a selectable tree
     * selects and toggles a branch (without modifiers, with `expandOnClick`); otherwise the
     * action runs and a branch toggles.
     */
    press: (a) => {
      const e = a.event
      if (e.type !== "PRESS" || !actionable(a.props, e.key)) return
      const toggles = a.props.expandOnClick !== false && isBranch(a.props.tree, e.key)
      if (e.link) {
        a.props.onAction?.(e.key, { modality: e.modality, via: "press" })
        return
      }
      if (mode(a.props) !== "none") {
        const p = args(a).props
        const r = selectKeys(
          p.collection,
          treeSelectionOf(a.values.value),
          a.context.anchor,
          { key: e.key, modality: e.modality, shift: e.shift, mod: e.mod },
          {
            mode: mode(a.props),
            behavior: a.props.selectionBehavior ?? "toggle",
            disallowEmpty: a.props.disallowEmptySelection === true,
            disabledBehavior: a.props.disabledBehavior ?? "all",
          },
        )
        a.set("anchor", r.anchor)
        if (r.value !== treeSelectionOf(a.values.value)) {
          const keys = inTreeOrder(a.props.tree, selectedKeys(p.collection, r.value))
          a.set("value", mode(a.props) === "multiple" ? keys : (keys[0] ?? EMPTY))
        }
        if (toggles && !e.shift && !e.mod) toggleExpansion(a, e.key)
        return
      }
      a.props.onAction?.(e.key, { modality: e.modality, via: "press" })
      if (toggles) toggleExpansion(a, e.key)
    },
    settle: (a) => {
      const e = a.event
      if (e.type === "CHILDREN.SETTLED") endLoad(a, e.key, e.ok)
    },
    /** A new tree: branches whose children arrived end their load. */
    settleArrived: (a) => {
      for (const key of a.context.loading) {
        if (a.props.tree.children(key).length > 0) endLoad(a, key, true)
      }
    },
    syncLoads: (a) => syncLoads(a),
  },
  guards: {
    /** Replace: arrows (without mod) select; a screen reader's focus never does. */
    followsFocus: ({ event, props }) =>
      event.type === "NAVIGATE" &&
      (props.selectionBehavior ?? "toggle") === "replace" &&
      mode(props) !== "none" &&
      event.mod !== true &&
      event.extend !== true &&
      event.move !== "expand" &&
      event.move !== "collapse",
    typeaheadSelects: ({ props }) =>
      (props.selectionBehavior ?? "toggle") === "replace" && mode(props) === "single",
    isCheckable: ({ props }) => props.checkable === true,
    noneMode: ({ props }) => mode(props) === "none",
    selectable: ({ event, props }) => event.type === "SELECT" && actionable(props, event.key),
  },
  effects: {
    /** Unmount: every pending load is aborted. */
    loads: (a) => () => {
      for (const c of a.context.controllers.values()) c.abort()
    },
    announcer: ({ props, env }) => (props.onLoadChildren ? env.announcer.prepare() : undefined),
  },
}).machine({
  id: "tree-view",
  initial: "idle",
  context: (props) => ({
    ...initialCollectionContext(),
    lastCollection: visibleOf(props.tree, props.expandedValue ?? props.defaultExpandedValue),
    loading: new Set(),
    failed: new Set(),
    loaded: new Set(),
    controllers: new Map(),
  }),
  values: {
    value: { fallback: EMPTY, equal: sameKeys as never },
    expandedValue: { fallback: [], equal: sameKeys as never },
    checkedValue: { fallback: [], equal: sameKeys as never },
  },
  onProps: { tree: "TREE.CHANGE", expandedValue: "COLLECTION.CHANGE" },
  effects: ["loads", "announcer"],
  computed: {
    /** Keys a virtualizer must keep mounted: the highlighted item. */
    persistedKeys: (view) =>
      view.context.highlightedKey === null ? [] : [view.context.highlightedKey],
  },
  on: {
    "TREE.CHANGE": { actions: ["settleArrived", "repairCollection", "syncLoads"] },
    "COLLECTION.CHANGE": { actions: ["repairCollection", "syncLoads"] },
    "CHILDREN.SETTLED": { actions: ["settle"] },
    EXPAND: { actions: ["expand", "repairCollection", "syncLoads"] },
    COLLAPSE: { actions: ["collapse", "repairCollection", "syncLoads"] },
    EXPAND_ALL: { actions: ["expandAll", "repairCollection", "syncLoads"] },
    COLLAPSE_ALL: { actions: ["collapseAll", "repairCollection", "syncLoads"] },
    INDICATOR: { actions: ["indicator", "repairCollection", "syncLoads"] },
    CHECK: { actions: ["check"] },
  },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focused", actions: ["highlightInitial", "focusHighlighted"] },
        // An item focused by a click or by Tab reports itself before the tree's FOCUS.
        HIGHLIGHT: { actions: ["highlight"] },
      },
    },
    focused: {
      exit: ["resetTypeahead"],
      on: {
        "COMPOSITE.BLUR": "idle",
        "TREE.CHANGE": {
          actions: ["settleArrived", "repairCollection", "syncLoads", "keepFocusInside"],
        },
        "COLLECTION.CHANGE": { actions: ["repairCollection", "syncLoads", "keepFocusInside"] },
        INDICATOR: {
          actions: ["indicator", "repairCollection", "syncLoads", "keepFocusInside"],
        },
        COLLAPSE: { actions: ["collapse", "repairCollection", "syncLoads", "keepFocusInside"] },
        COLLAPSE_ALL: {
          actions: ["collapseAll", "repairCollection", "syncLoads", "keepFocusInside"],
        },
        FOCUS: { actions: ["focusHighlighted"] },
        NAVIGATE: [
          {
            guard: "followsFocus",
            actions: [
              "navigate",
              "repairCollection",
              "syncLoads",
              "scrollToHighlighted",
              "focusHighlighted",
              "selectHighlighted",
            ],
          },
          {
            actions: [
              "navigate",
              "repairCollection",
              "syncLoads",
              "scrollToHighlighted",
              "focusHighlighted",
            ],
          },
        ],
        HIGHLIGHT: { actions: ["highlight", "scrollToHighlighted", "focusHighlighted"] },
        POINTER_MOVE: { actions: ["pointerMove"] },
        TYPEAHEAD: [
          {
            guard: "typeaheadSelects",
            actions: ["typeahead", "scrollToHighlighted", "focusHighlighted", "selectHighlighted"],
          },
          { actions: ["typeahead", "scrollToHighlighted", "focusHighlighted"] },
        ],
        SELECT: [
          { guard: "isCheckable", actions: ["check"] },
          { guard: "noneMode" },
          { guard: "selectable", actions: ["select"] },
        ],
        SELECT_ALL: { actions: ["selectAll"] },
        CLEAR_SELECTION: { actions: ["clearSelection"] },
        DESELECT: { actions: ["deselect"] },
        ACTION: { actions: ["act", "repairCollection", "syncLoads"] },
        PRESS: { actions: ["press", "repairCollection", "syncLoads", "keepFocusInside"] },
        EXPAND_SIBLINGS: { actions: ["expandSiblings", "repairCollection", "syncLoads"] },
      },
    },
  },
})
export type TreeViewMachine = typeof treeViewMachine

/** Why the expanded keys changed, from the event that changed them (design §3). */
export function expansionReason(type: string): "key" | "press" | "api" | "siblings" | "all" {
  switch (type) {
    case "NAVIGATE":
    case "ACTION":
      return "key"
    case "PRESS":
    case "INDICATOR":
      return "press"
    case "EXPAND_SIBLINGS":
      return "siblings"
    case "EXPAND_ALL":
    case "COLLAPSE_ALL":
      return "all"
    default:
      return "api"
  }
}
