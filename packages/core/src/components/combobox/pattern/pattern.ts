// combobox-pattern (design §2): the derivations every input-driven listbox shares — the query,
// the results, whether the list is exposed, inline completion and the exact-text match.
// Pure: no DOM, no machine. Combobox and Autocomplete use them through their machine;
// Command, Tags Input and Mentions will too.

import { createFilter } from "../../../collection/filter"
import type { CollectionKey } from "../../../collection/key"
import type { Collection, ItemNode } from "../../../collection/list"
import type { LoadingStatus } from "../../../collection/machine"
import { collator as searchCollator } from "../../../i18n/messages"

/** Why the popup opened: typing filters, a trigger or an arrow shows everything. */
export type OpenReason = "input" | "arrow" | "trigger" | "press" | "focus" | "api"

/** A consumer matcher, or null to show the collection as given (server filtering). */
export type ComboboxFilter = ((node: ItemNode<unknown>, query: string) => boolean) | null

export interface QueryState {
  readonly inputValue: string
  /** The text was typed since the last commit. */
  readonly dirty: boolean
  readonly openReason: OpenReason | null
}

/**
 * The filtering query: the input text, except right after a trigger or arrow open with
 * nothing typed since (every option is shown: React Aria's showAllItems).
 */
export function patternQuery(s: QueryState): string {
  if (!s.dirty && (s.openReason === "trigger" || s.openReason === "arrow")) return ""
  return s.inputValue
}

/** The listed options: a derivation of the collection and the query, never stored. */
export function patternResults(
  collection: Collection<unknown>,
  query: string,
  filter: ComboboxFilter | undefined,
  locale: string,
): Collection<unknown> {
  if (filter === null || query === "") return collection
  const match = filter ?? ((n: ItemNode<unknown>, q: string) => createFilter(locale).contains(n, q))
  // Sections left empty disappear with their items (the collection rebuilds them).
  return collection.filter((n) => match(n, query))
}

export interface ExposureState {
  readonly open: boolean
  readonly results: Collection<unknown>
  readonly query: string
  /** The query the current collection answers (async); undefined: the current one. */
  readonly itemsQuery?: string | undefined
  readonly loading?: LoadingStatus | undefined
}

/** The collection answers an older query: rendered, but no highlight, count or empty state. */
export const isStale = (s: Pick<ExposureState, "itemsQuery" | "query">) =>
  s.itemsQuery !== undefined && s.itemsQuery !== s.query

const loadingNow = (loading: LoadingStatus | undefined) =>
  loading === "loading" || loading === "loading-more"

/** The list is shown: open with options (an empty, settled result hides it). */
export function isExposed(s: ExposureState): boolean {
  return s.open && s.results.size > 0
}

/** The empty state applies: open, no options, not loading, not stale. */
export function isEmptyState(s: ExposureState): boolean {
  return s.open && s.results.size === 0 && !loadingNow(s.loading) && !isStale(s)
}

/**
 * The completed text for an option, or null when it cannot complete: the option must start
 * with the query (locale-aware) and normalisation must keep the query's length
 * (ariakit#6315: decomposed accents).
 */
export function completion(query: string, optionText: string, locale: string): string | null {
  if (query === "" || query.normalize("NFC").length !== query.length) return null
  const collator = searchCollator(locale)
  const head = optionText.normalize("NFC").slice(0, query.length)
  if (collator.compare(head, query) !== 0) return null
  return query + optionText.normalize("NFC").slice(query.length)
}

/** The one option whose text equals `text` (locale-aware, case and accent blind), or null. */
export function exactMatch(
  collection: Collection<unknown>,
  text: string,
  locale: string,
): CollectionKey | null {
  if (text.trim() === "") return null
  const collator = searchCollator(locale)
  let found: CollectionKey | null = null
  for (let i = 0; i < collection.size; i++) {
    const node = collection.at(i)
    if (!node || node.disabled || collator.compare(node.textValue, text) !== 0) continue
    // Two options with the same text: neither is chosen (react-spectrum#7387).
    if (found !== null) return null
    found = node.key
  }
  return found
}

/** Set metadata of the listed options (items only, sections excluded): 1-based positions. */
export function listedPositions(results: Collection<unknown>): ReadonlyMap<CollectionKey, number> {
  const out = new Map<CollectionKey, number>()
  let i = 0
  for (const node of results) if (node.type === "item") out.set(node.key, ++i)
  return out
}
