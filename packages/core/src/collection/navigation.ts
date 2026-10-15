// Logical moves over a collection: one bounded walker (at most one pass, so an all-disabled
// collection cannot hang), loop, pages, tree expand/collapse, and the repair of the
// highlight when the collection changes.

import type { CollectionKey } from "./key"
import type { Collection, ItemNode } from "./list"
import type { TreeCollection } from "./tree"

export type Move =
  | "next"
  | "previous"
  | "first"
  | "last"
  | "page-next"
  | "page-previous"
  | "expand"
  | "collapse"

export type Navigable = (node: ItemNode<unknown>) => boolean

/** Disabled items are skipped unless the component keeps them focusable. */
export const navigableWhen =
  (focusableWhenDisabled: boolean): Navigable =>
  (node) =>
    focusableWhenDisabled || !node.disabled

/** Items moved by a page when the layout cannot be measured. */
export const DEFAULT_PAGE_SIZE = 10

export interface MoveOptions {
  readonly loop: boolean
  readonly navigable: Navigable
  /** The measured page target (layout), when the environment can measure it. */
  readonly pageTarget?: CollectionKey | null | undefined
  /** Navigable items per page when not measured. Default 10. */
  readonly pageSize?: number | undefined
}

/** The first navigable key from `start` stepping by `step`, at most one pass. */
function walk(
  c: Collection<unknown>,
  start: number,
  step: 1 | -1,
  loop: boolean,
  navigable: Navigable,
): CollectionKey | null {
  for (let n = 0, i = start; n < c.size; n++, i += step) {
    if (i < 0 || i >= c.size) {
      if (!loop) return null
      i = (i + c.size) % c.size
    }
    const node = c.at(i)
    if (node && navigable(node)) return node.key
  }
  return null
}

/** `count` navigable items away from `index`, stopping at the end (pages never loop). */
function page(
  c: Collection<unknown>,
  index: number,
  step: 1 | -1,
  count: number,
  navigable: Navigable,
): CollectionKey | null {
  let reached: CollectionKey | null = null
  let moved = 0
  for (let i = index + step; i >= 0 && i < c.size && moved < count; i += step) {
    const node = c.at(i)
    if (node && navigable(node)) {
      reached = node.key
      moved++
    }
  }
  return reached
}

/**
 * The key a list move leads to from `from`, or `from` when the move does nothing (an end
 * without loop, nothing navigable). Tree moves are `treeMove`.
 */
export function move(
  c: Collection<unknown>,
  from: CollectionKey | null,
  m: Move,
  { loop, navigable, pageTarget, pageSize = DEFAULT_PAGE_SIZE }: MoveOptions,
): CollectionKey | null {
  const index = from === null ? undefined : c.get(from)?.index
  const stay = index === undefined ? null : from
  switch (m) {
    case "first":
      return walk(c, 0, 1, false, navigable)
    case "last":
      return walk(c, c.size - 1, -1, false, navigable)
    case "next":
      if (index === undefined) return walk(c, 0, 1, false, navigable)
      return walk(c, index + 1, 1, loop, navigable) ?? stay
    case "previous":
      if (index === undefined) return walk(c, c.size - 1, -1, false, navigable)
      return walk(c, index - 1, -1, loop, navigable) ?? stay
    case "page-next":
    case "page-previous": {
      const step = m === "page-next" ? 1 : -1
      if (pageTarget != null && c.has(pageTarget)) {
        const target = c.get(pageTarget)
        if (target && navigable(target)) return pageTarget
        return walk(c, target?.index ?? 0, step, false, navigable) ?? stay
      }
      if (index === undefined) return walk(c, step === 1 ? 0 : c.size - 1, step, false, navigable)
      return page(c, index, step, pageSize, navigable) ?? stay
    }
    default:
      return stay
  }
}

export interface TreeMoveResult {
  readonly highlight: CollectionKey | null
  readonly expand?: CollectionKey
  readonly collapse?: CollectionKey
}

/**
 * Expand: a collapsed branch expands, an expanded one moves to its first child. Collapse:
 * an expanded branch collapses, a leaf or collapsed branch moves to its parent.
 */
export function treeMove(
  tree: TreeCollection<unknown>,
  expanded: ReadonlySet<CollectionKey>,
  from: CollectionKey | null,
  m: "expand" | "collapse",
  navigable: Navigable,
): TreeMoveResult {
  const node = from === null ? undefined : tree.get(from)
  if (!node || from === null) return { highlight: from }
  const open = expanded.has(from)
  if (m === "expand") {
    if (!node.hasChildren) return { highlight: from }
    if (!open) return { highlight: from, expand: from }
    const first = tree.children(from).find((k) => {
      const child = tree.get(k)
      return child !== undefined && navigable(child)
    })
    return { highlight: first ?? from }
  }
  if (node.hasChildren && open) return { highlight: from, collapse: from }
  return { highlight: tree.parent(from) ?? from }
}

/**
 * The highlight after a collection change: `key` when `next` still has it navigable, else
 * the first key after it in `prev`'s order that `next` has navigable, else the first such
 * key before it, else null. Driven by data, never by elements unmounting.
 */
export function repair(
  prev: Collection<unknown> | null,
  next: Collection<unknown>,
  key: CollectionKey | null,
  navigable: Navigable,
): CollectionKey | null {
  if (key === null) return null
  const ok = (k: CollectionKey) => {
    const node = next.get(k)
    return node !== undefined && navigable(node)
  }
  if (ok(key)) return key
  const index = prev?.get(key)?.index
  if (!prev || index === undefined) return null
  for (let i = index + 1; i < prev.size; i++) {
    const k = prev.at(i)?.key
    if (k !== undefined && ok(k)) return k
  }
  for (let i = index - 1; i >= 0; i--) {
    const k = prev.at(i)?.key
    if (k !== undefined && ok(k)) return k
  }
  return null
}
