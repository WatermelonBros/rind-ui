"use client"

import { Button, Tooltip, type TooltipRootProps } from "@rind-ui/react"
import { type ReactNode, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { tooltip: { closed: "Basic", open: "Open" } }

/** A trigger with its tooltip: the parts every example repeats. */
function Tip({
  trigger,
  children,
  ...root
}: TooltipRootProps & { readonly trigger: ReactNode; readonly children: ReactNode }) {
  return (
    <Tooltip.Root {...root}>
      <Tooltip.Trigger>{trigger}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Content>
            {children}
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

const icon = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)
const bold = icon("M7 5h6a3.5 3.5 0 0 1 0 7H7zm0 7h7a3.5 3.5 0 0 1 0 7H7z")
const italic = icon("M10 5h8M6 19h8M15 5 9 19")
const underline = icon("M7 4v7a5 5 0 0 0 10 0V4M5 20h14")
const link = icon(
  "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
)

export function Basic() {
  return <Tip trigger="Save">Save the document (Ctrl+S)</Tip>
}

export function Open() {
  return (
    <Tip trigger="Save" defaultOpen>
      Save the document (Ctrl+S)
    </Tip>
  )
}

export function AsLabel() {
  return (
    <Tip trigger={bold} type="label">
      Bold
    </Tip>
  )
}

export function Group() {
  return (
    <div className="row">
      <Tip trigger={bold} type="label">
        Bold
      </Tip>
      <Tip trigger={italic} type="label">
        Italic
      </Tip>
      <Tip trigger={underline} type="label">
        Underline
      </Tip>
      <Tip trigger={link} type="label">
        Insert link
      </Tip>
    </div>
  )
}

export function Delays() {
  return (
    <div className="row">
      <Tip trigger="Default (700 ms)">Waits for the pointer to rest.</Tip>
      <Tip trigger="Quick (150 ms)" openDelay={150} closeDelay={100}>
        Opens almost at once.
      </Tip>
    </div>
  )
}

const sides = ["top", "inline-end", "bottom", "inline-start"] as const

export function Placement() {
  return (
    <div className="compass">
      {sides.map((side) => (
        <Tip key={side} trigger={side} positioning={{ side }} openDelay={0}>
          Placed {side}
        </Tip>
      ))}
    </div>
  )
}

export function Hoverable() {
  return (
    <Tip trigger="Shipping" openDelay={200}>
      Free over €50. The pointer can move onto this text: it stays open while you read it.
    </Tip>
  )
}

export function DisabledReason() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button disabled focusableWhenDisabled />}>Publish</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Content>
            Add a title before publishing
            <Tooltip.Arrow />
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("—")
  return (
    <div className="stack">
      <Tip
        trigger="Hover, focus or press me"
        open={open}
        onOpenChange={(next, details) => {
          setOpen(next)
          setReason(details.reason)
        }}
      >
        Every change says why.
      </Tip>
      <span className="note">
        open: {String(open)} · last reason: {reason}
      </span>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "A description: hover and rest, or Tab onto the button (no delay).",
  },
  AsLabel: {
    title: "As the label",
    description: '`type="label"`: the tooltip names an icon-only control.',
  },
  Group: {
    title: "Delay group",
    description: "After one closes, the next opens at once within `skipDelay`.",
  },
  Delays: { title: "Delays", description: "`openDelay` and `closeDelay`, in milliseconds." },
  Placement: { title: "Placement", description: "`positioning={{ side }}`; flips without room." },
  Hoverable: {
    title: "Hoverable content",
    description: "The pointer can travel onto the tooltip without it closing (WCAG 1.4.13).",
  },
  DisabledReason: {
    title: "On an unavailable control",
    description: "`focusableWhenDisabled` keeps the button reachable, so its tooltip shows.",
  },
  Controlled: {
    title: "Controlled",
    description: "`open` and `onOpenChange(open, details)` with `details.reason`.",
  },
  Open: { title: "Open", hidden: true },
}
