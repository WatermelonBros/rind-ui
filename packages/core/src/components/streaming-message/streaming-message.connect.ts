// Streaming Message parts (add-streaming-message design §4): the Content is busy while the
// text grows or the reveal catches up, and is never a live region (the lifecycle is
// announced instead); the Caret is decorative and exists only while busy.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"

export type StreamingMessagePart = "root" | "content" | "caret"
export type StreamingMessageState =
  | "pending"
  | "streaming"
  | "settling"
  | "complete"
  | "cancelled"
  | "error"

export interface StreamingMessageConnectInput {
  readonly instance: string
  readonly state: StreamingMessageState
  /** The Content renders the text itself (no consumer renderer): keep its line breaks. */
  readonly plain: boolean
}

/** Streaming or catching up: busy, with a caret. */
export const streamingBusy = (state: StreamingMessageState) =>
  state === "streaming" || state === "settling"

export function streamingMessageConnect(input: StreamingMessageConnectInput) {
  const busy = streamingBusy(input.state)
  const part = (name: StreamingMessagePart): PartProps => ({
    ...scopeAttrs("streaming-message", name, input.instance),
    "data-state": input.state,
    "data-busy": dataFlag(busy),
  })
  return {
    busy,
    root: (): PartProps => part("root"),
    content: (): PartProps => ({
      ...part("content"),
      "aria-busy": busy ? "true" : undefined,
      ...(input.plain ? { style: { whiteSpace: "pre-wrap" } } : {}),
    }),
    caret: (): PartProps => ({ ...part("caret"), "aria-hidden": "true" }),
  }
}
