// Reasoning's strings: the Trigger's text and the lifecycle announcements (never the trace).

export interface ReasoningMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** While the model thinks. */
  readonly thinking: string
  /** After it: the duration in seconds, or null when unknown. */
  readonly thought: (seconds: number | null, locale: string) => string
}

export const reasoningMessages: ReasoningMessages = {
  thinking: "Thinking…",
  thought: (seconds, locale) => {
    if (seconds === null) return "Thought for a few seconds"
    const n = new Intl.NumberFormat(locale).format(seconds)
    return `Thought for ${n} ${new Intl.PluralRules(locale).select(seconds) === "one" ? "second" : "seconds"}`
  },
}
