// The one rule turning a component's root id and a part name or item key into element ids.
// Connect and every adapter use it, so server and client, React and any later adapter
// produce identical ids.

/**
 * Encodes an item key into an id token: `_` and every character outside [A-Za-z0-9-] are
 * written as `_<hex code point>_`. Injective, and never contains whitespace (IDREF lists
 * are space-separated).
 */
export function encodeKey(key: string | number): string {
  let out = ""
  for (const ch of String(key)) {
    out += /[A-Za-z0-9-]/.test(ch) ? ch : `_${(ch.codePointAt(0) ?? 0).toString(16)}_`
  }
  return out
}

/** `<scope>-<root>-<part>`. The root id's format is never parsed. */
export function partId(scope: string, root: string, part: string): string {
  return `${scope}-${root}-${part}`
}

/** `<scope>-<root>-<part>-<encoded key>`. */
export function itemId(scope: string, root: string, part: string, key: string | number): string {
  return `${partId(scope, root, part)}-${encodeKey(key)}`
}
