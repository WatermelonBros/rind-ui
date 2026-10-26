// Tool Call's strings (spec "Tool Call Messages").

import type { ToolCallStatus } from "./tool-call.machine"

export interface ToolCallMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** A word per status, in the Header's name ("search_flights, running"). */
  readonly status: (status: ToolCallStatus) => string
  readonly awaiting: (name: string) => string
  readonly failed: (name: string) => string
  readonly approve: string
  readonly deny: string
  /** The Receipt after a decision. */
  readonly approved: string
  readonly denied: string
  readonly expired: string
  readonly duration: (seconds: number) => string
}

export const toolCallMessages: ToolCallMessages = {
  status: (status) =>
    ({
      pending: "pending",
      running: "running",
      awaiting: "awaiting approval",
      done: "done",
      error: "failed",
      denied: "denied",
      cancelled: "cancelled",
    })[status],
  awaiting: (name) => `${name} needs your approval`,
  failed: (name) => `${name} failed`,
  approve: "Approve",
  deny: "Deny",
  approved: "Approved",
  denied: "Denied",
  expired: "Request expired",
  duration: (s) => `${Math.round(s * 10) / 10} ${s === 1 ? "second" : "seconds"}`,
}
