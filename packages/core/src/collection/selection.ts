// Selection as pure operations over keys: modes, toggle/replace behaviours, Shift ranges
// from an internal anchor (never derived from the controlled value or the highlight),
// select all as a sentinel that covers unloaded items, and the disabled rules.

import type { Modality } from "../contract/env"
import type { CollectionKey } from "./key"
import type { Collection } from "./list"

/** The selected keys, or every selectable item (including items not loaded yet). */
export type SelectionValue = ReadonlySet<CollectionKey> | "all"

export interface SelectionConfig {
  readonly mode: "none" | "single" | "multiple"
  /** `toggle`: a press adds or removes; `replace`: a press replaces, mod+press toggles. */
  readonly behavior: "toggle" | "replace"
  /** No user action leaves the selection empty. */
  readonly disallowEmpty: boolean
  /** `all`: disabled items are not actionable; `selection`: only not selectable. */
  readonly disabledBehavior: "all" | "selection"
}

/** Where ranges start, and where the last range ended (the next one replaces it). */
export interface Anchor {
  readonly key: CollectionKey
  readonly rangeEnd: CollectionKey | null
}

export interface SelectInput {
  readonly key: CollectionKey
  readonly modality: Modality
  readonly shift: boolean
  /** ⌘ on Apple platforms, Ctrl elsewhere (decided by key normalisation). */
  readonly mod: boolean
}

export interface SelectResult {
  readonly value: SelectionValue
  readonly anchor: Anchor | null
}

export const emptySelection: SelectionValue = new Set<CollectionKey>()

/** A user can select it: present, enabled, and the mode selects at all. */
export const canSelect = (c: Collection<unknown>, key: CollectionKey, cfg: SelectionConfig) => {
  const node = c.get(key)
  return cfg.mode !== "none" && node !== undefined && !node.disabled
}

/** `"all"` covers every selectable item, loaded now or later. */
export function isSelected(c: Collection<unknown>, s: SelectionValue, key: CollectionKey): boolean {
  if (s !== "all") return s.has(key)
  const node = c.get(key)
  return node !== undefined && !node.disabled
}

/** The keys a selection stands for in `c` (`"all"` enumerated over the current items). */
export function selectedKeys(c: Collection<unknown>, s: SelectionValue): CollectionKey[] {
  if (s !== "all") return [...s]
  const out: CollectionKey[] = []
  for (let i = 0; i < c.size; i++) {
    const node = c.at(i)
    if (node && !node.disabled) out.push(node.key)
  }
  return out
}

/** Selectable keys from `a` to `b` inclusive, in collection order. */
function range(c: Collection<unknown>, a: CollectionKey, b: CollectionKey, cfg: SelectionConfig) {
  const ia = c.get(a)?.index
  const ib = c.get(b)?.index
  if (ia === undefined || ib === undefined) return []
  const out: CollectionKey[] = []
  for (let i = Math.min(ia, ib); i <= Math.max(ia, ib); i++) {
    const node = c.at(i)
    if (node && canSelect(c, node.key, cfg)) out.push(node.key)
  }
  return out
}

const sameAs = (s: SelectionValue, keys: readonly CollectionKey[]) =>
  s !== "all" && s.size === keys.length && keys.every((k) => s.has(k))

/** A press (or Space/Enter) on `input.key`. Unchanged when nothing may change. */
export function select(
  c: Collection<unknown>,
  s: SelectionValue,
  anchor: Anchor | null,
  input: SelectInput,
  cfg: SelectionConfig,
): SelectResult {
  const { key } = input
  const unchanged = { value: s, anchor }
  if (!canSelect(c, key, cfg)) return unchanged
  const selected = isSelected(c, s, key)
  const fresh = { key, rangeEnd: null }

  if (cfg.mode === "single") {
    // Toggle behaviour lets a press clear the single selection.
    if (selected && cfg.behavior === "toggle" && !cfg.disallowEmpty) {
      return { value: emptySelection, anchor: fresh }
    }
    return { value: new Set([key]), anchor: fresh }
  }

  if (input.shift && anchor && c.has(anchor.key)) {
    // The previous extension is replaced, not accumulated; a select-all state is replaced.
    const base = new Set(s === "all" ? [] : s)
    if (anchor.rangeEnd) for (const k of range(c, anchor.key, anchor.rangeEnd, cfg)) base.delete(k)
    for (const k of range(c, anchor.key, key, cfg)) base.add(k)
    if (base.size === 0 && cfg.disallowEmpty) return unchanged
    return { value: base, anchor: { key: anchor.key, rangeEnd: key } }
  }

  // Touch and screen-reader users have no modifier keys: their presses toggle.
  const toggles =
    cfg.behavior === "toggle" ||
    input.mod ||
    input.modality === "touch" ||
    input.modality === "virtual"
  if (!toggles) return { value: new Set([key]), anchor: fresh }
  const next = new Set(selectedKeys(c, s))
  if (selected) next.delete(key)
  else next.add(key)
  if (next.size === 0 && cfg.disallowEmpty) return unchanged
  return { value: next, anchor: fresh }
}

/** Select all (mod+A): `"all"`. Already everything: clears, unless empty is disallowed. */
export function toggleSelectAll(
  c: Collection<unknown>,
  s: SelectionValue,
  cfg: SelectionConfig,
): SelectionValue {
  if (cfg.mode !== "multiple") return s
  const everything = s === "all" || sameAs(s, selectedKeys(c, "all"))
  if (!everything) return "all"
  return cfg.disallowEmpty ? s : emptySelection
}

/** Clear by a user action: refused when empty is disallowed. */
export const clearSelection = (s: SelectionValue, cfg: SelectionConfig): SelectionValue =>
  cfg.disallowEmpty || cfg.mode === "none" ? s : emptySelection

/** Explicit removal (a deleted tag): not a user selection gesture, always allowed. */
export function deselect(
  c: Collection<unknown>,
  s: SelectionValue,
  key: CollectionKey,
): SelectionValue {
  if (!isSelected(c, s, key)) return s
  const next = new Set(selectedKeys(c, s))
  next.delete(key)
  return next
}

/**
 * Text values of the selected keys, kept for keys that left the collection (filtered,
 * paged away) so labels stay available; updated from `c` for keys it has.
 */
export function rememberTexts(
  previous: ReadonlyMap<CollectionKey, string>,
  c: Collection<unknown>,
  s: SelectionValue,
): ReadonlyMap<CollectionKey, string> {
  if (s === "all") return previous
  let next: Map<CollectionKey, string> | null = null
  for (const key of s) {
    const text = c.get(key)?.textValue
    if (text === undefined || previous.get(key) === text) continue
    next ??= new Map(previous)
    next.set(key, text)
  }
  return next ?? previous
}
