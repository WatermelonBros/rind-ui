// Partial ARIA snapshot matching (Playwright's YAML from `locator.ariaSnapshot()`): every
// line of the expected snapshot appears in the actual one, in order and at the same depth.
// Extra nodes (an engine exposing one more generic or text node) do not fail; a missing
// role, name or state does.

/** The expected lines missing from `actual`, in order (empty when it matches). */
export function missingAriaLines(actual: string, expected: string): string[] {
  const lines = (s: string) =>
    s
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.trim() !== "")
  const have = lines(actual)
  const missing: string[] = []
  let from = 0
  for (const line of lines(expected)) {
    const at = have.indexOf(line, from)
    if (at === -1) missing.push(line)
    else from = at + 1
  }
  return missing
}
