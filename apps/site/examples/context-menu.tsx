"use client"

import { ContextMenu, type ContextMenuRootProps, Menu } from "@rind-ui/react"
import { type ReactNode, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { menu: { closed: "Basic", open: "Open" } }

/** A focusable region and its menu: the parts every example repeats. */
function Region({
  label,
  children,
  ...root
}: ContextMenuRootProps & { readonly label: string; readonly children: ReactNode }) {
  return (
    <ContextMenu.Root {...root}>
      <ContextMenu.Trigger tabIndex={0} className="context-region">
        {label}
        <small>Right click, long press or Shift+F10</small>
      </ContextMenu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={`${label} actions`}>{children}</Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </ContextMenu.Root>
  )
}

function FileItems() {
  return (
    <>
      <Menu.Item>Rename</Menu.Item>
      <Menu.Item>Duplicate</Menu.Item>
      <Menu.Separator />
      <Menu.Item>Delete</Menu.Item>
    </>
  )
}

export function Basic() {
  return (
    <Region label="README.md">
      <FileItems />
    </Region>
  )
}

export function Open() {
  return (
    <Region label="README.md" defaultOpen>
      <FileItems />
    </Region>
  )
}

export function WithOptions() {
  const [hidden, setHidden] = useState(false)
  const [sort, setSort] = useState<string | null>("name")
  return (
    <div className="stack">
      <Region label="Photos folder">
        <Menu.CheckboxItem checked={hidden} onCheckedChange={setHidden}>
          <Menu.ItemIndicator>✓</Menu.ItemIndicator>
          <Menu.ItemText>Show hidden files</Menu.ItemText>
        </Menu.CheckboxItem>
        <Menu.Separator />
        <Menu.Group>
          <Menu.GroupLabel>Sort by</Menu.GroupLabel>
          <Menu.RadioGroup value={sort} onValueChange={setSort}>
            {["name", "date"].map((v) => (
              <Menu.RadioItem key={v} value={v}>
                <Menu.ItemIndicator>●</Menu.ItemIndicator>
                <Menu.ItemText>{v === "name" ? "Name" : "Date"}</Menu.ItemText>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Group>
        <Menu.Submenu>
          <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item>Copy link</Menu.Item>
                <Menu.Item>Email</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Submenu>
      </Region>
      <span className="note">
        hidden files: {String(hidden)} · sort: {sort ?? "none"}
      </span>
    </div>
  )
}

export function NonModal() {
  return (
    <Region label="Draft" modal={false}>
      <FileItems />
    </Region>
  )
}

export function NoLongPress() {
  return (
    <Region label="Map" longPress={false}>
      <Menu.Item>Drop a pin</Menu.Item>
      <Menu.Item>Measure distance</Menu.Item>
    </Region>
  )
}

export function Disabled() {
  return (
    <Region label="Read-only file" disabled>
      <FileItems />
    </Region>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "A right click, a long press or Shift+F10 opens the menu where the gesture was.",
  },
  WithOptions: {
    title: "Options and submenus",
    description: "The Menu's own checkbox, radio and submenu parts work inside.",
  },
  NonModal: { title: "Non-modal", description: "`modal={false}` leaves the page usable." },
  NoLongPress: {
    title: "No long press",
    description: "`longPress={false}`: touch keeps the browser's own gestures (a map, a canvas).",
  },
  Disabled: {
    title: "Disabled",
    description: "`disabled` gives the browser's own context menu back.",
  },
  Open: { title: "Open", hidden: true },
}
