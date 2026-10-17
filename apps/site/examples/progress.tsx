"use client"

import { Button, Progress, type ProgressRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** One machine state: the value is a prop, so every look is a prop away from Basic. */
export const states: States = { progress: { idle: "Basic" } }

function Bar({ label, ...props }: ProgressRootProps & { readonly label: string }) {
  return (
    <Progress.Root {...props}>
      <Progress.Label>{label}</Progress.Label>
      <Progress.ValueText />
      <Progress.Track>
        <Progress.Indicator />
      </Progress.Track>
    </Progress.Root>
  )
}

export function Basic() {
  return <Bar label="Uploading" value={40} />
}

export function Indeterminate() {
  return <Bar label="Connecting" value={null} />
}

export function Complete() {
  return <Bar label="Backup" value={100} />
}

export function CustomRange() {
  return (
    <Bar
      label="Downloaded"
      value={3.2}
      max={8}
      formatOptions={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }}
      messages={{ valueText: ({ formatted }) => `${formatted} of 8 GB` }}
    />
  )
}

function Ring({ label, ...props }: ProgressRootProps & { readonly label: string }) {
  return (
    <Progress.Root {...props} aria-label={label}>
      <Progress.Circle>
        <Progress.CircleTrack />
        <Progress.CircleIndicator />
      </Progress.Circle>
      <Progress.ValueText />
    </Progress.Root>
  )
}

export function Rings() {
  return (
    <div className="row">
      <Ring label="Sync" value={25} />
      <Ring label="Indexing" value={null} />
    </div>
  )
}

export function Vertical() {
  return <Bar label="Level" value={60} orientation="vertical" />
}

export function AnnounceCompletion() {
  const [value, setValue] = useState(40)
  return (
    <div className="stack">
      <Bar label="Uploading" value={value} announceCompletion />
      <Button onPress={() => setValue((v) => (v >= 100 ? 40 : Math.min(v + 30, 100)))}>
        {value >= 100 ? "Start again" : "Advance"}
      </Button>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Named by its Label; the value text is `aria-valuetext`, never the name.",
  },
  Indeterminate: {
    title: "Indeterminate",
    description:
      "`value={null}`: no `aria-valuenow`, a sliding segment (still under reduced motion).",
  },
  Complete: { title: "Complete", description: '`value` equals `max`: `data-state="complete"`.' },
  CustomRange: {
    title: "Custom range and units",
    description: "`max={8}` and a unit format: `aria-valuenow` stays in your units.",
  },
  Rings: {
    title: "Ring",
    description:
      "Circle parts on a `pathLength` of 100: no radius maths. Indeterminate spins an arc.",
  },
  Vertical: { title: "Vertical", description: '`orientation="vertical"` fills the block size.' },
  AnnounceCompletion: {
    title: "Announce completion",
    description: '`announceCompletion` says "Complete" once when the value reaches `max`.',
  },
}
