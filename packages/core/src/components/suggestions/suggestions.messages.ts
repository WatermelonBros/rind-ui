// Suggestions' strings (spec "Suggestions").

export interface SuggestionsMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The group's name when it has none of its own. */
  readonly group: string
  /** Announced when a new set replaces the items (with `announce="polite"`). */
  readonly count: (n: number) => string
}

export const suggestionsMessages: SuggestionsMessages = {
  group: "Suggestions",
  count: (n) => `${n} ${n === 1 ? "suggestion" : "suggestions"}`,
}
