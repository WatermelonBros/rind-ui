// Alert's strings: the icon-only CloseTrigger's name and how the announced text is joined.

export interface AlertMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The name of a CloseTrigger with no text and no name of its own. */
  readonly dismiss: string
  /** Joins the announced segments (Icon label, Title, Description) into one message. */
  readonly announcement: (segments: readonly string[]) => string
}

/** Sentence-final punctuation (Latin, CJK full stops, Arabic and Devanagari marks, ellipsis). */
const TERMINAL = /[.!?…。！？؟।]$/u

export const alertMessages: AlertMessages = {
  dismiss: "Dismiss",
  // English: each segment ends a sentence ("Error. Couldn't save. Disk full.").
  announcement: (segments) =>
    segments
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (TERMINAL.test(s) ? s : `${s}.`))
      .join(" "),
}
