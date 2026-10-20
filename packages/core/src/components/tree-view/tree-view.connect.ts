// Tree View parts (design §2): the collection composite in tree mode (roving, set
// metadata, aria-expanded on branches) plus the tree's own attributes, keyboard additions
// (Enter, `*`, the editable-target guard) and the item press (indicator and checkbox
// hit-tests on the item, so focus never leaves the row). Every attribute is here.

import { focusAttrs } from "../../a11y/focus"
import { type CompositeEnv, composite } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import type { CollectionContext } from "../../collection/machine"
import { isSelected, type SelectionValue } from "../../collection/selection"
import type { TreeCollection } from "../../collection/tree"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { itemId, partId } from "../../ids"
import { type CheckPropagation, type CheckState, stateOf } from "./check"
import type { TreeMoveDirection } from "./tree-move"
import type { TreeViewDrag, TreeViewEvent } from "./tree-view.machine"

declare const process: { env: { NODE_ENV?: string } }

const SCOPE = "tree-view"

export const treeViewIds = (instance: string) => ({
  tree: partId(SCOPE, instance, "tree"),
  label: partId(SCOPE, instance, "label"),
  empty: partId(SCOPE, instance, "empty"),
  moveInstructions: partId(SCOPE, instance, "move-instructions"),
  item: (key: CollectionKey) => itemId(SCOPE, instance, "item", key),
  itemText: (key: CollectionKey) => itemId(SCOPE, instance, "item-text", key),
})

export interface TreeViewConnectView {
  readonly instance: string
  readonly tree: TreeCollection<unknown>
  /** The visible nodes (the machine's derived collection). */
  readonly visible: Collection<unknown>
  readonly expanded: ReadonlySet<CollectionKey>
  readonly context: Pick<CollectionContext, "highlightedKey" | "highlightSource"> & {
    readonly loading: ReadonlySet<CollectionKey>
    readonly failed: ReadonlySet<CollectionKey>
  }
  readonly selection: SelectionValue
  readonly selectionMode: "none" | "single" | "multiple"
  readonly checkable: boolean
  readonly checked: ReadonlySet<CollectionKey>
  readonly checkPropagation: CheckPropagation
  readonly disabled: boolean
  readonly focusableWhenDisabled?: boolean | undefined
  readonly typingAhead: () => boolean
  /** Focus is in the tree (its `data-focus` / `data-focus-visible`). */
  readonly focused: boolean
  readonly modality: Modality
  /** The item under the pointer and the item being pressed (from the React part). */
  readonly hovered: CollectionKey | null
  readonly pressed: CollectionKey | null
  readonly mounted: {
    readonly label: boolean
    readonly empty: boolean
    readonly itemText: (key: CollectionKey) => boolean
  }
  readonly send: (event: TreeViewEvent) => void
  /** Moving (add-tree-view-dnd): whether a node may move, and the pointer drag, if any. */
  readonly canMove?: ((key: CollectionKey) => boolean) | undefined
  /** Some node may move: the tree describes the Alt+arrow keys. */
  readonly movable?: boolean | undefined
  readonly drag?: TreeViewDrag | null | undefined
  readonly moveInstructions?: string | undefined
}

const MOVES: Readonly<Record<string, TreeMoveDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowRight: "in",
  ArrowLeft: "out",
}

/** The consumer names the tree itself (the Label then does not). */
export interface TreeNaming {
  readonly "aria-label"?: string | undefined
  readonly "aria-labelledby"?: string | undefined
}

const INDICATOR = '[data-scope="tree-view"][data-part="item-indicator"]'
const CHECKBOX = '[data-scope="tree-view"][data-part="item-checkbox"]'
const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])"

/** The indicator or checkbox the event started in, when it belongs to `item`. */
const hit = (target: unknown, item: Element | null, selector: string) => {
  const el = target as Element | null
  const found = el?.closest?.(selector)
  return found !== null && found !== undefined && found.closest('[role="treeitem"]') === item
}

export function treeViewConnect(v: TreeViewConnectView, env: CompositeEnv) {
  const ids = treeViewIds(v.instance)
  const scoped = (part: string) => scopeAttrs(SCOPE, part, v.instance)
  const inert = v.disabled && v.focusableWhenDisabled !== true
  const parts = composite(
    {
      collection: v.visible,
      highlightedKey: v.context.highlightedKey,
      highlightSource: v.context.highlightSource,
      selection: v.selection,
      selectionMode: v.selectionMode,
      focusableWhenDisabled: v.focusableWhenDisabled,
      disabled: v.disabled,
      typingAhead: v.typingAhead,
      expanded: v.expanded,
      tree: v.tree,
    },
    v.send,
    env,
    {
      scope: SCOPE,
      instance: v.instance,
      ids: { list: ids.tree, item: ids.item },
      strategy: "roving",
      orientation: "vertical",
      listRole: "tree",
      itemRole: "treeitem",
      // Space selects (or checks); Enter is the activation below.
      selectKeys: "space",
      tree: true,
    },
  )
  const empty = v.visible.size === 0
  const checkState = (key: CollectionKey): CheckState =>
    stateOf(v.tree, v.checked, key, v.checkPropagation)
  const branch = (key: CollectionKey) => v.tree.get(key)?.hasChildren === true
  const isOpen = (key: CollectionKey) => branch(key) && v.expanded.has(key)
  const branchState = (key: CollectionKey) =>
    branch(key) ? (isOpen(key) ? "open" : "closed") : undefined

  return {
    ids,
    isEmpty: empty,
    tree: (naming: TreeNaming = {}): PartProps => {
      const own = parts.list()
      const keyDown = own["onKeyDown"] as ((e: unknown) => void) | undefined
      const named = naming["aria-label"] !== undefined || naming["aria-labelledby"] !== undefined
      return {
        ...own,
        ...scoped("tree"),
        // Vertical is the tree default.
        "aria-orientation": undefined,
        "data-orientation": undefined,
        "aria-labelledby": named ? undefined : v.mounted.label ? ids.label : undefined,
        "aria-describedby":
          [empty && v.mounted.empty ? ids.empty : null, v.movable ? ids.moveInstructions : null]
            .filter(Boolean)
            .join(" ") || undefined,
        "data-selection-mode": v.selectionMode,
        "data-checkable": dataFlag(v.checkable),
        ...focusAttrs(v.focused, v.context.highlightSource === "pointer" ? "pointer" : v.modality),
        onFocusIn: (event: unknown) => {
          // An inline editor in an item keeps its focus: the tree does not take it back.
          if (
            (event as FocusEvent).target &&
            ((event as FocusEvent).target as Element).closest?.(EDITABLE)
          ) {
            return
          }
          v.send({ type: "FOCUS", modality: env.modality.modality() })
        },
        // Blank space: never focuses the tree while it has items (react-arborist#233).
        onMouseDown: (event: unknown) => {
          const e = event as MouseEvent
          if (e.target === e.currentTarget && !empty) e.preventDefault()
        },
        onKeyDown: (event: unknown) => {
          const e = event as KeyboardEvent
          // The consumer's handler ran first and cancelled the key.
          if (e.defaultPrevented || inert) return
          // Keys typed in an editable element (an inline rename input) are never the tree's.
          const target = e.target as Element | null
          if (target !== e.currentTarget && target?.getAttribute?.("role") !== "treeitem") return
          if (target?.closest?.(EDITABLE)) return
          const key = v.context.highlightedKey
          // Alt+arrows move the highlighted node (the outliner keys), when it may move.
          const move = MOVES[e.key]
          if (move && e.altKey && !e.ctrlKey && !e.metaKey && key !== null && v.canMove?.(key)) {
            e.preventDefault()
            v.send({ type: "MOVE.KEY", key, direction: move })
            return
          }
          if (e.key === "*" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
            if (key !== null) v.send({ type: "EXPAND_SIBLINGS", key })
            e.preventDefault()
            return
          }
          if (e.key === "Enter" && !e.isComposing && !e.altKey && key !== null) {
            if (e.shiftKey || e.ctrlKey || e.metaKey) return
            // A link item follows its link natively (its click reports the activation).
            if (target?.tagName === "A" && target.hasAttribute("href")) return
            v.send({ type: "ACTION", key, modality: "keyboard" })
            e.preventDefault()
            return
          }
          keyDown?.(event)
        },
      }
    },
    /** The visually hidden Alt+arrow instructions (in the tree's description when movable). */
    moveInstructions: (): PartProps => ({ id: ids.moveInstructions, style: visuallyHiddenStyle }),
    moveInstructionsText: v.moveInstructions ?? "",
    /**
     * The drop line: `top` (px from the tree's top) and `level` of the target, from the React
     * part's measurement; hidden while there is no target.
     */
    dropIndicator: (at: { readonly top: number; readonly level: number } | null): PartProps => {
      const drag = v.drag
      const shown = at !== null && drag?.target !== null && drag?.target !== undefined
      return {
        ...scoped("drop-indicator"),
        "aria-hidden": "true",
        "data-position": shown ? (drag?.zone ?? undefined) : undefined,
        "data-hidden": dataFlag(!shown),
        style: {
          position: "absolute",
          "--rind-tree-drop-top": `${at?.top ?? 0}px`,
          "--rind-tree-drop-level": String(at?.level ?? 1),
          ...(shown ? {} : { display: "none" }),
        },
      }
    },
    label: (): PartProps => ({
      ...scoped("label"),
      id: ids.label,
      "data-disabled": dataFlag(v.disabled),
    }),
    item: (key: CollectionKey): PartProps => {
      const own = parts.item(key)
      const node = v.tree.get(key)
      const level = node ? node.level + 1 : undefined
      const open = isOpen(key)
      const check = v.checkable ? checkState(key) : undefined
      const selected = v.selectionMode !== "none" && isSelected(v.visible, v.selection, key)
      const loading = v.context.loading.has(key)
      return {
        ...own,
        "aria-checked": check,
        "aria-busy": loading ? "true" : undefined,
        "aria-labelledby": v.mounted.itemText(key) ? ids.itemText(key) : undefined,
        "data-level": level === undefined ? undefined : String(level),
        "data-branch": dataFlag(branch(key)),
        "data-state": branchState(key),
        "data-expanded": dataFlag(open),
        "data-selected": dataFlag(selected),
        "data-checked": dataFlag(check === "true"),
        "data-indeterminate": dataFlag(check === "mixed"),
        "data-loading": dataFlag(loading),
        "data-error": dataFlag(v.context.failed.has(key)),
        "data-hover": dataFlag(v.hovered === key),
        "data-pressed": dataFlag(v.pressed === key),
        "data-dragging": dataFlag(v.drag?.key === key),
        "data-drop-target": dataFlag(
          v.drag?.over === key && v.drag.zone === "inside" && v.drag.target !== null,
        ),
        style: level === undefined ? undefined : { "--rind-tree-view-level": String(level) },
        // Only the row's own focus highlights it (an inline editor inside keeps its focus).
        onFocus: (event: unknown) => {
          const e = event as FocusEvent
          if (e.target === e.currentTarget)
            (own["onFocus"] as ((e: unknown) => void) | undefined)?.(event)
        },
        // The indicator and the checkbox keep focus where it is (no focus move on press).
        onMouseDown: (event: unknown) => {
          const e = event as MouseEvent
          const item = e.currentTarget as Element | null
          if (hit(e.target, item, INDICATOR) || hit(e.target, item, CHECKBOX)) e.preventDefault()
        },
        onClick: (event: unknown) => {
          const e = event as MouseEvent
          if (inert || !node) return
          const item = e.currentTarget as Element | null
          if (hit(e.target, item, INDICATOR)) {
            v.send({ type: "INDICATOR", key })
            return
          }
          const modality = env.modality.modality()
          v.send({
            type: "HIGHLIGHT",
            key,
            source: modality === "keyboard" ? "keyboard" : "pointer",
          })
          if (hit(e.target, item, CHECKBOX)) {
            v.send({ type: "CHECK", key })
            return
          }
          v.send({
            type: "PRESS",
            key,
            modality,
            shift: e.shiftKey,
            // platform-convention: the selection modifier is ⌘ on Apple, Control elsewhere
            mod: env.platform.apple ? e.metaKey : e.ctrlKey,
            link: item?.tagName === "A" && item.hasAttribute("href"),
          })
        },
      }
    },
    itemText: (key: CollectionKey): PartProps => ({
      ...scoped("item-text"),
      id: ids.itemText(key),
    }),
    itemIndicator: (key: CollectionKey): PartProps => ({
      ...scoped("item-indicator"),
      "aria-hidden": "true",
      "data-state": branchState(key),
      "data-loading": dataFlag(v.context.loading.has(key)),
      "data-disabled": dataFlag(v.tree.get(key)?.disabled === true || v.disabled),
    }),
    itemCheckbox: (key: CollectionKey): PartProps => {
      const s = checkState(key)
      return {
        ...scoped("item-checkbox"),
        "aria-hidden": "true",
        "data-state": s === "true" ? "checked" : s === "mixed" ? "indeterminate" : "unchecked",
      }
    },
    /** Under a loading branch: presentational (the branch is aria-busy and announced). */
    loading: (): PartProps => ({ ...scoped("loading"), "aria-hidden": "true" }),
    empty: (): PartProps => ({ ...scoped("empty"), id: ids.empty }),
  }
}

export type TreeViewParts = ReturnType<typeof treeViewConnect>

const INTERACTIVE =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true']"

/** Development checks after commit: an unnamed tree, controls inside items, checkable + selection. */
export function checkTreeView(
  tree: Element | null,
  options: { readonly checkable: boolean; readonly selectionMode: string | undefined },
): void {
  if (process.env.NODE_ENV === "production" || !tree) return
  if (!tree.hasAttribute("aria-label") && !tree.hasAttribute("aria-labelledby")) {
    console.warn(
      `[rind-ui] tree-view: the tree "${tree.id}" has no accessible name; render a Label or pass aria-label / aria-labelledby.`,
    )
  }
  for (const item of tree.querySelectorAll('[role="treeitem"]')) {
    const nested = item.querySelector(INTERACTIVE)
    if (nested && !nested.matches(EDITABLE)) {
      console.warn(
        `[rind-ui] tree-view: the item "${item.textContent?.trim() ?? item.id}" contains an interactive <${nested.tagName.toLowerCase()}>; tree items cannot hold controls (use Grid List or Table).`,
      )
    }
  }
  if (
    options.checkable &&
    options.selectionMode !== undefined &&
    options.selectionMode !== "none"
  ) {
    console.error(
      `[rind-ui] tree-view: a checkable tree has no selection; remove selectionMode="${options.selectionMode}".`,
    )
  }
}
