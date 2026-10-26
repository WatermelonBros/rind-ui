import type { agentPresenceConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { AgentPresenceRenderState } from "./types"

export const agentPresenceContext = createContext<{
  readonly api: () => ReturnType<typeof agentPresenceConnect>
  readonly state: () => AgentPresenceRenderState
  readonly registry: PartRegistry<"status">
  readonly statusId: () => string
}>("agent-presence")
