/** The Text Field's messages: the ClearTrigger's name and the count announcements. */
export type TextFieldMessages = {
  readonly clear: string
  readonly charactersRemaining: (n: number) => string
  readonly charactersOver: (n: number) => string
}

export const textFieldMessages: TextFieldMessages = {
  clear: "Clear",
  charactersRemaining: (n) => `${n} ${n === 1 ? "character" : "characters"} remaining`,
  charactersOver: (n) => `${n} ${n === 1 ? "character" : "characters"} too many`,
}
