// Tri-state checking over a tree (design §1, spec "Checkable Trees"), pure. The checked
// value holds leaves; a branch's state is derived from its descendant leaves. A branch
// whose children are not loaded counts as a leaf, and a key in the value whose children
// arrived later covers them (its descendants show checked) until a toggle normalises it.

import type { CollectionKey } from "../../collection/key"
import type { TreeCollection } from "../../collection/tree"

export type CheckState = "true" | "false" | "mixed"
export type CheckPropagation = "both" | "none"

type Tree = Pick<TreeCollection<unknown>, "get" | "children" | "parent">

/** Descendant leaves of `key` (itself when it has no loaded children), in tree order. */
export function leavesOf(tree: Tree, key: CollectionKey): CollectionKey[] {
  const kids = tree.children(key)
  if (kids.length === 0) return [key]
  return kids.flatMap((k) => leavesOf(tree, k))
}

/** The key itself or one of its ancestors is in the value. */
function covered(tree: Tree, checked: ReadonlySet<CollectionKey>, key: CollectionKey): boolean {
  for (let k: CollectionKey | null = key; k !== null; k = tree.parent(k)) {
    if (checked.has(k)) return true
  }
  return false
}

/** The check state of `key`: own membership (`none`), or derived from its leaves (`both`). */
export function stateOf(
  tree: Tree,
  checked: ReadonlySet<CollectionKey>,
  key: CollectionKey,
  propagation: CheckPropagation = "both",
): CheckState {
  if (propagation === "none") return checked.has(key) ? "true" : "false"
  const leaves = leavesOf(tree, key)
  let on = 0
  for (const leaf of leaves) if (covered(tree, checked, leaf)) on++
  return on === 0 ? "false" : on === leaves.length ? "true" : "mixed"
}

/**
 * Keys in the value that now have loaded children are replaced by their leaves (each
 * keeps the checked state it showed), so the value holds leaves only.
 */
export function normalise(
  tree: Tree,
  checked: ReadonlySet<CollectionKey>,
): ReadonlySet<CollectionKey> {
  let changed = false
  const out = new Set<CollectionKey>()
  for (const key of checked) {
    if (tree.children(key).length === 0) {
      out.add(key)
      continue
    }
    changed = true
    for (const leaf of leavesOf(tree, key)) out.add(leaf)
  }
  return changed ? out : checked
}

/**
 * The value after the user toggles `key`. `both`: every enabled descendant leaf is set when
 * one of them is unchecked, else cleared; disabled leaves keep their state. `none`: the key
 * alone. Returns the same set when nothing changes.
 */
export function toggle(
  tree: Tree,
  checked: ReadonlySet<CollectionKey>,
  key: CollectionKey,
  propagation: CheckPropagation = "both",
): ReadonlySet<CollectionKey> {
  if (propagation === "none") {
    const next = new Set(checked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }
  const base = normalise(tree, checked)
  const enabled = leavesOf(tree, key).filter((k) => tree.get(k)?.disabled !== true)
  if (enabled.length === 0) return checked
  const allOn = enabled.every((k) => covered(tree, base, k))
  const next = new Set(base)
  for (const leaf of enabled) {
    if (allOn) next.delete(leaf)
    else next.add(leaf)
  }
  return next
}
