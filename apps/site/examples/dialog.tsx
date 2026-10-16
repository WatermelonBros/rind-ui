"use client"

import { Button, Dialog } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Edit profile</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Edit profile</Dialog.Title>
            <Dialog.Description>Change how your name appears to others.</Dialog.Description>
            <label className="stack">
              Display name
              <input defaultValue="Ada Lovelace" />
            </label>
            <div className="row">
              <Dialog.CloseTrigger>Cancel</Dialog.CloseTrigger>
              <Dialog.CloseTrigger>Save</Dialog.CloseTrigger>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Controlled() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("—")
  return (
    <div className="stack">
      <Button onClick={() => setOpen(true)}>Open from outside</Button>
      <Dialog.Root
        open={open}
        onOpenChange={(next, details) => {
          setOpen(next)
          setReason(details.reason)
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Session expiring</Dialog.Title>
              <Dialog.Description>
                Close with the button, Escape or a press outside: the reason changes.
              </Dialog.Description>
              <Dialog.CloseTrigger>Stay signed in</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
      <span className="note">
        open: {String(open)} · last reason: {reason}
      </span>
    </div>
  )
}

export function NonModal() {
  return (
    <div className="stack">
      <Dialog.Root modal={false}>
        <Dialog.Trigger>Notes</Dialog.Trigger>
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Notes</Dialog.Title>
            <Dialog.Description>The page stays usable; the trigger toggles it.</Dialog.Description>
            <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      <label className="stack">
        Page field
        <input />
      </label>
    </div>
  )
}

export function Nested() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Delete project</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Project settings</Dialog.Title>
            <Dialog.Description>Escape closes only the topmost dialog.</Dialog.Description>
            <Dialog.Root>
              <Dialog.Trigger>Delete…</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                  <Dialog.Content>
                    <Dialog.Title>Are you sure?</Dialog.Title>
                    <Dialog.Description>This removes the project for everyone.</Dialog.Description>
                    <Dialog.CloseTrigger>Keep it</Dialog.CloseTrigger>
                  </Dialog.Content>
                </Dialog.Positioner>
              </Dialog.Portal>
            </Dialog.Root>
            <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function InForm() {
  const [saved, setSaved] = useState("nothing yet")
  return (
    <div className="stack">
      <Dialog.Root>
        <Dialog.Trigger>Rename</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault()
                  setSaved(String(new FormData(e.currentTarget).get("name")))
                }}
              >
                <Dialog.Title>Rename file</Dialog.Title>
                <label className="stack">
                  Name
                  <input name="name" required defaultValue="report.pdf" />
                </label>
                <Dialog.CloseTrigger type="submit">Save</Dialog.CloseTrigger>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
      <span className="note">saved: {saved}</span>
    </div>
  )
}

const paragraphs = Array.from({ length: 12 }, (_, i) => i + 1)

export function LongContent() {
  return (
    <Dialog.Root initialFocus="title">
      <Dialog.Trigger>Read the terms</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Terms of service</Dialog.Title>
            {paragraphs.map((n) => (
              <p key={n}>
                {n}. The positioner scrolls; focus starts on the title so reading begins at the top.
              </p>
            ))}
            <Dialog.CloseTrigger>I agree</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "Modal: focus moves in, Tab stays inside, Escape closes." },
  Controlled: {
    title: "Controlled",
    description: "`open` and `onOpenChange(open, details)`; `details.reason` says why.",
  },
  NonModal: {
    title: "Non-modal",
    description: "`modal={false}`: no backdrop, nothing inert, the trigger toggles.",
  },
  Nested: { title: "Nested", description: "A dialog opened inside another is its child." },
  InForm: {
    title: "With a form",
    description: 'A `type="submit"` close trigger closes on the form\'s valid submit.',
  },
  LongContent: {
    title: "Long content",
    description: '`initialFocus="title"` starts reading at the top.',
  },
}
