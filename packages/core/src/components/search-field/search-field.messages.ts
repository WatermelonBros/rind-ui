import { type TextFieldMessages, textFieldMessages } from "../text-field/text-field.messages"

/** The Search Field's messages: Text Field's, with the ClearTrigger named for a search. */
export type SearchFieldMessages = TextFieldMessages

export const searchFieldMessages: SearchFieldMessages = {
  ...textFieldMessages,
  clear: "Clear search",
}
