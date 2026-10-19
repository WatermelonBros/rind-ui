// Clipboard's strings: every text that reaches assistive technology (spec "Clipboard Messages").

export interface ClipboardMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The Trigger's name (with the Label after it, when rendered). */
  readonly copy: string
  /** Announced after a successful copy. */
  readonly copied: string
  /** Announced when the copy failed. */
  readonly copyFailed: string
}

export const clipboardMessages: ClipboardMessages = {
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
}
