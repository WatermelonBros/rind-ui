"use client"

// Ported from apps/storybook/stories/Toggle.stories.tsx
import { Toggle } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "../types"

export const states: States = { toggle: { off: "Default", on: "On" } }

const row = {
  display: "flex",
  gap: "var(--rind-space-3)",
  alignItems: "center",
  flexWrap: "wrap",
} as const

export function Default() {
  return <Toggle.Root>Bold</Toggle.Root>
}

export function On() {
  return <Toggle.Root defaultPressed>Bold</Toggle.Root>
}

export function DisabledStory() {
  return (
    <div style={row}>
      <Toggle.Root disabled>Off</Toggle.Root>
      <Toggle.Root disabled defaultPressed>
        On
      </Toggle.Root>
    </div>
  )
}

export function FocusableWhenDisabled() {
  return (
    <Toggle.Root disabled focusableWhenDisabled>
      Italic
    </Toggle.Root>
  )
}

/** The name stays "Mute"; only the icon (aria-hidden) and aria-pressed follow the state. */
export function IconOnly() {
  return (
    <Toggle.Root aria-label="Mute">
      <Toggle.Indicator fallback="🔊">🔇</Toggle.Indicator>
    </Toggle.Root>
  )
}

export function ControlledStory() {
  const [pressed, setPressed] = useState(false)
  return (
    <div style={row}>
      <Toggle.Root pressed={pressed} onPressedChange={setPressed}>
        Bold
      </Toggle.Root>
      <p>{pressed ? "On" : "Off"}</p>
      <button type="button" onClick={() => setPressed((p) => !p)}>
        Toggle from outside
      </button>
    </div>
  )
}

/** The driver presses it the way a user would: pointer, then Space, then Enter. */
export function DriverExample() {
  return <Toggle.Root>Driven</Toggle.Root>
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  On: { title: "On", hidden: true },
  DisabledStory: { title: "Disabled", hidden: true },
  FocusableWhenDisabled: { title: "Focusable when disabled", hidden: true },
  IconOnly: { title: "Icon only", hidden: true },
  ControlledStory: { title: "Controlled", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
