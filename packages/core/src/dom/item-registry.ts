// Static item parts → one collection per commit. Parts register at commit time (layout
// effects, never from a discarded render); every registration of a commit is flushed once,
// in a microtask after the commit, sorted into document order (already-sorted fast path,
// as Base UI). Machines never read DOM order: they receive the resulting collection.

declare const process: { env: { NODE_ENV?: string } }

export interface ItemRegistration {
  readonly key: string
  /** Default: the element's text content. */
  readonly textValue?: string | undefined
  readonly keywords?: readonly string[] | undefined
  readonly disabled?: boolean | undefined
  readonly section?: { readonly key: string; readonly label: string } | undefined
  readonly element: Element
}

/** A registration with its text value resolved. */
export type RegisteredItem = ItemRegistration & { readonly textValue: string }

export interface ItemRegistry {
  /** Adds (or replaces) an item; returns its removal. Call at commit time. */
  register(item: ItemRegistration): () => void
  /**
   * Flushes the pending registrations now (the root's layout effect, after its items'
   * in the same commit), so the collection arrives in that commit instead of a microtask
   * later; a no-op when nothing is pending.
   */
  flush(): void
}

const inDocumentOrder = (a: Element, b: Element) =>
  a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1

/**
 * A registry that calls `onChange` with the items in document order, once per batch of
 * registrations (one commit), only when something changed.
 */
export function createItemRegistry(
  onChange: (items: readonly RegisteredItem[]) => void,
): ItemRegistry {
  const items = new Map<Element, ItemRegistration>()
  let scheduled = false
  const warned = new Set<string>()
  /** The items as last emitted (in document order then). */
  let emitted: ItemRegistration[] = []
  const inOrder = (list: readonly ItemRegistration[]) =>
    list.every(
      (it, i) => i === 0 || inDocumentOrder(list[i - 1]?.element ?? it.element, it.element) <= 0,
    )
  /** The first commit is always reported: a root with no items yet is empty, not pending. */
  let reported = false
  const flush = () => {
    // Nothing registered, but the same elements may have moved (a reorder keeps every key,
    // text and element: headlessui#2131), so the root's per-commit flush re-checks the order.
    if (reported && !scheduled && inOrder(emitted)) return
    reported = true
    scheduled = false
    let list = [...items.values()]
    // Fast path: parts usually register in document order already.
    if (!inOrder(list)) list = list.sort((a, b) => inDocumentOrder(a.element, b.element))
    emitted = list
    onChange(
      list.map((it) => {
        const text = it.textValue ?? it.element.textContent?.trim() ?? ""
        if (it.textValue === undefined && text === "" && process.env.NODE_ENV !== "production") {
          if (!warned.has(it.key)) {
            warned.add(it.key)
            console.warn(
              `[rind-ui] item "${it.key}" has no text value and no text content: pass textValue (typeahead, filtering and announcements use it)`,
            )
          }
        }
        return { ...it, textValue: text }
      }),
    )
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
  }
  return {
    flush,
    register(item) {
      items.set(item.element, item)
      schedule()
      return () => {
        if (items.get(item.element) !== item) return
        items.delete(item.element)
        schedule()
      }
    },
  }
}
