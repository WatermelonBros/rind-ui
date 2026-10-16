"use client"

import { Dialog, Popover } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

/** Logs every open change of the layers below with its reason, newest first. */
function useLog() {
  const [log, setLog] = useState<readonly { id: number; text: string }[]>([])
  const track = (layer: string) => (open: boolean, details: { reason: string }) =>
    setLog((l) =>
      [
        {
          id: (l[0]?.id ?? 0) + 1,
          text: `${layer} ${open ? "opened" : "closed"}: ${details.reason}`,
        },
        ...l,
      ].slice(0, 4),
    )
  return [log, track] as const
}

export function Basic() {
  const [log, track] = useLog()
  return (
    <div className="stack">
      <Dialog.Root onOpenChange={track("dialog")}>
        <Dialog.Trigger>Open a dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Layers</Dialog.Title>
              <Dialog.Description>
                Open the popover, then its child. Escape closes only the topmost layer; a press
                outside the popovers closes them top-down and stops at the dialog.
              </Dialog.Description>
              <Popover.Root onOpenChange={track("popover")}>
                <Popover.Trigger>Popover</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Content>
                      <Popover.Title>Popover</Popover.Title>
                      <Popover.Root
                        onOpenChange={track("child")}
                        positioning={{ side: "inline-end" }}
                      >
                        <Popover.Trigger>Child popover</Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Positioner>
                            <Popover.Content>
                              <Popover.Title>Child</Popover.Title>
                              <p>Press Escape: only this one closes.</p>
                            </Popover.Content>
                          </Popover.Positioner>
                        </Popover.Portal>
                      </Popover.Root>
                    </Popover.Content>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
              <Dialog.CloseTrigger>Done</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
      <ol className="readout" aria-label="Layer log">
        {log.length ? (
          log.map((l) => (
            <li key={l.id}>
              <code>{l.text}</code>
            </li>
          ))
        ) : (
          <li>
            <code>no change yet</code>
          </li>
        )}
      </ol>
    </div>
  )
}

export function Veto() {
  const [dirty, setDirty] = useState(false)
  const [vetoed, setVetoed] = useState(0)
  return (
    <div className="stack">
      <Popover.Root
        onOpenChange={(open, details) => {
          if (!open && dirty && details.reason === "outside-press") {
            details.cancel()
            setVetoed((n) => n + 1)
          }
        }}
      >
        <Popover.Trigger>Edit note</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Title>Note</Popover.Title>
              <label className="stack">
                Text
                <input placeholder="Type to make it dirty" onInput={() => setDirty(true)} />
              </label>
              <Popover.CloseTrigger onClick={() => setDirty(false)}>Save</Popover.CloseTrigger>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <span className="note">
        dirty: {String(dirty)} · outside presses refused: {vetoed}
      </span>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "The layer stack",
    description: "A dialog, a popover inside it and the popover's child, with every reason logged.",
  },
  Veto: {
    title: "Refusing a dismissal",
    description: "`details.cancel()` keeps a dirty popover open on an outside press.",
  },
}
