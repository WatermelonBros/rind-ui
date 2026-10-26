"use client"

import type { AgentState } from "@rind-ui/core"
import { AgentPresence } from "@rind-ui/react"
import { useRef, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "agent-presence": { live: "Basic" } }

const STATES: readonly AgentState[] = [
  "idle",
  "connecting",
  "listening",
  "thinking",
  "speaking",
  "error",
]

/** A fake level: a slow swell plus noise, as a microphone would give. */
function useFakeLevel() {
  const t0 = useRef(Date.now())
  return () => {
    const t = (Date.now() - t0.current) / 1000
    return Math.min(1, Math.max(0, 0.45 + 0.35 * Math.sin(t * 3.1) + 0.2 * Math.sin(t * 11.7)))
  }
}

export function Basic() {
  const [state, setState] = useState<AgentState>("listening")
  const level = useFakeLevel()
  return (
    <div className="stack presence-demo">
      <AgentPresence.Root state={state} getLevel={level} reason="microphone unavailable">
        <AgentPresence.Visual />
        <AgentPresence.Label>Assistant</AgentPresence.Label>
        <AgentPresence.Status />
        {state === "error" && <AgentPresence.Detail>Microphone unavailable</AgentPresence.Detail>}
      </AgentPresence.Root>
      <fieldset className="row presence-states">
        <legend className="note">Simulate a state</legend>
        {STATES.map((s) => (
          <button key={s} type="button" aria-pressed={s === state} onClick={() => setState(s)}>
            {s}
          </button>
        ))}
      </fieldset>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Voice assistant",
    description:
      "The orb follows the level while listening and speaking; the state is spoken once per change; thinking shows after a short delay.",
  },
}
