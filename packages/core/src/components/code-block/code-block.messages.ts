// Code Block's strings: every text that reaches assistive technology (spec "Messages").

export interface CodeBlockMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** Content's name when there is no Title. */
  readonly label: string
  /** CopyTrigger's name when it has no content. */
  readonly copy: string
  /** Announced after a successful copy. */
  readonly copied: string
  /** Announced when the copy failed. */
  readonly copyFailed: string
  /** WrapTrigger's name when it has no content. */
  readonly wrap: string
  /** CollapseTrigger's name when it has no content. */
  readonly expand: string
  /** Content's description when lines are highlighted: runs of 1-based line numbers. */
  readonly highlighted: (runs: readonly (readonly [number, number])[]) => string
}

export const codeBlockMessages: CodeBlockMessages = {
  label: "Code",
  copy: "Copy code",
  copied: "Copied",
  copyFailed: "Copy failed",
  wrap: "Wrap lines",
  expand: "Show all lines",
  highlighted: (runs) =>
    `Highlighted lines: ${runs.map(([a, b]) => (a === b ? `${a}` : `${a} to ${b}`)).join(", ")}`,
}
