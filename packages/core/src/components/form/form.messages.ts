/** The Form's messages: the summary announced when an attempt fails on two or more Fields. */
export type FormMessages = {
  readonly invalidSummary: (count: number) => string
}

export const formMessages: FormMessages = {
  invalidSummary: (count) => `${count} fields have errors`,
}
