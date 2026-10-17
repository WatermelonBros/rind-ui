// Containment matching: every expected phrase appears, in order, inside some spoken phrase.
// Screen readers word things differently between versions; we check key phrases, not text.
export function missingPhrases(spoken: readonly string[], expected: readonly string[]): string[] {
  const missing: string[] = []
  let from = 0
  for (const phrase of expected) {
    const at = spoken.findIndex(
      (s, i) => i >= from && s.toLowerCase().includes(phrase.toLowerCase()),
    )
    if (at === -1) missing.push(phrase)
    else from = at
  }
  return missing
}

/** A site example in the harness, themed as the docs show it. */
export const story = (slug: string, example: string) => `/examples/${slug}/${example}/theme-calm/`
