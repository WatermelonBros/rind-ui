// Locale-aware filters that ignore case and diacritics ("ecole" finds "École"), matching
// an item's text value or any of its keywords. The collator is i18n's cached search
// collator (base sensitivity).

import { collator as searchCollator } from "../i18n/messages"
import type { ItemNode } from "./list"

/** `text` starts with `query` under `collator`. */
export function startsWith(collator: Intl.Collator, text: string, query: string): boolean {
  if (query.length === 0) return true
  // Compare the prefix of the same length: base sensitivity keeps lengths comparable for
  // precomposed text; normalised so decomposed accents line up too.
  const t = text.normalize("NFC")
  const q = query.normalize("NFC")
  return collator.compare(t.slice(0, q.length), q) === 0
}

/** `query` occurs anywhere in `text` under `collator`. */
export function contains(collator: Intl.Collator, text: string, query: string): boolean {
  if (query.length === 0) return true
  const t = text.normalize("NFC")
  const q = query.normalize("NFC")
  for (let i = 0; i + q.length <= t.length; i++) {
    if (collator.compare(t.slice(i, i + q.length), q) === 0) return true
  }
  return false
}

export interface Filter {
  /** The text value or a keyword starts with the query. */
  startsWith(node: ItemNode<unknown>, query: string): boolean
  /** The text value or a keyword contains the query. */
  contains(node: ItemNode<unknown>, query: string): boolean
}

/** Filters for `locale`, for `collection.filter((n) => f.contains(n, query))`. */
export function createFilter(locale: string): Filter {
  const collator = searchCollator(locale)
  const terms = (node: ItemNode<unknown>) => [node.textValue, ...node.keywords]
  return {
    startsWith: (node, query) => terms(node).some((t) => startsWith(collator, t, query)),
    contains: (node, query) => terms(node).some((t) => contains(collator, t, query)),
  }
}
