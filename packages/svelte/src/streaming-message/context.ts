import { createContext } from "../context"
import type { StreamingMessageRenderState } from "./types"

export const streamingMessage = createContext<{
  readonly state: () => StreamingMessageRenderState
  readonly instance: () => string
}>("streaming-message")
