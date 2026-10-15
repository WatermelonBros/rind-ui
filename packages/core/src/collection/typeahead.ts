// The one typeahead step every collection component shares. Pure: the timeout is
// `now - at > timeout` with `now` from the environment's clock, so there is no timer to
// cancel on unmount or Strict Mode replay. Matches text values only (never keywords).

import { startsWith } from "./filter"
import type { CollectionKey } from "./key"
import type { Collection } from "./list"
import type { Navigable } from "./navigation"

export interface TypeaheadState {
  /** The search so far ("" when none is in progress). */
  readonly buffer: string
  /** Clock time of the last character that extended the search. */
  readonly at: number
}

export const idleTypeahead: TypeaheadState = { buffer: "", at: Number.NEGATIVE_INFINITY }

export interface TypeaheadOptions {
  /** Milliseconds after the last character that end a search. */
  readonly timeout: number
  /** A search collator for the component's locale (`searchCollator`). */
  readonly collator: Intl.Collator
  readonly navigable: Navigable
}

export interface TypeaheadResult {
  readonly state: TypeaheadState
  /** The matched key, or null (no match, or a Space that started nothing). */
  readonly key: CollectionKey | null
  /** The character was part of a search: a Space here does not do the component's action. */
  readonly consumed: boolean
}

/** The first navigable item from `start` (wrapping) whose text starts with `query`. */
function find(
  c: Collection<unknown>,
  start: number,
  query: string,
  { collator, navigable }: TypeaheadOptions,
): CollectionKey | null {
  for (let n = 0; n < c.size; n++) {
    const node = c.at((start + n) % c.size)
    if (node && navigable(node) && startsWith(collator, node.textValue, query)) return node.key
  }
  return null
}

/**
 * One typed character. A single character searches after the highlight (cycling); a
 * growing query searches from the highlight inclusive (no jumping away from an item that
 * still matches); a repeated character cycles unless an item starts with the whole run.
 */
export function typeahead(
  state: TypeaheadState,
  input: { readonly char: string; readonly now: number },
  c: Collection<unknown>,
  from: CollectionKey | null,
  options: TypeaheadOptions,
): TypeaheadResult {
  const previous = input.now - state.at > options.timeout ? "" : state.buffer
  // Space only continues a search in progress.
  if (input.char === " " && previous === "") {
    return { state: idleTypeahead, key: null, consumed: false }
  }
  const buffer = previous + input.char
  const here = from === null ? undefined : c.get(from)?.index
  const after = here === undefined ? 0 : here + 1
  const at = here ?? 0
  const repeated = buffer.length > 1 && [...buffer].every((ch) => ch === buffer[0])
  const key =
    buffer.length === 1
      ? find(c, after, buffer, options)
      : repeated
        ? (find(c, at, buffer, options) ?? find(c, after, input.char, options))
        : find(c, at, buffer, options)
  if (key === null) return { state: idleTypeahead, key: null, consumed: true }
  return { state: { buffer, at: input.now }, key, consumed: true }
}
