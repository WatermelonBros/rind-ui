// Citation's strings (spec "Citation Messages").

export interface CitationMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The marker's name ("Source 1: Example Domain"). */
  readonly name: (index: number, title: string) => string
  /** A marker whose source has not arrived. */
  readonly pending: (index: number) => string
}

export const citationMessages: CitationMessages = {
  name: (index, title) => `Source ${index}: ${title}`,
  pending: (index) => `Source ${index}, loading`,
}
