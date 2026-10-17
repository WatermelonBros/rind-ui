"use client"

import { Dialog, Menu, type MenuRootProps } from "@rind-ui/react"
import { type ReactNode, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { menu: { closed: "Basic", open: "Open" } }

/** A trigger and its content: the parts every example repeats. */
function Actions({
  label = "Actions",
  children,
  ...root
}: MenuRootProps & { readonly label?: string; readonly children: ReactNode }) {
  return (
    <Menu.Root {...root}>
      <Menu.Trigger>
        {label} <span aria-hidden="true">▾</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>{children}</Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function FileItems() {
  return (
    <>
      <Menu.Item>New file</Menu.Item>
      <Menu.Item>Duplicate</Menu.Item>
      <Menu.Item href="/docs/menu/#link-items">Open the docs</Menu.Item>
      <Menu.Separator />
      <Menu.Item disabled>Delete</Menu.Item>
    </>
  )
}

export function Basic() {
  return (
    <Actions>
      <FileItems />
    </Actions>
  )
}

export function Open() {
  return (
    <Actions defaultOpen>
      <FileItems />
    </Actions>
  )
}

export function Options() {
  const [grid, setGrid] = useState(true)
  const [sort, setSort] = useState<string | null>("name")
  return (
    <div className="stack">
      <Actions label="View">
        <Menu.CheckboxItem checked={grid} onCheckedChange={setGrid}>
          <Menu.ItemIndicator>✓</Menu.ItemIndicator>
          <Menu.ItemText>Show grid</Menu.ItemText>
        </Menu.CheckboxItem>
        <Menu.Separator />
        <Menu.Group>
          <Menu.GroupLabel>Sort by</Menu.GroupLabel>
          <Menu.RadioGroup value={sort} onValueChange={setSort}>
            {["name", "date", "size"].map((v) => (
              <Menu.RadioItem key={v} value={v}>
                <Menu.ItemIndicator>●</Menu.ItemIndicator>
                <Menu.ItemText>{v[0]?.toUpperCase() + v.slice(1)}</Menu.ItemText>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Group>
      </Actions>
      <span className="note">
        grid: {String(grid)} · sort: {sort ?? "none"}
      </span>
    </div>
  )
}

export function Submenus() {
  return (
    <Actions label="Share">
      <Menu.Item>Copy link</Menu.Item>
      <Menu.Submenu>
        <Menu.SubmenuTrigger>Send to</Menu.SubmenuTrigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item>Email</Menu.Item>
              <Menu.Item>Messages</Menu.Item>
              <Menu.Submenu>
                <Menu.SubmenuTrigger>Team</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item>Design</Menu.Item>
                      <Menu.Item>Engineering</Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Submenu>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Submenu>
      <Menu.Item>Embed</Menu.Item>
    </Actions>
  )
}

export function WithDialog() {
  const [renaming, setRenaming] = useState(false)
  return (
    <>
      <Actions>
        <Menu.Item onSelect={() => setRenaming(true)}>Rename…</Menu.Item>
        <Menu.Item>Duplicate</Menu.Item>
      </Actions>
      <Dialog.Root open={renaming} onOpenChange={setRenaming}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Rename file</Dialog.Title>
              <label className="stack">
                Name
                <input defaultValue="report.pdf" />
              </label>
              <div className="row">
                <Dialog.CloseTrigger>Cancel</Dialog.CloseTrigger>
                <Dialog.CloseTrigger>Save</Dialog.CloseTrigger>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

export function NonModal() {
  return (
    <div className="row">
      <Actions modal={false}>
        <FileItems />
      </Actions>
      <span className="note">The page stays usable while it is open.</span>
    </div>
  )
}

export function Controlled() {
  const [log, setLog] = useState<readonly { id: number; text: string }[]>([])
  return (
    <div className="stack">
      <Actions
        onOpenChange={(open, details) =>
          setLog((l) =>
            [
              { id: (l[0]?.id ?? 0) + 1, text: `${open ? "opened" : "closed"}: ${details.reason}` },
              ...l,
            ].slice(0, 3),
          )
        }
      >
        <FileItems />
      </Actions>
      <ol className="readout" aria-label="Open changes">
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

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description:
      "Items, a link item, a separator and a disabled item. Arrows, Home, End, typeahead.",
  },
  Options: {
    title: "Checkbox and radio items",
    description: "They toggle without closing, so several options are set in one visit.",
  },
  Submenus: {
    title: "Submenus",
    description: "ArrowRight or a resting pointer opens one; the pointer can travel towards it.",
  },
  WithDialog: {
    title: "Opening a dialog",
    description: "Render the Dialog outside the menu and open it from `onSelect`.",
  },
  NonModal: { title: "Non-modal", description: "`modal={false}` leaves the page interactive." },
  Controlled: {
    title: "Reasons",
    description: "`onOpenChange(open, details)`: every open and close says why.",
  },
  Open: { title: "Open", hidden: true },
}
