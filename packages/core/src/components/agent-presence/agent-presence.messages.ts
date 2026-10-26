// Agent Presence's strings (spec "Agent Presence Messages").

import type { AgentState } from "./agent-presence.machine"

export interface AgentPresenceMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The Status text per state. */
  readonly status: (state: AgentState) => string
  /** The first listening of a session. */
  readonly listening: string
  /** A think that lasted `thinkingDelay`. */
  readonly thinking: string
  /** Back to idle after a session. */
  readonly ended: string
  readonly error: (reason: string | undefined) => string
}

export const agentPresenceMessages: AgentPresenceMessages = {
  status: (state) =>
    ({
      idle: "Idle",
      connecting: "Connecting",
      listening: "Listening",
      thinking: "Thinking",
      speaking: "Speaking",
      error: "Error",
    })[state],
  listening: "Listening",
  thinking: "Thinking",
  ended: "Conversation ended",
  error: (reason) => (reason ? `Connection error: ${reason}` : "Connection error"),
}
