"use client"

// Ported from apps/storybook/stories/Switch.stories.tsx
import { Switch } from "@rind-ui/react"
import { type ComponentProps, useState } from "react"
import type { States, Variants } from "../types"

export const states: States = {
  switch: { unchecked: "Default", checked: "Checked" },
}

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const

/** Control + Thumb + Label (+ Description), the usual composition. */
function Toggle({
  label,
  description,
  ...root
}: { label: string; description?: string } & Omit<ComponentProps<typeof Switch.Root>, "children">) {
  return (
    <Switch.Root {...root}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>{label}</Switch.Label>
      {description && <Switch.Description>{description}</Switch.Description>}
    </Switch.Root>
  )
}

export function Default() {
  return <Toggle label="Wi-Fi" />
}

export function Checked() {
  return <Toggle label="Wi-Fi" defaultChecked />
}

export function Disabled() {
  return (
    <div style={column}>
      <Toggle label="Disabled off" disabled />
      <Toggle label="Disabled on" disabled defaultChecked />
    </div>
  )
}

export function FocusableWhenDisabled() {
  return <Toggle label="Focusable when disabled" disabled focusableWhenDisabled />
}

export function ReadOnly() {
  return <Toggle label="Read only" readOnly defaultChecked />
}

export function WithDescriptionStory() {
  return (
    <Toggle
      label="Airplane mode"
      description="Turns off all wireless connections."
      defaultChecked
    />
  )
}

export function InFormStory() {
  const [data, setData] = useState("(nothing submitted)")
  return (
    <form
      aria-label="Settings"
      style={column}
      onSubmit={(e) => {
        e.preventDefault()
        setData(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))
      }}
    >
      <Toggle label="Notifications" name="notifications" value="yes" defaultChecked />
      <Toggle label="Sounds" name="sounds" uncheckedValue="no" />
      <div style={{ display: "flex", gap: "var(--rind-space-2)" }}>
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
      </div>
      <output>{data}</output>
    </form>
  )
}

export function RTL() {
  return (
    <div dir="rtl" style={column}>
      <Toggle label="Off" />
      <Toggle label="On" defaultChecked />
    </div>
  )
}

/** The driver toggles it the way a user would: pointer, then Space, then the label. */
export function DriverExample() {
  return <Toggle label="Driven" />
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  Checked: { title: "Checked", hidden: true },
  Disabled: { title: "Disabled", hidden: true },
  FocusableWhenDisabled: { title: "Focusable when disabled", hidden: true },
  ReadOnly: { title: "Read only", hidden: true },
  WithDescriptionStory: { title: "With description", hidden: true },
  InFormStory: { title: "In form", hidden: true },
  RTL: { title: "RTL", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
