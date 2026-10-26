// Message Actions' strings (spec "Message Actions Messages"); Copy's states use Clipboard's.

export interface MessageActionsMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly label: string
  readonly copy: string
  readonly regenerate: string
  readonly edit: string
  readonly feedback: string
  readonly up: string
  readonly down: string
  readonly versions: string
  readonly previous: string
  readonly next: string
  /** Announced on a move between versions, and the status's spoken form. */
  readonly version: (position: number, count: number) => string
}

export const messageActionsMessages: MessageActionsMessages = {
  label: "Message actions",
  copy: "Copy",
  regenerate: "Regenerate",
  edit: "Edit",
  feedback: "Feedback",
  up: "Good response",
  down: "Bad response",
  versions: "Versions",
  previous: "Previous version",
  next: "Next version",
  version: (position, count) => `Version ${position} of ${count}`,
}
