"use client"

import { Button, SegmentedControl } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <SegmentedControl.Root aria-label="Range" defaultValue="week">
      <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
      <SegmentedControl.Item value="week">Week</SegmentedControl.Item>
      <SegmentedControl.Item value="month">Month</SegmentedControl.Item>
      <SegmentedControl.Indicator />
    </SegmentedControl.Root>
  )
}

export function WithLabel() {
  return (
    <SegmentedControl.Root defaultValue="list">
      <SegmentedControl.Label>Layout</SegmentedControl.Label>
      <SegmentedControl.Item value="list">List</SegmentedControl.Item>
      <SegmentedControl.Item value="grid">Grid</SegmentedControl.Item>
      <SegmentedControl.Item value="board">Board</SegmentedControl.Item>
      <SegmentedControl.Indicator />
    </SegmentedControl.Root>
  )
}

export function Controlled() {
  const [value, setValue] = useState<string | null>("light")
  return (
    <div className="stack">
      <SegmentedControl.Root aria-label="Theme" value={value} onValueChange={setValue}>
        <SegmentedControl.Item value="light">Light</SegmentedControl.Item>
        <SegmentedControl.Item value="dark">Dark</SegmentedControl.Item>
        <SegmentedControl.Item value="system">System</SegmentedControl.Item>
        <SegmentedControl.Indicator />
      </SegmentedControl.Root>
      <span className="note">value: {value ?? "none"}</span>
    </div>
  )
}

export function DisabledItem() {
  return (
    <SegmentedControl.Root aria-label="Plan" defaultValue="monthly">
      <SegmentedControl.Item value="monthly">Monthly</SegmentedControl.Item>
      <SegmentedControl.Item value="yearly">Yearly</SegmentedControl.Item>
      <SegmentedControl.Item value="lifetime" disabled>
        Lifetime
      </SegmentedControl.Item>
      <SegmentedControl.Indicator />
    </SegmentedControl.Root>
  )
}

export function InForm() {
  const [sent, setSent] = useState("Submit to see the form data")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(`speed=${new FormData(e.currentTarget).get("speed") ?? "—"}`)
      }}
    >
      <SegmentedControl.Root aria-label="Speed" name="speed" defaultValue="1x">
        <SegmentedControl.Item value="0.5x">0.5×</SegmentedControl.Item>
        <SegmentedControl.Item value="1x">1×</SegmentedControl.Item>
        <SegmentedControl.Item value="2x">2×</SegmentedControl.Item>
        <SegmentedControl.Indicator />
      </SegmentedControl.Root>
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
      </div>
      <span className="note">{sent}</span>
    </form>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "One choice from a few; the Indicator slides to it." },
  WithLabel: {
    title: "With a label",
    description: "`SegmentedControl.Label` names the group instead of `aria-label`.",
  },
  Controlled: { title: "Controlled", description: "`value` and `onValueChange`." },
  DisabledItem: { title: "Disabled item", description: "Arrow keys skip a `disabled` segment." },
  InForm: {
    title: "In a form",
    description: "`name` submits the selected value; reset restores `defaultValue`.",
  },
}
