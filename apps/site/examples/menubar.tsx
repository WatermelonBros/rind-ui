"use client"

import { Menu, Menubar, type MenubarRootProps, RindProvider } from "@rind-ui/react"
import { type ReactNode, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { menubar: { closed: "Basic", open: "Open" } }

/** A menu item with a shortcut: announced through aria-keyshortcuts, shown as a hint. */
function Shortcut({
  keys,
  label,
  disabled = false,
}: {
  readonly keys: string
  readonly label: string
  readonly disabled?: boolean
}) {
  return (
    <Menu.Item disabled={disabled} aria-keyshortcuts={keys}>
      {label}
      <span aria-hidden="true" data-hint="">
        {keys.replace("Control+", "Ctrl+")}
      </span>
    </Menu.Item>
  )
}

/** One bar item and its menu. */
function BarMenu({ value, children }: { readonly value: string; readonly children: ReactNode }) {
  return (
    <Menubar.Menu value={value}>
      <Menubar.Trigger>{value}</Menubar.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>{children}</Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menubar.Menu>
  )
}

function FileMenu() {
  return (
    <BarMenu value="File">
      <Shortcut keys="Control+N" label="New" />
      <Shortcut keys="Control+O" label="Open…" />
      <Menu.Submenu>
        <Menu.SubmenuTrigger>Open recent</Menu.SubmenuTrigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item>notes.md</Menu.Item>
              <Menu.Item>plan.md</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Submenu>
      <Menu.Separator />
      <Shortcut keys="Control+S" label="Save" disabled />
    </BarMenu>
  )
}

function EditMenu() {
  return (
    <BarMenu value="Edit">
      <Shortcut keys="Control+Z" label="Undo" />
      <Shortcut keys="Control+Shift+Z" label="Redo" disabled />
      <Menu.Separator />
      <Shortcut keys="Control+F" label="Find…" />
    </BarMenu>
  )
}

function ViewMenu() {
  const [wrap, setWrap] = useState(true)
  const [zoom, setZoom] = useState<string | null>("100")
  return (
    <BarMenu value="View">
      <Menu.CheckboxItem checked={wrap} onCheckedChange={setWrap}>
        <Menu.ItemIndicator>✓</Menu.ItemIndicator>
        Word wrap
      </Menu.CheckboxItem>
      <Menu.Separator />
      <Menu.Group>
        <Menu.GroupLabel>Zoom</Menu.GroupLabel>
        <Menu.RadioGroup value={zoom} onValueChange={setZoom}>
          {["75", "100", "150"].map((z) => (
            <Menu.RadioItem key={z} value={z}>
              <Menu.ItemIndicator>•</Menu.ItemIndicator>
              {z}%
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Group>
    </BarMenu>
  )
}

function Application(props: MenubarRootProps) {
  return (
    <Menubar.Root aria-label="Application" {...props}>
      <FileMenu />
      <EditMenu />
      <ViewMenu />
    </Menubar.Root>
  )
}

export function Basic() {
  return <Application />
}

export function Open() {
  return <Application aria-label="Application (open)" defaultValue="Edit" />
}

export function Vertical() {
  return <Application aria-label="Sidebar menus" orientation="vertical" />
}

export function NonModal() {
  return <Application aria-label="Non-modal menus" modal={false} />
}

export function Disabled() {
  return <Application aria-label="Disabled menus" disabled />
}

export function RightToLeft() {
  return (
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Application aria-label="Right-to-left menus" />
      </div>
    </RindProvider>
  )
}

export function Reasons() {
  const [log, setLog] = useState<string[]>([])
  return (
    <div>
      <Application
        aria-label="Menus with reasons"
        onValueChange={(value, details) =>
          setLog((l) => [...l.slice(-4), `${value ?? "none"} (${details.reason})`])
        }
      />
      <ol aria-label="Changes">
        {log.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
          <li key={i}>{line}</li>
        ))}
      </ol>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Application menubar",
    description:
      "File, Edit and View: a submenu, checkbox and radio items, disabled items and shortcut hints.",
  },
  Vertical: {
    title: "Vertical",
    description: "Up and Down move along the bar; the expand key opens a menu beside it.",
  },
  NonModal: {
    title: "Non-modal",
    description: "`modal={false}` leaves the page interactive and scrollable.",
  },
  Disabled: { title: "Disabled", description: "Every item stays reachable and opens nothing." },
  RightToLeft: { title: "Right to left", description: "Arrow keys follow the reading direction." },
  Reasons: {
    title: "Reasons",
    description: "`onValueChange(value, details)`: every switch and close says why.",
  },
  Open: { title: "Open", hidden: true },
}
