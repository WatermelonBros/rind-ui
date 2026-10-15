"use client"

import { Button, TextField } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <TextField.Root name="handle" required>
      <TextField.Label>Handle</TextField.Label>
      <TextField.Input placeholder="@you" maxLength={20} />
      <TextField.Description>Up to 20 characters.</TextField.Description>
      <TextField.ErrorMessage />
    </TextField.Root>
  )
}

export function Controlled() {
  const [value, setValue] = useState("Hello")
  return (
    <div className="stack">
      <TextField.Root value={value} onValueChange={setValue}>
        <TextField.Label>Greeting</TextField.Label>
        <TextField.Input />
      </TextField.Root>
      <div className="row">
        <Button type="button" onClick={() => setValue("")}>
          Empty
        </Button>
        <span className="note">Value: {value}</span>
      </div>
    </div>
  )
}

export function ClearTrigger() {
  return (
    <TextField.Root defaultValue="rind">
      <TextField.Label>Search</TextField.Label>
      <TextField.Input />
      <TextField.ClearTrigger />
    </TextField.Root>
  )
}

export function CharacterCount() {
  return (
    <div className="stack">
      <TextField.Root defaultValue="Hello">
        <TextField.Label>Handle</TextField.Label>
        <TextField.Input maxLength={12} />
        <TextField.CharacterCount />
      </TextField.Root>
      <TextField.Root defaultValue="This bio is a little too long">
        <TextField.Label>Bio</TextField.Label>
        <TextField.Textarea rows={2} />
        <TextField.CharacterCount max={20} />
      </TextField.Root>
    </div>
  )
}

export function AutosizeTextarea() {
  return (
    <TextField.Root>
      <TextField.Label>Message</TextField.Label>
      <TextField.Textarea autosize rows={2} placeholder="Write something long" />
    </TextField.Root>
  )
}

export function Validation() {
  return (
    <TextField.Root
      name="email"
      required
      validationMode="blur"
      validate={(value) => (String(value).endsWith("@example.com") ? "Use a real address." : null)}
    >
      <TextField.Label>Email</TextField.Label>
      <TextField.Input type="email" />
      <TextField.Description>example.com addresses are rejected.</TextField.Description>
      <TextField.ErrorMessage />
    </TextField.Root>
  )
}

export function DisabledAndReadOnly() {
  return (
    <div className="stack">
      <TextField.Root disabled defaultValue="Locked">
        <TextField.Label>Disabled</TextField.Label>
        <TextField.Input />
      </TextField.Root>
      <TextField.Root readOnly defaultValue="Copy me">
        <TextField.Label>Read-only</TextField.Label>
        <TextField.Input />
      </TextField.Root>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Controlled: {
    title: "Controlled value",
    description: "`value` and `onValueChange` drive the input from state.",
  },
  ClearTrigger: {
    title: "Clear trigger",
    description:
      "`TextField.ClearTrigger` appears once there is text and keeps focus in the input.",
  },
  CharacterCount: {
    title: "Character count",
    description: "`maxLength` is a hard limit; `max` on `CharacterCount` is a soft one.",
  },
  AutosizeTextarea: {
    title: "Autosize textarea",
    description: "`autosize` grows the textarea with its content, starting from `rows`.",
  },
  Validation: {
    title: "Validation",
    description: "The Root takes Field props: `required`, `validate`, `validationMode`.",
  },
  DisabledAndReadOnly: {
    title: "Disabled and read-only",
    description: "`disabled` and `readOnly` apply to the input.",
  },
}
