// The immutable, key-based collection model shared by lists, sectioned lists and trees.
// Built eagerly (O(n)) into one array of items plus a key → index map, so lookups and
// moves are O(1) and no linked list is maintained. Derivations return new collections.

import { type CollectionKey, toKey } from "./key"

declare const process: { env: { NODE_ENV?: string } }

export interface ItemNode<T> {
  readonly type: "item"
  readonly key: CollectionKey
  readonly value: T
  /** Used by typeahead, filtering, announcements and form labels. */
  readonly textValue: string
  /** Extra filter terms (synonyms); never typeahead, announcements or labels. */
  readonly keywords: readonly string[]
  readonly disabled: boolean
  /** Position among the collection's items (sections excluded). */
  readonly index: number
  /** The section or tree parent. */
  readonly parentKey: CollectionKey | null
  /** Depth: 0 for lists and tree roots. */
  readonly level: number
  /** `aria-posinset` - 1: the item index, or the position among tree siblings. */
  readonly setIndex: number
  /** `aria-setsize`: the item count, or the tree sibling count. */
  readonly setSize: number
  /** A tree node with children, loaded or not. */
  readonly hasChildren: boolean
}

export interface SectionNode {
  readonly type: "section"
  readonly key: CollectionKey
  readonly label: string
}

export interface Collection<T> {
  /** Items only. */
  readonly size: number
  get(key: CollectionKey): ItemNode<T> | undefined
  has(key: CollectionKey): boolean
  keyAfter(key: CollectionKey): CollectionKey | null
  keyBefore(key: CollectionKey): CollectionKey | null
  firstKey(): CollectionKey | null
  lastKey(): CollectionKey | null
  at(index: number): ItemNode<T> | undefined
  sections(): readonly SectionNode[]
  sectionOf(key: CollectionKey): SectionNode | undefined
  /** Sections and items in render order (a section precedes its items). */
  [Symbol.iterator](): Iterator<ItemNode<T> | SectionNode>
  /** Items passing `predicate`; sections left empty are dropped. */
  filter(predicate: (node: ItemNode<T>) => boolean): Collection<T>
  /** Items inserted before the item at `index` (item order). */
  insert(index: number, ...items: T[]): Collection<T>
  remove(...keys: CollectionKey[]): Collection<T>
  move(key: CollectionKey, toIndex: number): Collection<T>
}

export interface ListOptions<T> {
  readonly items: Iterable<T>
  readonly getKey: (item: T) => string
  readonly getText: (item: T) => string
  readonly getKeywords?: ((item: T) => readonly string[]) | undefined
  readonly isDisabled?: ((item: T) => boolean) | undefined
  readonly getSection?: ((item: T) => { key: string; label: string } | undefined) | undefined
}

/** One item before indexing: what list and tree builders hand to `fromNodes`. */
export interface NodeInit<T> {
  readonly key: CollectionKey
  readonly value: T
  readonly textValue: string
  readonly keywords: readonly string[]
  readonly disabled: boolean
  readonly parentKey: CollectionKey | null
  readonly level: number
  /** Tree sibling position; list items use their index and the size. */
  readonly sibling?: { readonly index: number; readonly count: number } | undefined
  readonly hasChildren?: boolean | undefined
}

const dev = () => process.env.NODE_ENV !== "production"

/**
 * The indexed collection over `inits` (render order) and `sections`. `rebuild` makes the
 * derivations: it receives the surviving values in item order.
 */
export function fromNodes<T>(
  inits: readonly NodeInit<T>[],
  sections: ReadonlyMap<CollectionKey, SectionNode>,
  rebuild: (values: readonly T[]) => Collection<T>,
): Collection<T> {
  const kept: NodeInit<T>[] = []
  const indexOf = new Map<CollectionKey, number>()
  for (const init of inits) {
    const seen = indexOf.get(init.key)
    if (seen !== undefined) {
      if (dev()) {
        throw new Error(
          `[rind-ui] duplicate collection key "${init.key}": items "${kept[seen]?.textValue}" (index ${seen}) and "${init.textValue}"`,
        )
      }
      // Production: the later duplicate is ignored.
      continue
    }
    indexOf.set(init.key, kept.length)
    kept.push(init)
  }
  const items: ItemNode<T>[] = kept.map(({ sibling, hasChildren, ...init }, index) => ({
    type: "item",
    ...init,
    index,
    setIndex: sibling?.index ?? index,
    setSize: sibling?.count ?? kept.length,
    hasChildren: hasChildren === true,
  }))
  const parents = new Set(items.map((item) => item.parentKey))
  const usedSections = [...sections.values()].filter((s) => parents.has(s.key))
  const at = (i: number) => items[i]
  const collection: Collection<T> = {
    size: items.length,
    get: (key) => {
      const i = indexOf.get(key)
      return i === undefined ? undefined : items[i]
    },
    has: (key) => indexOf.has(key),
    keyAfter: (key) => {
      const i = indexOf.get(key)
      return i === undefined ? null : (at(i + 1)?.key ?? null)
    },
    keyBefore: (key) => {
      const i = indexOf.get(key)
      return i === undefined ? null : (at(i - 1)?.key ?? null)
    },
    firstKey: () => at(0)?.key ?? null,
    lastKey: () => items.at(-1)?.key ?? null,
    at,
    sections: () => usedSections,
    sectionOf: (key) => {
      const parent = collection.get(key)?.parentKey
      return parent ? sections.get(parent) : undefined
    },
    *[Symbol.iterator]() {
      let section: CollectionKey | null = null
      for (const item of items) {
        const s = item.parentKey ? sections.get(item.parentKey) : undefined
        if (s && s.key !== section) yield s
        section = s ? s.key : null
        yield item
      }
    },
    filter: (predicate) => rebuild(items.filter(predicate).map((n) => n.value)),
    insert: (index, ...values) => {
      const all = items.map((n) => n.value)
      all.splice(index, 0, ...values)
      return rebuild(all)
    },
    remove: (...keys) => {
      const gone = new Set(keys)
      return rebuild(items.filter((n) => !gone.has(n.key)).map((n) => n.value))
    },
    move: (key, toIndex) => {
      const from = indexOf.get(key)
      if (from === undefined) return collection
      const all = items.map((n) => n.value)
      const [moved] = all.splice(from, 1)
      if (moved !== undefined) all.splice(toIndex, 0, moved)
      return rebuild(all)
    },
  }
  return collection
}

/**
 * A list collection, optionally sectioned: items of one section are grouped where the
 * section first appears; sectionless items keep their place.
 */
export function createListCollection<T>(options: ListOptions<T>): Collection<T> {
  const groups: { section: CollectionKey | null; values: T[] }[] = []
  const byKey = new Map<CollectionKey, { section: CollectionKey | null; values: T[] }>()
  const sections = new Map<CollectionKey, SectionNode>()
  for (const value of options.items) {
    const s = options.getSection?.(value)
    if (!s) {
      const last = groups.at(-1)
      if (last && last.section === null) last.values.push(value)
      else groups.push({ section: null, values: [value] })
      continue
    }
    const key = toKey(s.key)
    if (!sections.has(key)) sections.set(key, { type: "section", key, label: s.label })
    let group = byKey.get(key)
    if (!group) {
      group = { section: key, values: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.values.push(value)
  }
  const inits: NodeInit<T>[] = groups.flatMap((g) =>
    g.values.map((value) => ({
      key: toKey(options.getKey(value)),
      value,
      textValue: options.getText(value),
      keywords: options.getKeywords?.(value) ?? [],
      disabled: options.isDisabled?.(value) ?? false,
      parentKey: g.section,
      level: 0,
    })),
  )
  return fromNodes(inits, sections, (values) => createListCollection({ ...options, items: values }))
}
