"use client"

import { Button } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  const [pending, setPending] = useState(false)
  const [count, setCount] = useState(0)
  return (
    <div className="row">
      <Button onPress={() => setCount((c) => c + 1)}>Pressed {count}×</Button>
      <Button
        pending={pending}
        onPress={() => {
          setPending(true)
          setTimeout(() => setPending(false), 1500)
        }}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button disabled>Disabled</Button>
    </div>
  )
}

export function Modality() {
  const [last, setLast] = useState("none yet")
  return (
    <div className="row">
      <Button onPress={({ modality }) => setLast(modality)}>Press me</Button>
      <span className="note">Last press: {last}</span>
    </div>
  )
}

export function Pending() {
  const [pending, setPending] = useState(false)
  return (
    <Button
      pending={pending}
      onPress={() => {
        setPending(true)
        setTimeout(() => setPending(false), 2000)
      }}
    >
      {pending ? "Saving…" : "Save"}
    </Button>
  )
}

export function Disabled() {
  return (
    <div className="row">
      <Button disabled>Disabled</Button>
      <Button disabled focusableWhenDisabled>
        Disabled, still focusable
      </Button>
    </div>
  )
}

export function PressLifecycle() {
  const [status, setStatus] = useState("Press and hold the button")
  return (
    <div className="stack">
      <Button
        onPressStart={() => setStatus("onPressStart: pressing…")}
        onPressEnd={() => setStatus("onPressEnd: released outside, no onPress (cancelled)")}
        onPress={() => setStatus("onPress: activated")}
      >
        Press and hold
      </Button>
      <span className="note">{status}</span>
    </div>
  )
}

export function AsLink() {
  return <Button render={<a href="/docs/" />}>Go to the docs</Button>
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Modality: {
    title: "Modality",
    description: "`onPress` reports how it was activated: pointer, keyboard, touch or virtual.",
  },
  Pending: {
    title: "Pending",
    description: "`pending` ignores activation but keeps focus, and announces its message.",
  },
  Disabled: {
    title: "Disabled",
    description: "`focusableWhenDisabled` keeps a disabled button in the Tab order.",
  },
  PressLifecycle: {
    title: "Press lifecycle",
    description:
      "`onPressStart` when the press begins; `onPress` only if it is released on the button. Drag off before releasing to cancel.",
  },
  AsLink: {
    title: "As a link",
    description: "`render` with an `<a href>` keeps link semantics.",
  },
}
