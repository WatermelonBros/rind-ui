import type { ReasoningEvent, reasoningConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { ReasoningRenderState } from "./types"

export const reasoning = createContext<{
  readonly api: () => ReturnType<typeof reasoningConnect>
  readonly state: () => ReasoningRenderState
  readonly send: (event: ReasoningEvent) => void
  readonly content: { current: Element | null }
}>("reasoning")
