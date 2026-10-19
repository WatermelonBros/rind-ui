// Message Thread's strings: the feed's name, each message's speaker, the jump button.

export type MessageFrom = "user" | "assistant" | "system"

export interface MessageThreadMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The feed's name. */
  readonly label: string
  /** A message's name, from its speaker. */
  readonly messageLabel: (message: { readonly from: MessageFrom; readonly index: number }) => string
  /** JumpToLatest's name, with the messages that arrived while reading back. */
  readonly jumpLabel: (unread: number, locale: string) => string
}

export const messageThreadMessages: MessageThreadMessages = {
  label: "Conversation",
  messageLabel: ({ from }) =>
    from === "user" ? "You" : from === "assistant" ? "Assistant" : "System",
  jumpLabel: (unread, locale) => {
    if (unread <= 0) return "Jump to latest message"
    const n = new Intl.NumberFormat(locale).format(unread)
    const noun = new Intl.PluralRules(locale).select(unread) === "one" ? "message" : "messages"
    return `${n} new ${noun}, jump to latest`
  },
}
