"use client"

import { Button, Switch } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="stack">
      <Switch.Root defaultChecked>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Wi-Fi</Switch.Label>
      </Switch.Root>
      <Switch.Root>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Bluetooth</Switch.Label>
      </Switch.Root>
    </div>
  )
}

export function Controlled() {
  const [checked, setChecked] = useState(false)
  return (
    <div className="stack">
      <Switch.Root checked={checked} onCheckedChange={setChecked}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Dark mode</Switch.Label>
      </Switch.Root>
      <span className="note">checked: {String(checked)}</span>
    </div>
  )
}

export function WithDescription() {
  return (
    <Switch.Root defaultChecked>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>Auto-join</Switch.Label>
      <Switch.Description>Connect to known networks automatically.</Switch.Description>
    </Switch.Root>
  )
}

export function DisabledAndReadOnly() {
  return (
    <div className="stack">
      <Switch.Root disabled>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Disabled</Switch.Label>
      </Switch.Root>
      <Switch.Root readOnly defaultChecked>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Read-only</Switch.Label>
      </Switch.Root>
    </div>
  )
}

export function InForm() {
  const [sent, setSent] = useState("")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(new URLSearchParams(new FormData(e.currentTarget) as never).toString())
      }}
    >
      <Switch.Root name="newsletter" uncheckedValue="no" value="yes">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Newsletter</Switch.Label>
      </Switch.Root>
      <div className="row">
        <Button type="submit">Submit</Button>
        <span className="note">{sent || "Submit to see the form data"}</span>
      </div>
    </form>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Controlled: { title: "Controlled", description: "`checked` and `onCheckedChange`." },
  WithDescription: {
    title: "With description",
    description: "`Switch.Description` is part of the control's accessible description.",
  },
  DisabledAndReadOnly: {
    title: "Disabled and read-only",
    description:
      "`disabled` takes it out of the form; `readOnly` keeps it focusable and submitted.",
  },
  InForm: {
    title: "In a form",
    description:
      "A hidden input submits `value` while on; `uncheckedValue` submits a value while off.",
  },
}
