"use client"

import { Collapsible } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger>
        <Collapsible.Indicator>▸</Collapsible.Indicator>
        What does headless mean?
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pad">
          Behaviour, accessibility and state, with no styles. You bring the look.
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export function DefaultOpen() {
  return (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger>
        <Collapsible.Indicator>▸</Collapsible.Indicator>
        Starts open
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pad">Uncontrolled, but open on first render.</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(false)
  return (
    <div className="stack">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger>
          <Collapsible.Indicator>▸</Collapsible.Indicator>
          Details
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="pad">The parent owns the open state.</div>
        </Collapsible.Content>
      </Collapsible.Root>
      <div className="row">
        <button type="button" onClick={() => setOpen(!open)}>
          Toggle from outside
        </button>
        <span className="note">open: {String(open)}</span>
      </div>
    </div>
  )
}

export function Disabled() {
  return (
    <Collapsible.Root disabled>
      <Collapsible.Trigger>
        <Collapsible.Indicator>▸</Collapsible.Indicator>
        Not available
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pad">You cannot see this.</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export function ClosedContent() {
  return (
    <Collapsible.Root closedContent="unmount">
      <Collapsible.Trigger>
        <Collapsible.Indicator>▸</Collapsible.Indicator>
        Unmounted while closed
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pad">
          `closedContent="unmount"` removes this from the DOM. The default, `until-found`, keeps it
          searchable.
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  DefaultOpen: { title: "Default open", description: "`defaultOpen` starts it expanded." },
  Controlled: { title: "Controlled", description: "`open` and `onOpenChange`." },
  Disabled: { title: "Disabled", description: "`disabled` on the Root." },
  ClosedContent: {
    title: "Closed content",
    description: "`closedContent` is `until-found` (default), `hidden` or `unmount`.",
  },
}
