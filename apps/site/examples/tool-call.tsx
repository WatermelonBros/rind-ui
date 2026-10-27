"use client"

import type { ToolCallStatus } from "@rind-ui/core"
import { ToolCall } from "@rind-ui/react"
import { useEffect, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "tool-call": { live: "Basic" } }

const json = (v: unknown) => <pre className="tool-json">{JSON.stringify(v, null, 2)}</pre>

export function Basic() {
  const [status, setStatus] = useState<ToolCallStatus>("running")
  useEffect(() => {
    if (status !== "running") return
    const t = setTimeout(() => setStatus("done"), 1800)
    return () => clearTimeout(t)
  }, [status])
  return (
    <div className="stack">
      <ToolCall.Root id="call_search" name="search_flights" status={status}>
        <ToolCall.Header>
          <ToolCall.Name /> <ToolCall.Status /> <ToolCall.Duration />
        </ToolCall.Header>
        <ToolCall.Content>
          <ToolCall.Input>{json({ from: "MXP", to: "LIS", date: "2026-11-14" })}</ToolCall.Input>
          {status === "done" && (
            <ToolCall.Output>{json({ flights: 3, cheapest: "€84" })}</ToolCall.Output>
          )}
        </ToolCall.Content>
      </ToolCall.Root>
      <button type="button" onClick={() => setStatus("running")}>
        Run again
      </button>
    </div>
  )
}

export function Approval() {
  const [status, setStatus] = useState<ToolCallStatus>("awaiting")
  return (
    <div className="stack">
      <ToolCall.Root
        id="call_delete"
        name="delete_files"
        status={status}
        risk="high"
        onDecision={async ({ approved }) => {
          await new Promise((r) => setTimeout(r, 700))
          setStatus(approved ? "done" : "denied")
        }}
      >
        <ToolCall.Header>
          <ToolCall.Name /> <ToolCall.Status />
        </ToolCall.Header>
        <ToolCall.Content>
          <ToolCall.Input>
            {json({ paths: ["drafts/old.md", "drafts/older.md", "tmp/"] })}
          </ToolCall.Input>
          <ToolCall.Approval>
            <ToolCall.ApprovalTitle>Delete 3 items?</ToolCall.ApprovalTitle>
            <ToolCall.ApprovalDescription>
              They will not be recoverable.
            </ToolCall.ApprovalDescription>
            <div className="row">
              <ToolCall.Approve />
              <ToolCall.Deny />
            </div>
            <ToolCall.Receipt />
          </ToolCall.Approval>
        </ToolCall.Content>
      </ToolCall.Root>
      <button type="button" onClick={() => setStatus("awaiting")}>
        Ask again
      </button>
    </div>
  )
}

export function Failed() {
  return (
    <ToolCall.Root id="call_fetch" name="fetch_page" status="error" defaultOpen>
      <ToolCall.Header>
        <ToolCall.Name /> <ToolCall.Status />
      </ToolCall.Header>
      <ToolCall.Content>
        <ToolCall.Error>Timed out after 30 s: https://example.com/slow</ToolCall.Error>
      </ToolCall.Content>
    </ToolCall.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Running, then done",
    description:
      'The Header is named "search_flights, running", then "done"; the duration is measured.',
  },
  Approval: {
    title: "Human approval",
    description:
      "One decision (a second press is ignored), the buttons busy while it is sent, the focus on the receipt after.",
  },
  Failed: {
    title: "Failed",
    description: "The status in words and by shape, never by colour alone; a failure is announced.",
  },
}
