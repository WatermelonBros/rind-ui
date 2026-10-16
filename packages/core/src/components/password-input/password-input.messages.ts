import { type TextFieldMessages, textFieldMessages } from "../text-field/text-field.messages"

/** The Password Input's messages: Text Field's plus the trigger's name and announcement. */
export type PasswordInputMessages = TextFieldMessages & {
  /** The trigger's name in both states (its pressed state carries the state). */
  readonly toggleLabel: string
  /** Spoken when a pointer press toggles while focus is in the input. */
  readonly visibilityAnnouncement: (visible: boolean) => string
}

export const passwordInputMessages: PasswordInputMessages = {
  ...textFieldMessages,
  toggleLabel: "Show password",
  visibilityAnnouncement: (visible) => (visible ? "Password shown" : "Password hidden"),
}
