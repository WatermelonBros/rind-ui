"use client"

import { Menu, Menubar, type MenubarRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "../types"

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "40rem" } as const

const MENUS: Readonly<Record<string, readonly string[]>> = {
  File: ["New", "Open"],
  Edit: ["Undo", "Find…"],
  View: ["Zoom in", "Zoom out"],
}

/** The contract's `tabIn` starts from "Before"; `leave` goes to "After". */
function Bar(props: MenubarRootProps & { readonly onRun?: (item: string) => void }) {
  const { onRun, ...root } = props
  return (
    <div style={column}>
      <button type="button">Before</button>
      <Menubar.Root aria-label="Application" {...root}>
        {Object.entries(MENUS).map(([label, items]) => (
          <Menubar.Menu key={label} value={label}>
            <Menubar.Trigger>{label}</Menubar.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Content>
                  {items.map((i) => (
                    <Menu.Item key={i} value={i} onSelect={() => onRun?.(i)}>
                      {i}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Portal>
          </Menubar.Menu>
        ))}
      </Menubar.Root>
      <button type="button">After</button>
    </div>
  )
}

export function Default() {
  return <Bar />
}

export function VerticalBar() {
  return <Bar orientation="vertical" />
}

export function NonModalBar() {
  return <Bar modal={false} />
}

/** The driver opens, switches and runs an item the way a user does. */
export function DriverExample() {
  const [ran, setRan] = useState<string[]>([])
  return (
    <>
      <Bar onRun={(i) => setRan((r) => [...r, i])} />
      <p>Ran: {ran.join(", ") || "nothing"}</p>
    </>
  )
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  VerticalBar: { title: "Vertical", hidden: true },
  NonModalBar: { title: "Non-modal", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
