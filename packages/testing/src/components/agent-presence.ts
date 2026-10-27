import { agentPresenceContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the only Agent Presence in `target`. */
export function getAgentPresence(target: Target, options?: DriverOptions) {
  return createDriverWith(agentPresenceContract, target, [], options)
}
