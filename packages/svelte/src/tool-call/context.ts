import type { ToolCallEvent, toolCallConnect } from "@rind-ui/core"
import { createContext } from "../context"
import type { ToolCallRenderState } from "./types"

export const toolCallContext = createContext<{
  readonly api: () => ReturnType<typeof toolCallConnect>
  readonly send: (event: ToolCallEvent) => void
  readonly state: () => ToolCallRenderState
  readonly name: () => string
  readonly approvalEl: { current: HTMLElement | null }
  readonly receiptEl: { current: HTMLElement | null }
  readonly approveEl: { current: HTMLElement | null }
}>("tool-call")

/** Keeps `slot.current` on the attached element. */
export const keep = (slot: { current: HTMLElement | null }) => (node: HTMLElement) => {
  slot.current = node
  return () => {
    if (slot.current === node) slot.current = null
  }
}
