// Menu regression scenarios (openspec add-menu): one test per scenario, named after the
// spec scenario and the upstream issue it guards. jsdom and chromium unless layout is needed.
import { Menu } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { getMenu } from "../index"

const isJsdom = navigator.userAgent.includes("jsdom")
const active = () => document.activeElement
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const frames = async (n = 3) => {
  for (let i = 0; i < n; i++) await frame()
}

function Simple({
  onSelect = () => {},
  label = "Actions",
  children,
  onOpenChange,
}: {
  onSelect?: (k: string) => void
  label?: string
  children?: React.ReactNode
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <Menu.Root {...(onOpenChange ? { onOpenChange } : {})}>
      <Menu.Trigger>{label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item onSelect={() => onSelect("copy")}>Copy</Menu.Item>
            <Menu.Item onSelect={() => onSelect("paste")}>Paste</Menu.Item>
            {children}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function Sub({ title, items }: { title: string; items: string[] }) {
  return (
    <Menu.Submenu>
      <Menu.SubmenuTrigger>{title}</Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            {items.map((i) => (
              <Menu.Item key={i}>{i}</Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
