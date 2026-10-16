"use client"

import { AlertDialog, type DialogActions } from "@rind-ui/react"
import { useRef, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "alert-dialog": { closed: "Basic", open: "Open" } }

export function Basic() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop />
        <AlertDialog.Positioner>
          <AlertDialog.Content>
            <AlertDialog.Title>Delete project?</AlertDialog.Title>
            <AlertDialog.Description>
              Its files and history go for everyone. This cannot be undone.
            </AlertDialog.Description>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action>Delete</AlertDialog.Action>
          </AlertDialog.Content>
        </AlertDialog.Positioner>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export function AsyncConfirm() {
  const actions = useRef<DialogActions>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(0)
  return (
    <div className="stack">
      <AlertDialog.Root
        actionsRef={actions}
        onOpenChange={(open, details) => {
          if (open || details.reason !== "action") return
          details.cancel()
          setPending(true)
          setTimeout(() => {
            setPending(false)
            setDone((n) => n + 1)
            actions.current?.close()
          }, 1200)
        }}
      >
        <AlertDialog.Trigger>Empty trash</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop />
          <AlertDialog.Positioner>
            <AlertDialog.Content>
              <AlertDialog.Title>Empty the trash?</AlertDialog.Title>
              <AlertDialog.Description>
                The dialog stays open until the request is done.
              </AlertDialog.Description>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action disabled={pending}>
                {pending ? "Emptying…" : "Empty trash"}
              </AlertDialog.Action>
            </AlertDialog.Content>
          </AlertDialog.Positioner>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <span className="note">emptied: {done}</span>
    </div>
  )
}

export function Reasons() {
  const [reason, setReason] = useState("—")
  return (
    <div className="stack">
      <AlertDialog.Root onOpenChange={(open, details) => !open && setReason(details.reason)}>
        <AlertDialog.Trigger>Discard changes</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop />
          <AlertDialog.Positioner>
            <AlertDialog.Content>
              <AlertDialog.Title>Discard your changes?</AlertDialog.Title>
              <AlertDialog.Description>
                Cancel, Discard and Escape each close it with their own reason.
              </AlertDialog.Description>
              <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
              <AlertDialog.Action>Discard</AlertDialog.Action>
            </AlertDialog.Content>
          </AlertDialog.Positioner>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <span className="note">closed with: {reason}</span>
    </div>
  )
}

export function NoEscape() {
  return (
    <AlertDialog.Root closeOnEscape={false}>
      <AlertDialog.Trigger>Accept the terms</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop />
        <AlertDialog.Positioner>
          <AlertDialog.Content>
            <AlertDialog.Title>New terms of service</AlertDialog.Title>
            <AlertDialog.Description>Choose one: Escape does nothing here.</AlertDialog.Description>
            <AlertDialog.Cancel>Decline</AlertDialog.Cancel>
            <AlertDialog.Action>Accept</AlertDialog.Action>
          </AlertDialog.Content>
        </AlertDialog.Positioner>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export function Open() {
  return (
    <AlertDialog.Root defaultOpen>
      <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop />
        <AlertDialog.Positioner>
          <AlertDialog.Content>
            <AlertDialog.Title>Delete project?</AlertDialog.Title>
            <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action>Delete</AlertDialog.Action>
          </AlertDialog.Content>
        </AlertDialog.Positioner>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Always modal; focus starts on Cancel; a press outside does nothing.",
  },
  AsyncConfirm: {
    title: "Async confirm",
    description: "`details.cancel()` keeps it open while the work runs; `actionsRef` closes it.",
  },
  Reasons: {
    title: "Close reasons",
    description: "`cancel`, `action` and `escape-key` tell the three apart.",
  },
  NoEscape: {
    title: "No Escape",
    description: "`closeOnEscape={false}` for a choice that must be explicit.",
  },
  Open: { title: "Open", hidden: true },
}
