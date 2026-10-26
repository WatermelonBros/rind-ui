// Agent Presence parts (add-agent-presence design §3, §5): no role on the Root; the Visual is
// decoration (aria-hidden); the Status is plain text, not a live region (the announcements are
// the Announcer's, chosen per transition).

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import type { AgentState } from "./agent-presence.machine"
import type { AgentPresenceMessages } from "./agent-presence.messages"

export type AgentPresencePart = "root" | "visual" | "status" | "label" | "detail"

export interface AgentPresenceConnectInput {
  readonly instance: string
  readonly state: AgentState
  readonly previous: AgentState | null
  readonly stale: boolean
  readonly muted: boolean
  readonly motion: "full" | "reduced" | "off"
  readonly reason?: string | undefined
  readonly messages: AgentPresenceMessages
}

export function agentPresenceConnect(input: AgentPresenceConnectInput) {
  const base = (part: AgentPresencePart): PartProps => ({
    ...scopeAttrs("agent-presence", part, input.instance),
    "data-state": input.state,
    "data-previous-state": input.previous ?? undefined,
    "data-muted": dataFlag(input.muted),
    "data-stale": dataFlag(input.stale),
    "data-motion": input.motion,
  })
  return {
    statusText: input.messages.status(input.state),
    /** The level loop runs: listening (input) or speaking (output), motion allowed. */
    levelChannel:
      input.motion === "full"
        ? input.state === "listening"
          ? ("input" as const)
          : input.state === "speaking"
            ? ("output" as const)
            : null
        : null,
    root: (): PartProps => ({ ...base("root"), "data-level": "0" }),
    visual: (): PartProps => ({ ...base("visual"), "aria-hidden": "true" }),
    status: (): PartProps => base("status"),
    /** The Status the Root renders when none is composed. */
    hiddenStatus: (): PartProps => ({ ...base("status"), style: visuallyHiddenStyle }),
    label: (): PartProps => base("label"),
    detail: (): PartProps => ({ ...base("detail"), "data-reason": input.reason }),
  }
}

export type AgentPresenceApi = ReturnType<typeof agentPresenceConnect>
