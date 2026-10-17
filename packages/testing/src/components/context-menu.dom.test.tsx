// Context Menu scenarios (openspec add-context-menu) through the context-menu driver, in
// jsdom and in real browsers. Layout-dependent ones (viewport corners, scaled ancestors)
// run in the browsers only.
import { ContextMenu, type ContextMenuRootProps, Menu } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { getContextMenu, getMenu } from "../index"

const isJsdom = navigator.userAgent.includes("jsdom")
const active = () => document.activeElement
const name = (el: Element | null) => el?.textContent?.trim() ?? null

function Files({
  children,
  onSelect = () => {},
  ...root
}: Partial<ContextMenuRootProps> & { children?: ReactNode; onSelect?: (v: string) => void }) {
  return (
    <ContextMenu.Root {...root}>
      <ContextMenu.Trigger style={{ width: 300, height: 120 }}>
        <button type="button">README.md</button>
        {children}
      </ContextMenu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content aria-label="File actions">
            <Menu.Item onSelect={() => onSelect("rename")}>Rename</Menu.Item>
            <Menu.Item onSelect={() => onSelect("delete")}>Delete</Menu.Item>
            <Menu.CheckboxItem>Pinned</Menu.CheckboxItem>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </ContextMenu.Root>
  )
}

describe("ContextMenu: opening", () => {
  it("Driver round trip: openAt, choose closes it", async () => {
    const onSelect = vi.fn()
    render(<Files onSelect={onSelect} />)
    const c = getContextMenu(screen, { text: "README.md" }).via("pointer")
    await c.openAt()
    expect(active()?.getAttribute("role")).toBe("menu")
    expect(await c.highlighted()).toBe(null)
    await c.choose("Rename")
    await waitFor(async () => expect(await c.isOpen()).toBe(false))
    expect(onSelect).toHaveBeenCalledWith("rename")
  })

  it("Region semantics: no popup ARIA, the consumer's tabindex is kept", () => {
    render(
      <ContextMenu.Root>
        <ContextMenu.Trigger tabIndex={0}>Pane</ContextMenu.Trigger>
      </ContextMenu.Root>,
    )
    const region = screen.getByText("Pane")
    expect(region.getAttribute("tabindex")).toBe("0")
    for (const a of ["role", "aria-haspopup", "aria-expanded", "aria-controls"]) {
      expect(region.hasAttribute(a)).toBe(false)
    }
    expect(region.getAttribute("data-state")).toBe("closed")
  })

  it("Shift+F10 on a row opens it with the first item focused; Escape returns to the row", async () => {
    render(<Files />)
    const c = getContextMenu(screen, { text: "README.md" }).via("keyboard")
    const row = screen.getByRole("button", { name: "README.md" })
    act(() => row.focus())
    await userEvent.keyboard("{Shift>}{F10}{/Shift}")
    await waitFor(() => expect(name(active())).toBe("Rename"))
    expect(await c.isOpen()).toBe(true)
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(active()).toBe(row))
  })

  it("VoiceOver's shortcut menu (a bare contextmenu) focuses the first item", async () => {
    render(<Files />)
    const c = getContextMenu(screen, { text: "README.md" }).via("virtual")
    await c.openAt()
    expect(await c.focusedItem()).toBe("Rename")
  })

  it("Child opts out: a descendant that prevents its contextmenu keeps the browser's (bits-ui#1641)", async () => {
    render(
      <Files>
        <a href="#x" onContextMenu={(e) => e.preventDefault()}>
          Own menu
        </a>
      </Files>,
    )
    const link = screen.getByText("Own menu")
    act(() => {
      link.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))
    })
    expect(screen.queryByRole("menu")).toBe(null)
  })

  it("Disabled: the browser's menu shows", () => {
    render(<Files disabled />)
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    act(() => {
      screen.getByText("README.md").dispatchEvent(e)
    })
    expect(e.defaultPrevented).toBe(false)
    expect(screen.queryByRole("menu")).toBe(null)
  })

  it("First click after opening toggles a checkbox item once (mui/base-ui#2828)", async () => {
    render(<Files />)
    const c = getContextMenu(screen, { text: "README.md" }).via("pointer")
    await c.openAt()
    await c.toggle("Pinned")
    expect(await c.isChecked("Pinned")).toBe(true)
  })

  it("Which row: details carry the target and the point (radix#766)", async () => {
    const onOpenChange = vi.fn()
    render(<Files onOpenChange={onOpenChange} />)
    const row = screen.getByRole("button", { name: "README.md" })
    act(() => {
      row.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 7, clientY: 9 }),
      )
    })
    const [open, details] = onOpenChange.mock.calls[0] ?? []
    expect(open).toBe(true)
    expect(details.reason).toBe("context-menu")
    expect(details.target).toBe(screen.getByRole("button", { name: "README.md" }))
    expect(details.point).toEqual({ x: 7, y: 9 })
  })
})

describe("ContextMenu: while open", () => {
  it("Innermost region: a dropdown inside a region is an independent root (ark#3285)", async () => {
    render(
      <Files>
        <Menu.Root modal={false}>
          <Menu.Trigger>Tools</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item>Lint</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Files>,
    )
    const tools = getMenu(screen, { name: "Tools", modal: false }).via("pointer")
    await tools.open()
    expect(await tools.isOpen()).toBe(true)
    expect(screen.getAllByRole("menu")).toHaveLength(1)
  })

  it.runIf(!isJsdom)("Second right click in the same region re-anchors (radix#1287)", async () => {
    const onAnchorChange = vi.fn()
    render(<Files onAnchorChange={onAnchorChange} modal={false} />)
    const c = getContextMenu(screen, { text: "README.md", modal: false }).via("pointer")
    await c.openAt({ x: 0.2, y: 0.2 })
    const first = await c.anchorPoint()
    await c.reanchor({ x: 0.8, y: 0.8 })
    await waitFor(async () => expect(await c.anchorPoint()).not.toEqual(first))
    expect(onAnchorChange).toHaveBeenCalledTimes(1)
    expect(await c.isOpen()).toBe(true)
  })

  it("Window loses focus: it closes (mui/base-ui#3125)", async () => {
    render(<Files />)
    const c = getContextMenu(screen, { text: "README.md" }).via("pointer")
    await c.openAt()
    act(() => {
      window.dispatchEvent(new FocusEvent("blur"))
    })
    await waitFor(async () => expect(await c.isOpen()).toBe(false))
  })
})
