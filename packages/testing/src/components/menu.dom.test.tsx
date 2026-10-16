// Menu scenarios (openspec add-menu): the spec's behaviour through the menu driver, in
// jsdom and in real browsers. Pointer paths and layout-dependent scenarios (grace areas,
// flipped submenus) live in the browser suite.
import { Menu, type MenuRootProps } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { getMenu, installAnnouncementLog } from "../index"

const active = () => document.activeElement
const name = (el: Element | null) => el?.textContent?.trim() ?? null

function Basic({
  onSelect = () => {},
  children,
  ...root
}: Partial<MenuRootProps> & { onSelect?: (key: string) => void; children?: ReactNode }) {
  return (
    <>
      <button type="button">Before</button>
      <Menu.Root {...root}>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="copy" onSelect={() => onSelect("copy")}>
                Copy
              </Menu.Item>
              <Menu.Item value="cut" disabled onSelect={() => onSelect("cut")}>
                Cut
              </Menu.Item>
              <Menu.Item value="paste" onSelect={() => onSelect("paste")}>
                Paste
              </Menu.Item>
              {children}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <button type="button">After</button>
    </>
  )
}

function Encoding({ onSelect }: { onSelect: (v: string) => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger>Encoding</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item onSelect={() => onSelect("save")}>Save with encoding</Menu.Item>
            <Menu.Submenu>
              <Menu.SubmenuTrigger>Reopen with</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item onSelect={() => onSelect("utf-8")}>UTF-8</Menu.Item>
                    <Menu.Item onSelect={() => onSelect("utf-16")}>UTF-16</Menu.Item>
                    <Menu.Submenu>
                      <Menu.SubmenuTrigger>Legacy</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Content>
                            <Menu.Item onSelect={() => onSelect("latin-1")}>Latin-1</Menu.Item>
                          </Menu.Content>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Submenu>
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Submenu>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

describe("Menu: opening and initial focus", () => {
  it("Closed menu: aria-expanded=false and no aria-controls (radix#3013)", () => {
    render(<Basic />)
    const trigger = screen.getByRole("button", { name: "Actions" })
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(trigger.hasAttribute("aria-controls")).toBe(false)
  })

  it("Keyboard open focuses the first item; the menu is named by the trigger", async () => {
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    expect(await m.focusedItem()).toBe("Copy")
    const menu = screen.getByRole("menu")
    expect(menu.getAttribute("aria-labelledby")).toBe(
      screen.getByRole("button", { name: "Actions" }).id,
    )
    const trigger = screen.getByRole("button", { name: "Actions" })
    expect(trigger.getAttribute("aria-controls")).toBe(menu.id)
  })

  it("ArrowUp opens on the last item (radix#3640)", async () => {
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.openWithArrowUp()
    expect(await m.focusedItem()).toBe("Paste")
  })

  it("Mouse open: the content is focused, nothing highlighted; ArrowDown focuses the first item", async () => {
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("pointer")
    await m.open()
    expect(active()?.getAttribute("role")).toBe("menu")
    expect(await m.highlighted()).toBe(null)
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() => expect(name(active())).toBe("Copy"))
  })

  it("Screen reader open (a bare click) focuses the first item (radix#1815)", async () => {
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("virtual")
    await m.open()
    expect(await m.focusedItem()).toBe("Copy")
  })
})

describe("Menu: keyboard", () => {
  it("Wrapping, and disabled items are reachable but never activate", async () => {
    const onSelect = vi.fn()
    render(<Basic onSelect={onSelect} />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() => expect(name(active())).toBe("Cut"))
    expect(active()?.getAttribute("aria-disabled")).toBe("true")
    await userEvent.keyboard("{Enter}")
    expect(onSelect).not.toHaveBeenCalled()
    expect(await m.isOpen()).toBe(true)
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    await waitFor(() => expect(name(active())).toBe("Copy"))
  })

  it("Enter activates once and closes the tree; focus returns to the trigger", async () => {
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()
    render(<Basic onSelect={onSelect} onOpenChange={onOpenChange} />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    await m.choose("Paste")
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith("paste")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "item-select" }),
    )
    await waitFor(() => expect(name(active())).toBe("Actions"))
  })

  it("Escape closes and focuses the trigger, with reason escape-key", async () => {
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    await m.pressEscape()
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    await waitFor(() => expect(name(active())).toBe("Actions"))
  })

  it("Tab out closes every level (radix#1934)", async () => {
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    await m.tabOut()
    expect(await m.isOpen()).toBe(false)
  })

  it("Typeahead moves to the matching item", async () => {
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    await userEvent.keyboard("p")
    await waitFor(() => expect(name(active())).toBe("Paste"))
  })

  it("Announcements: the log stays empty while navigating", async () => {
    const log = installAnnouncementLog()
    const start = log.length
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    expect(log.length).toBe(start)
  })
})

describe("Menu: pointer", () => {
  it("A click activates the item once and closes the menu", async () => {
    const onSelect = vi.fn()
    render(<Basic onSelect={onSelect} />)
    const m = getMenu(screen, { name: "Actions" }).via("pointer")
    await m.open()
    await m.choose("Copy")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("Keep open: onSelect's cancel() keeps the menu open", async () => {
    render(
      <Menu.Root>
        <Menu.Trigger>Open With</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item onSelect={(d) => d.cancel()}>More…</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    const m = getMenu(screen, { name: "Open With" }).via("pointer")
    await m.open()
    await m.choose("More…")
    expect(await m.isOpen()).toBe(true)
  })
})

describe("Menu: checkbox and radio items", () => {
  function Options({ onChange }: { onChange: (v: string) => void }) {
    const [mode, setMode] = useState<string | null>("list")
    return (
      <Menu.Root>
        <Menu.Trigger>View</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              {["Toolbar", "Status bar", "Minimap"].map((label) => (
                <Menu.CheckboxItem key={label} onCheckedChange={(c) => onChange(`${label}:${c}`)}>
                  <Menu.ItemIndicator>✓</Menu.ItemIndicator>
                  {label}
                </Menu.CheckboxItem>
              ))}
              <Menu.RadioGroup value={mode} onValueChange={setMode}>
                <Menu.RadioItem value="list">List</Menu.RadioItem>
                <Menu.RadioItem value="grid">Grid</Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    )
  }

  it("Toggling several options keeps the menu open, one change per press (radix#2366, zag#237)", async () => {
    const onChange = vi.fn()
    render(<Options onChange={onChange} />)
    const m = getMenu(screen, { name: "View" }).via("pointer")
    await m.open()
    for (const label of ["Toolbar", "Status bar", "Minimap"]) await m.toggle(label)
    expect(await m.isOpen()).toBe(true)
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([
      "Toolbar:true",
      "Status bar:true",
      "Minimap:true",
    ])
    expect(await m.isChecked("Minimap")).toBe(true)
    expect(screen.getAllByRole("menuitemcheckbox")[0]?.getAttribute("aria-checked")).toBe("true")
  })

  it("Space on a radio item checks it and keeps the menu open (zag#1090)", async () => {
    render(<Options onChange={() => {}} />)
    const m = getMenu(screen, { name: "View" }).via("keyboard")
    await m.open()
    expect(await m.isChecked("List")).toBe(true)
    await m.toggle("Grid")
    await waitFor(async () => expect(await m.isChecked("Grid")).toBe(true))
    expect(await m.isChecked("List")).toBe(false)
    expect(await m.isOpen()).toBe(true)
  })
})

describe("Menu: submenus", () => {
  it("Driver round trip: open, openSubmenu, choose closes every level once", async () => {
    const onSelect = vi.fn()
    render(<Encoding onSelect={onSelect} />)
    const m = getMenu(screen, { name: "Encoding" })
    await m.open()
    await m.openSubmenu("Reopen with")
    await m.choose("UTF-16")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith("utf-16")
  })

  it("Keyboard into and out of a submenu (radix#1443, zag#3056)", async () => {
    render(<Encoding onSelect={() => {}} />)
    const m = getMenu(screen, { name: "Encoding" }).via("keyboard")
    await m.open()
    await m.openSubmenu("Reopen with")
    await waitFor(() => expect(name(active())).toBe("UTF-8"))
    expect(await m.openPath()).toEqual(["Reopen with"])
    const sub = screen.getAllByRole("menu")[1]
    expect(sub?.getAttribute("aria-labelledby")).toBe(
      screen.getByRole("menuitem", { name: "Reopen with" }).id,
    )
    await m.closeSubmenu()
    await waitFor(() => expect(name(active())).toBe("Reopen with"))
    expect(await m.openPath()).toEqual([])
    expect(await m.isOpen()).toBe(true)
  })

  it("Three levels: an item in the third level runs once and every level closes (radix#4095)", async () => {
    const onSelect = vi.fn()
    render(<Encoding onSelect={onSelect} />)
    const m = getMenu(screen, { name: "Encoding" }).via("keyboard")
    await m.open()
    await m.openSubmenu("Reopen with")
    await m.openSubmenu("Legacy")
    await m.choose("Latin-1")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(screen.queryAllByRole("menu")).toHaveLength(0)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("Escape in a submenu closes only it, a second Escape the menu (radix#1933)", async () => {
    render(<Encoding onSelect={() => {}} />)
    const m = getMenu(screen, { name: "Encoding" }).via("keyboard")
    await m.open()
    await m.openSubmenu("Reopen with")
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(name(active())).toBe("Reopen with"))
    expect(await m.isOpen()).toBe(true)
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    await waitFor(() => expect(name(active())).toBe("Encoding"))
  })

  it("Enter opens a submenu, Enter again activates its first item (react-spectrum#9686)", async () => {
    const onSelect = vi.fn()
    render(<Encoding onSelect={onSelect} />)
    const m = getMenu(screen, { name: "Encoding" }).via("keyboard")
    await m.open()
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() => expect(name(active())).toBe("Reopen with"))
    await userEvent.keyboard("{Enter}")
    await waitFor(() => expect(name(active())).toBe("UTF-8"))
    await userEvent.keyboard("{Enter}")
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("utf-8"))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

describe("Menu: groups and separators", () => {
  it("A labelled group and a separator perpendicular to the menu", async () => {
    render(
      <Menu.Root>
        <Menu.Trigger>Remote</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Group>
                <Menu.GroupLabel>Remote</Menu.GroupLabel>
                <Menu.Item>Fetch</Menu.Item>
                <Menu.Item>Push</Menu.Item>
              </Menu.Group>
              <Menu.Separator />
              <Menu.Item>Settings</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    await getMenu(screen, { name: "Remote" }).via("keyboard").open()
    const group = screen.getByRole("group", { name: "Remote" })
    expect(group.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
    const sep = screen.getByRole("separator")
    expect(sep.getAttribute("data-orientation")).toBe("horizontal")
    expect(sep.hasAttribute("aria-orientation")).toBe(false)
    await act(async () => {})
  })
})
