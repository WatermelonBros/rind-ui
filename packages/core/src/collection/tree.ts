// Tree collections: every node of the tree in depth-first order, with parent, depth and
// sibling position, and the visible collection for a set of expanded keys (collapsed
// descendants absent). A node may declare children that are not loaded yet.

import { type CollectionKey, toKey } from "./key"
import { type Collection, fromNodes, type NodeInit, type SectionNode } from "./list"

export interface TreeOptions<T> {
  readonly roots: Iterable<T>
  readonly getKey: (item: T) => string
  readonly getText: (item: T) => string
  /** Loaded children; empty or undefined for a leaf or an unloaded branch. */
  readonly getChildren: (item: T) => Iterable<T> | undefined
  /** True for a branch whose children are not loaded yet. */
  readonly hasUnloadedChildren?: ((item: T) => boolean) | undefined
  readonly getKeywords?: ((item: T) => readonly string[]) | undefined
  readonly isDisabled?: ((item: T) => boolean) | undefined
}

export interface TreeCollection<T> extends Collection<T> {
  parent(key: CollectionKey): CollectionKey | null
  children(key: CollectionKey): readonly CollectionKey[]
  /** The nodes not hidden by a collapsed ancestor. */
  visible(expanded: ReadonlySet<CollectionKey>): Collection<T>
  /** `key` itself when visible, else its nearest visible ancestor (null when unknown). */
  nearestVisible(key: CollectionKey, expanded: ReadonlySet<CollectionKey>): CollectionKey | null
}

const noSections = new Map<CollectionKey, SectionNode>()

export function createTreeCollection<T>(options: TreeOptions<T>): TreeCollection<T> {
  const inits: NodeInit<T>[] = []
  const childrenOf = new Map<CollectionKey | null, CollectionKey[]>()
  const walk = (values: readonly T[], parentKey: CollectionKey | null, level: number) => {
    const keys: CollectionKey[] = []
    for (const [index, value] of values.entries()) {
      const key = toKey(options.getKey(value))
      keys.push(key)
      const children = [...(options.getChildren(value) ?? [])]
      inits.push({
        key,
        value,
        textValue: options.getText(value),
        keywords: options.getKeywords?.(value) ?? [],
        disabled: options.isDisabled?.(value) ?? false,
        parentKey,
        level,
        sibling: { index, count: values.length },
        hasChildren: children.length > 0 || options.hasUnloadedChildren?.(value) === true,
      })
      walk(children, key, level + 1)
    }
    childrenOf.set(parentKey, keys)
  }
  walk([...options.roots], null, 0)
  return treeOf(options, inits, childrenOf)
}

function treeOf<T>(
  options: TreeOptions<T>,
  inits: readonly NodeInit<T>[],
  childrenOf: ReadonlyMap<CollectionKey | null, readonly CollectionKey[]>,
): TreeCollection<T> {
  /** A flat collection over some of the tree's nodes, keeping their tree metadata. */
  const subset = (keep: readonly NodeInit<T>[]): Collection<T> =>
    fromNodes(keep, noSections, (values) => {
      const survivors = new Set(values)
      return subset(keep.filter((n) => survivors.has(n.value)))
    })
  const base: Collection<T> = fromNodes(inits, noSections, () => base)
  const parent = (key: CollectionKey) => base.get(key)?.parentKey ?? null
  const tree: TreeCollection<T> = {
    ...base,
    [Symbol.iterator]: () => base[Symbol.iterator](),
    parent,
    children: (key) => childrenOf.get(key) ?? [],
    visible: (expanded) => {
      const shown = new Set<CollectionKey | null>([null])
      return subset(
        inits.filter((n) => {
          if (!shown.has(n.parentKey)) return false
          if (expanded.has(n.key)) shown.add(n.key)
          return true
        }),
      )
    },
    nearestVisible: (key, expanded) => {
      if (!base.has(key)) return null
      let visible: CollectionKey = key
      // The outermost collapsed ancestor hides everything under it.
      for (let p = parent(key); p; p = parent(p)) if (!expanded.has(p)) visible = p
      return visible
    },
    // Matching nodes keep their ancestors, so the tree shape survives filtering.
    filter: (predicate) => {
      const keep = new Set<CollectionKey>()
      for (let i = 0; i < base.size; i++) {
        const node = base.at(i)
        if (!node || !predicate(node)) continue
        for (let k: CollectionKey | null = node.key; k && !keep.has(k); k = parent(k)) keep.add(k)
      }
      return subset(inits.filter((n) => keep.has(n.key)))
    },
    // Removing a node removes its subtree.
    remove: (...keys) => {
      const gone = new Set<CollectionKey>(keys)
      return subset(
        inits.filter((n) => {
          if (n.parentKey && gone.has(n.parentKey)) gone.add(n.key)
          return !gone.has(n.key)
        }),
      )
    },
    // Inserting and moving act on the roots; nested edits rebuild from new data. Root keys
    // come from this tree, so `get` finds each one (the assertions are sound).
    insert: (index, ...values) => {
      const roots = (childrenOf.get(null) ?? []).map((k) => base.get(k)?.value as T)
      roots.splice(index, 0, ...values)
      return createTreeCollection({ ...options, roots })
    },
    move: (key, toIndex) => {
      const roots = (childrenOf.get(null) ?? []).map((k) => base.get(k)?.value as T)
      const from = (childrenOf.get(null) ?? []).indexOf(key)
      if (from === -1) return tree
      const [moved] = roots.splice(from, 1)
      if (moved !== undefined) roots.splice(toIndex, 0, moved)
      return createTreeCollection({ ...options, roots })
    },
  }
  return tree
}
