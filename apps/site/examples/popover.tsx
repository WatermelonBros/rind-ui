"use client"

import { Button, Popover } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { popover: { closed: "Basic", open: "Open" } }

function Share({ defaultOpen }: { defaultOpen?: boolean }) {
  return (
    <Popover.Root {...(defaultOpen ? { defaultOpen } : {})}>
      <Popover.Trigger>
        Share <Popover.Indicator>▾</Popover.Indicator>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Title>Share this page</Popover.Title>
            <Popover.Description>Anyone with the link can view it.</Popover.Description>
            <input aria-label="Link" readOnly value="https://example.com/p/1" />
            <Popover.CloseTrigger>Done</Popover.CloseTrigger>
            <Popover.Arrow />
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Basic() {
  return <Share />
}

export function Open() {
  return <Share defaultOpen />
}

export function Toggletip() {
  return (
    <div className="row">
      <span>Card payments</span>
      <Popover.Root>
        <Popover.Trigger aria-label="About the fee">i</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content>A 2% fee applies to card payments.</Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("—")
  return (
    <div className="stack">
      <Popover.Root
        open={open}
        onOpenChange={(next, details) => {
          setOpen(next)
          setReason(details.reason)
        }}
      >
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Title>Filters</Popover.Title>
              <Popover.Description>
                Close with the button, Escape, a press or Tab outside: the reason changes.
              </Popover.Description>
              <Popover.CloseTrigger>Apply</Popover.CloseTrigger>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <span className="note">
        open: {String(open)} · last reason: {reason}
      </span>
    </div>
  )
}

export function Modal() {
  return (
    <Popover.Root modal>
      <Popover.Trigger>Rename</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Title>Rename file</Popover.Title>
            <label className="stack">
              Name
              <input defaultValue="report.pdf" />
            </label>
            <div className="row">
              <Popover.CloseTrigger>Cancel</Popover.CloseTrigger>
              <Popover.CloseTrigger>Save</Popover.CloseTrigger>
            </div>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

const sides = ["top", "inline-end", "bottom", "inline-start"] as const

export function Placement() {
  return (
    <div className="compass">
      {sides.map((side) => (
        <Popover.Root key={side} positioning={{ side }}>
          <Popover.Trigger>{side}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Content aria-label={`Placed ${side}`}>
                <p>
                  Placed <code>{side}</code>; flips when there is no room.
                </p>
                <Popover.Arrow />
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ))}
    </div>
  )
}

export function WithAnchor() {
  return (
    <Popover.Root positioning={{ side: "bottom", align: "start" }}>
      <div className="stack">
        <Popover.Anchor className="anchor-box">
          <span>Search field (the anchor)</span>
        </Popover.Anchor>
        <Popover.Trigger>Show tips</Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Title>Search tips</Popover.Title>
            <p>
              Quote a phrase for an exact match. The panel sits under the anchor, not the trigger.
            </p>
            <Popover.CloseTrigger>Got it</Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Nested() {
  return (
    <Popover.Root>
      <Popover.Trigger>Account</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Title>Account</Popover.Title>
            <Popover.Root positioning={{ side: "inline-end" }}>
              <Popover.Trigger>Status</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Content>
                    <Popover.Title>Status</Popover.Title>
                    <p>Escape closes only this one; Tab past the end returns to the parent.</p>
                    <Popover.CloseTrigger>Back</Popover.CloseTrigger>
                  </Popover.Content>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <Popover.CloseTrigger>Close</Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function KeepOpen() {
  const [vetoed, setVetoed] = useState(0)
  return (
    <div className="stack">
      <Popover.Root
        onInteractOutside={(event) => {
          event.preventDefault()
          setVetoed((n) => n + 1)
        }}
      >
        <Popover.Trigger>Draft note</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Title>Draft note</Popover.Title>
              <label className="stack">
                Note
                <input placeholder="Type, then click outside" />
              </label>
              <Popover.CloseTrigger>Close</Popover.CloseTrigger>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <span className="note">outside presses vetoed: {vetoed}</span>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="row">
      <Popover.Root disabled>
        <Popover.Trigger>Disabled</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Never shown">Never shown</Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Button disabled>Plain disabled button</Button>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Non-modal: Tab goes from the trigger into the panel, a press outside closes it.",
  },
  Toggletip: {
    title: "Toggletip",
    description: "No title: the content is named by its trigger.",
  },
  Controlled: {
    title: "Controlled",
    description: "`open` and `onOpenChange(open, details)`; `details.reason` says why.",
  },
  Modal: {
    title: "Modal",
    description: "`modal`: the outside is inert and Tab wraps inside the panel.",
  },
  Placement: {
    title: "Placement",
    description: "`positioning={{ side }}`, logical sides flip in right-to-left.",
  },
  WithAnchor: {
    title: "With an anchor",
    description: "`Popover.Anchor` positions the panel against another element.",
  },
  Nested: { title: "Nested", description: "A popover opened inside another is its child." },
  KeepOpen: {
    title: "Veto a dismissal",
    description: "`onInteractOutside` with `event.preventDefault()` keeps it open.",
  },
  Disabled: { title: "Disabled", description: "`disabled` makes the trigger inert." },
  Open: { title: "Open", hidden: true },
}
