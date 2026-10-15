"use client"

import { Toggle } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <div className="row">
      <Toggle.Root defaultPressed>Bold</Toggle.Root>
      <Toggle.Root>Italic</Toggle.Root>
      <Toggle.Root>Underline</Toggle.Root>
    </div>
  )
}

export function Controlled() {
  const [pressed, setPressed] = useState(false)
  return (
    <div className="row">
      <Toggle.Root pressed={pressed} onPressedChange={setPressed}>
        Mute
      </Toggle.Root>
      <span className="note">{pressed ? "Muted" : "Sound on"}</span>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="row">
      <Toggle.Root disabled>Disabled</Toggle.Root>
      <Toggle.Root disabled defaultPressed>
        Disabled, pressed
      </Toggle.Root>
      <Toggle.Root disabled focusableWhenDisabled>
        Still focusable
      </Toggle.Root>
    </div>
  )
}

export function Indicator() {
  return (
    <Toggle.Root aria-label="Favorite">
      <Toggle.Indicator fallback="☆">★</Toggle.Indicator>
    </Toggle.Root>
  )
}

export function Events() {
  const [log, setLog] = useState<boolean[]>([])
  return (
    <div className="stack">
      <Toggle.Root onPressedChange={(pressed) => setLog((l) => [...l.slice(-4), pressed])}>
        Notifications
      </Toggle.Root>
      <span className="note">
        {log.map((p) => (p ? "on" : "off")).join(", ") || "No changes yet"}
      </span>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Controlled: {
    title: "Controlled",
    description: "`pressed` with `onPressedChange` keeps the state in your component.",
  },
  Disabled: {
    title: "Disabled",
    description: "`disabled` blocks toggling; `focusableWhenDisabled` keeps it in the Tab order.",
  },
  Indicator: {
    title: "Indicator",
    description: "`Toggle.Indicator` shows its children while pressed and `fallback` otherwise.",
  },
  Events: {
    title: "Change events",
    description: "`onPressedChange` receives the new value on every change.",
  },
}
