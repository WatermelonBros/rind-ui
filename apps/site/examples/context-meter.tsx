"use client"

import { ContextMeter } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "context-meter": { live: "Basic" } }

function Meter({ used, max }: { used: number; max: number | null }) {
  return (
    <ContextMeter.Root used={used} max={max}>
      <ContextMeter.Label>Context</ContextMeter.Label>
      <ContextMeter.Track>
        <ContextMeter.Indicator />
      </ContextMeter.Track>
      <ContextMeter.ValueText />
    </ContextMeter.Root>
  )
}

export function Basic() {
  return <Meter used={21_400} max={128_000} />
}

export function Thresholds() {
  const [used, setUsed] = useState(60_000)
  return (
    <div className="stack">
      <Meter used={used} max={100_000} />
      <div className="row">
        <button type="button" onClick={() => setUsed((u) => Math.min(u + 10_000, 120_000))}>
          Add 10K tokens
        </button>
        <button type="button" onClick={() => setUsed(20_000)}>
          Compact
        </button>
      </div>
    </div>
  )
}

export function Breakdown() {
  return (
    <ContextMeter.Root used={88_500} max={128_000}>
      <ContextMeter.Label>Context</ContextMeter.Label>
      <ContextMeter.Track>
        <ContextMeter.Indicator />
      </ContextMeter.Track>
      <ContextMeter.ValueText />
      <ContextMeter.Breakdown>
        <ContextMeter.BreakdownItem itemKey="system" label="System prompt" amount="4.2K" />
        <ContextMeter.BreakdownItem itemKey="messages" label="Messages" amount="71K" />
        <ContextMeter.BreakdownItem itemKey="tools" label="Tool results" amount="13.3K" />
      </ContextMeter.Breakdown>
    </ContextMeter.Root>
  )
}

export function UnknownWindow() {
  return <Meter used={3_200} max={null} />
}

export const variants: Variants = {
  Basic: {
    title: "Usage",
    description: 'A meter named "Context: 21K of 128K tokens, 17%".',
  },
  Thresholds: {
    title: "Thresholds",
    description:
      "Add tokens: crossing 75% and 95% is announced once; the stripes change with the zone, not only the colour.",
  },
  Breakdown: {
    title: "Breakdown",
    description:
      "Where the tokens went, as a description list (put it in a Popover to open on press).",
  },
  UnknownWindow: {
    title: "Unknown window",
    description: "Without a max: the usage as text, no meter role.",
  },
}
