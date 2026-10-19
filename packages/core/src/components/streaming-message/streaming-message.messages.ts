// Streaming Message's strings: the lifecycle announcements (never a chunk of the text).

export interface StreamingMessageMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly started: string
  readonly completed: string
  readonly cancelled: string
  readonly failed: string
}

export const streamingMessageMessages: StreamingMessageMessages = {
  started: "Generating a response",
  completed: "Response complete",
  cancelled: "Response cancelled",
  failed: "The response failed",
}
