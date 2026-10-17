/** The Text Field's messages: the ClearTrigger's name, the counts, visibility and search. */
export type TextFieldMessages = {
  readonly clear: string
  /** The ClearTrigger's name with `type="search"`. */
  readonly clearSearch: string
  readonly charactersRemaining: (n: number) => string
  readonly charactersOver: (n: number) => string
  /** The VisibilityTrigger's name in both states (its pressed state carries the state). */
  readonly toggleLabel: string
  /** Spoken when a pointer press toggles while focus is in the input. */
  readonly visibilityAnnouncement: (visible: boolean) => string
}

export const textFieldMessages: TextFieldMessages = {
  clear: "Clear",
  clearSearch: "Clear search",
  charactersRemaining: (n) => `${n} ${n === 1 ? "character" : "characters"} remaining`,
  charactersOver: (n) => `${n} ${n === 1 ? "character" : "characters"} too many`,
  toggleLabel: "Show password",
  visibilityAnnouncement: (visible) => (visible ? "Password shown" : "Password hidden"),
}
