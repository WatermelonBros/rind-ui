"use client"

import { Meter, type MeterRootProps } from "@rind-ui/react"
import type { States, Variants } from "./types"

/** One machine state: the value is a prop, so every zone is a prop away from Basic. */
export const states: States = { meter: { idle: "Basic" } }

function Bar({ label, ...props }: MeterRootProps & { readonly label: string }) {
  return (
    <Meter.Root {...props}>
      <Meter.Label>{label}</Meter.Label>
      <Meter.ValueText />
      <Meter.Track>
        <Meter.Indicator />
      </Meter.Track>
    </Meter.Root>
  )
}

export function Basic() {
  return <Bar label="Storage" value={75} />
}

export function Units() {
  return (
    <Bar
      label="Storage"
      value={96}
      max={128}
      formatOptions={{ style: "unit", unit: "gigabyte" }}
      messages={{ valueText: ({ formatted }) => `${formatted} of 128 GB` }}
    />
  )
}

/** The zone is said in the value text: colour alone never carries it. */
const withZone: NonNullable<MeterRootProps["messages"]> = {
  valueText: ({ formatted, zone }) =>
    zone === "even-less-good"
      ? `${formatted}, low`
      : zone === "suboptimum"
        ? `${formatted}, fair`
        : formatted,
}

export function Battery() {
  return (
    <div className="stack">
      {(
        [
          ["Laptop", 90],
          ["Phone", 50],
          ["Watch", 10],
        ] as const
      ).map(([label, value]) => (
        <Bar
          key={label}
          label={label}
          value={value}
          low={20}
          high={80}
          optimum={100}
          messages={withZone}
        />
      ))}
    </div>
  )
}

export function LowerIsBetter() {
  return (
    <div className="stack">
      {(
        [
          ["System", 10],
          ["Media", 70],
          ["Backups", 95],
        ] as const
      ).map(([label, value]) => (
        <Bar key={label} label={label} value={value} low={60} high={90} optimum={0} />
      ))}
    </div>
  )
}

export function Vertical() {
  return <Bar label="Signal" value={60} orientation="vertical" />
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: '`role="meter"`, named by its Label; the value text is never the name.',
  },
  Units: {
    title: "Units",
    description: "A unit format reads the value, not the percent: `aria-valuenow` stays in GB.",
  },
  Battery: {
    title: "Zones: higher is better",
    description:
      "`low`, `high` and `optimum` give each bar a `data-zone`, said in the value text too.",
  },
  LowerIsBetter: {
    title: "Zones: lower is better",
    description: "`optimum={0}`: the full disk is the bad zone.",
  },
  Vertical: { title: "Vertical", description: '`orientation="vertical"` fills the block size.' },
}
