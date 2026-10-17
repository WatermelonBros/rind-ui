"use client"

import { Drawer } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { drawer: { closed: "Basic", open: "Open" } }

const FILTERS = ["In stock", "On sale", "Free shipping", "New arrivals", "Top rated"]

function Filters({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Drawer.Root defaultOpen={defaultOpen}>
      <Drawer.Trigger>Filters</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Handle />
            <Drawer.Title>Filters</Drawer.Title>
            <Drawer.Description>Narrow the product list.</Drawer.Description>
            <ul className="stack">
              {FILTERS.map((f) => (
                <li key={f}>
                  <label className="row">
                    <input type="checkbox" /> {f}
                  </label>
                </li>
              ))}
            </ul>
            <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export function Basic() {
  return <Filters />
}

export function Open() {
  return <Filters defaultOpen />
}

export function Side() {
  return (
    <Drawer.Root side="inline-end">
      <Drawer.Trigger>Settings</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Title>Settings</Drawer.Title>
            <Drawer.Description>
              A panel at the end edge; swipe it toward that edge to close.
            </Drawer.Description>
            <label className="stack">
              Display name
              <input defaultValue="Ada Lovelace" />
            </label>
            <Drawer.CloseTrigger>Close</Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export function SnapPoints() {
  return (
    <Drawer.Root snapPoints={[0.4, 1]}>
      <Drawer.Trigger>Directions</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Handle />
            <Drawer.Title>Directions</Drawer.Title>
            <Drawer.Description>
              Drag between 40 % and full height, or press the handle.
            </Drawer.Description>
            <Drawer.CloseTrigger>Close</Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("—")
  return (
    <div className="stack">
      <Drawer.Root
        open={open}
        onOpenChange={(next, details) => {
          setOpen(next)
          setReason(details.reason)
        }}
      >
        <Drawer.Trigger>Cart</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Title>Cart</Drawer.Title>
              <Drawer.Description>
                Swipe it down, press Escape or Done: the reason changes.
              </Drawer.Description>
              <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Portal>
      </Drawer.Root>
      <span className="note">
        open: {String(open)} · last reason: {reason}
      </span>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Bottom sheet",
    description:
      "A modal dialog at the bottom edge: swipe down, Escape, the backdrop or Done close it.",
  },
  Open: {
    title: "Open",
    description: "`defaultOpen`: the open state, with its handle.",
    hidden: true,
  },
  Side: {
    title: "Side panel",
    description: '`side="inline-end"`: the end edge in either direction.',
  },
  SnapPoints: {
    title: "Snap points",
    description: "`snapPoints={[0.4, 1]}`: the handle becomes a button that cycles them.",
  },
  Controlled: {
    title: "Controlled",
    description:
      '`open` and `onOpenChange(open, details)`: `details.reason` is `"swipe"` after a swipe.',
  },
}
