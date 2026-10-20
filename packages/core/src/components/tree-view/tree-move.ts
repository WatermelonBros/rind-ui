// Tree moves (add-tree-view-dnd design §1): where a node goes, as `{ parent, index }` with
// `index` counted among the parent's children *after* the node is removed, so "after A" and
// "before B" are the same place (React Aria #8561). The outliner keys (Alt+arrows), the pointer
// zones over a row, and the immutable data helper; a node never goes into its own subtree
// (React Aria #9841).

import { type CollectionKey, toKey } from "../../collection/key"
import type { TreeCollection } from "../../collection/tree"

/** Where a moved node goes. `parent: null` is the root level. */
export interface TreeMoveTarget {
  readonly parent: string | null
  readonly index: number
}

/** The outliner moves: up / down among siblings, in (indent), out (outdent). */
export type TreeMoveDirection = "up" | "down" | "in" | "out"

/** Over which part of a row the pointer is. */
export type TreeDropZone = "before" | "inside" | "after"

type Tree = TreeCollection<unknown>

const siblingsOf = (tree: Tree, key: CollectionKey) => {
  const parent = tree.parent(key)
  return { parent, siblings: tree.children(parent as CollectionKey) }
}

/** `key` is `ancestor` or inside its subtree. */
export function isWithin(tree: Tree, key: string, ancestor: string): boolean {
  for (let k: CollectionKey | null = toKey(key); k; k = tree.parent(k))
    if (k === ancestor) return true
  return false
}

const isBranch = (tree: Tree, key: CollectionKey) => tree.get(key)?.hasChildren === true

/** The target of an outliner key, or null when there is nowhere to go that way. */
export function moveTarget(
  tree: Tree,
  node: string,
  direction: TreeMoveDirection,
  /** Whether a node accepts children (default: it has children, loaded or not). */
  branch: (key: CollectionKey) => boolean = (k) => isBranch(tree, k),
): TreeMoveTarget | null {
  const key = toKey(node)
  if (!tree.has(key)) return null
  const { parent, siblings } = siblingsOf(tree, key)
  const at = siblings.indexOf(key)
  switch (direction) {
    case "up":
      return at > 0 ? { parent, index: at - 1 } : null
    case "down":
      // The next sibling's place, once this node is removed, is `at`: after it is `at + 1`.
      return at < siblings.length - 1 ? { parent, index: at + 1 } : null
    case "in": {
      const previous = siblings[at - 1]
      if (previous === undefined || !branch(previous)) return null
      return { parent: previous, index: tree.children(previous).length }
    }
    case "out": {
      if (parent === null) return null
      const grand = tree.parent(parent)
      const parentAt = tree.children(grand as CollectionKey).indexOf(parent)
      return { parent: grand, index: parentAt + 1 }
    }
  }
}

/**
 * The target of dropping `key` on `over`'s zone, or null for its own subtree. `expanded`:
 * whether `over` shows its children (then "after" it is its first child's place, where the
 * line is drawn).
 */
export function pointerTarget(
  tree: Tree,
  node: string,
  overNode: string,
  zone: TreeDropZone,
  expanded: boolean,
): TreeMoveTarget | null {
  const key = toKey(node)
  const over = toKey(overNode)
  if (!tree.has(key) || !tree.has(over) || isWithin(tree, over, key)) return null
  if (zone === "inside" || (zone === "after" && expanded && tree.children(over).length > 0)) {
    const children = tree.children(over).filter((k) => k !== key)
    return { parent: over, index: zone === "inside" ? children.length : 0 }
  }
  const { parent, siblings } = siblingsOf(tree, over)
  const rest = siblings.filter((k) => k !== key)
  const at = rest.indexOf(over)
  return { parent, index: zone === "before" ? at : at + 1 }
}

/** A tree node in data (Tree View's items). */
export interface TreeMoveData {
  readonly key: string
  readonly children?: readonly TreeMoveData[] | undefined
}

/** `items` with `key` moved to `target` (immutable; unknown keys leave `items` as they are). */
export function moveNode<T extends TreeMoveData>(
  items: readonly T[],
  key: string,
  target: TreeMoveTarget,
): T[] {
  let moved: T | undefined
  const without = (nodes: readonly T[]): T[] =>
    nodes.flatMap((n) => {
      if (n.key === key) {
        moved = n
        return []
      }
      return n.children ? [{ ...n, children: without(n.children as readonly T[]) }] : [n]
    })
  const rest = without(items)
  if (!moved) return [...items]
  const node = moved
  const insert = (nodes: readonly T[]): T[] => {
    const at = Math.max(0, Math.min(nodes.length, target.index))
    return [...nodes.slice(0, at), node, ...nodes.slice(at)]
  }
  if (target.parent === null) return insert(rest)
  const into = (nodes: readonly T[]): T[] =>
    nodes.map((n) =>
      n.key === target.parent
        ? { ...n, children: insert((n.children ?? []) as readonly T[]) }
        : n.children
          ? { ...n, children: into(n.children as readonly T[]) }
          : n,
    )
  return into(rest)
}
