// Mentions' strings (spec "Mentions Messages"): the combobox pattern's, plus the description.

import { type PatternMessages, patternMessages } from "../combobox/pattern/machine"

export interface MentionsMessages extends PatternMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The textarea's description, naming the triggers ("Type @ to mention someone"). */
  readonly description: (triggers: readonly string[]) => string
}

export const mentionsMessages: MentionsMessages = {
  ...patternMessages,
  description: (triggers) =>
    triggers.length === 0 ? "" : `Type ${triggers.join(" or ")} to insert a mention`,
}
