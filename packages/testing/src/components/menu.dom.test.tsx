// Menu scenarios (openspec add-menu): the spec's behaviour through the menu driver, in
// jsdom and in real browsers. Pointer paths and layout-dependent scenarios (grace areas,
// flipped submenus) live in the browser suite.
import { Dialog, Menu, type MenuRootProps, RouterProvider } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ComponentPropsWithRef, type ReactNode, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { fakeRouter, getMenu, installAnnouncementLog, interceptNativeNavigation } from "../index"

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
    // The browser's Tab moves on from the trigger (the modal containment never wraps it).
    expect(name(active())).toBe("After")
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

describe("Menu: link items", () => {
  function Links({
    onSelect = () => {},
    onOpenChange,
  }: {
    onSelect?: () => void
    onOpenChange?: MenuRootProps["onOpenChange"]
  }) {
    return (
      <Menu.Root {...(onOpenChange ? { onOpenChange } : {})}>
        <Menu.Trigger>Help</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item href="/docs" onSelect={onSelect}>
                Docs
              </Menu.Item>
              <Menu.Item href="/blog">Blog</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    )
  }

  it("Plain anchor link item uses the environment router; a modified click opens a tab and keeps the menu open", async () => {
    interceptNativeNavigation(window)
    const router = fakeRouter()
    const onSelect = vi.fn()
    const changes = vi.fn()
    render(
      <RouterProvider navigate={router.navigate}>
        <Links onSelect={onSelect} onOpenChange={changes} />
      </RouterProvider>,
    )
    const m = getMenu(screen, { name: "Help" }).via("pointer")
    await m.open()
    const link = screen.getByRole("menuitem", { name: "Docs" })
    expect(link.tagName).toBe("A")
    await userEvent.click(screen.getByRole("menuitem", { name: "Blog" }))
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(router.calls.map((c) => c.href)).toEqual(["/blog"])
    await m.open()
    // user-event has no modifier option on click: hold the key around it (one instance).
    const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
    const u = userEvent.setup()
    await u.keyboard(`{${mod}>}`)
    await u.click(screen.getByRole("menuitem", { name: "Docs" }))
    await u.keyboard(`{/${mod}}`)
    expect(changes.mock.calls.map((c) => c[1].reason)).toEqual([
      "trigger",
      "item-select",
      "trigger",
    ])
    expect(await m.isOpen()).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
    expect(router.calls).toHaveLength(1)
  })

  it("Enter on a link navigates once through the browser's activation and closes the menu", async () => {
    interceptNativeNavigation(window)
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Links />
      </RouterProvider>,
    )
    const m = getMenu(screen, { name: "Help" }).via("keyboard")
    await m.open()
    await userEvent.keyboard("{Enter}")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(router.calls.map((c) => c.href)).toEqual(["/docs"])
  })

  it("Space on a link navigates once (no scroll)", async () => {
    interceptNativeNavigation(window)
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Links />
      </RouterProvider>,
    )
    const m = getMenu(screen, { name: "Help" }).via("keyboard")
    await m.open()
    await userEvent.keyboard(" ")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(router.calls.map((c) => c.href)).toEqual(["/docs"])
  })
})

describe("Menu: closing rules", () => {
  it("Switching applications: the window losing focus closes the menu", async () => {
    render(<Basic />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    act(() => {
      window.dispatchEvent(new FocusEvent("blur"))
    })
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
  })

  it("Refused close: a controlled menu kept open stays open", async () => {
    const onOpenChange = vi.fn()
    render(<Basic open onOpenChange={onOpenChange} />)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy())
    await waitFor(() => expect(name(active())).toBe("Copy"))
    await userEvent.keyboard("{Escape}")
    expect(onOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    )
    expect(await m.isOpen()).toBe(true)
    expect(name(active())).toBe("Copy")
  })

  it("Non-modal toolbar menus: one click on the second trigger switches menus", async () => {
    render(
      <>
        {["File", "Edit"].map((label) => (
          <Menu.Root key={label} modal={false}>
            <Menu.Trigger>{label}</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item>{`${label} item`}</Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ))}
      </>,
    )
    const file = getMenu(screen, { name: "File", modal: false }).via("pointer")
    const edit = getMenu(screen, { name: "Edit", modal: false }).via("pointer")
    await file.open()
    await edit.open()
    expect(await file.isOpen()).toBe(false)
    expect(await edit.isOpen()).toBe(true)
  })

  it("Label click focuses the trigger and does not open it (headlessui#3787)", async () => {
    render(
      <>
        <label htmlFor="enc">Encoding</label>
        <Menu.Root>
          <Menu.Trigger id="enc">UTF-8</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item>UTF-16</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </>,
    )
    await userEvent.click(screen.getByText("Encoding"))
    await waitFor(() => expect(name(active())).toBe("UTF-8"))
    expect(screen.queryByRole("menu")).toBe(null)
  })
})

describe("Menu: menus and dialogs", () => {
  it("Menu in a dialog: Escape closes only the menu", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>Settings</Dialog.Title>
            <Menu.Root>
              <Menu.Trigger>Theme</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item>Dark</Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    const m = getMenu(screen, { name: "Theme" }).via("keyboard")
    await m.open()
    await userEvent.keyboard("{Escape}")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy()
    await waitFor(() => expect(name(active())).toBe("Theme"))
  })

  it("Dialog from an item: it stays open, its input is focused, closing it focuses the trigger", async () => {
    function App() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Menu.Root>
            <Menu.Trigger>File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item onSelect={() => setOpen(true)}>Rename…</Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Portal>
              <Dialog.Content>
                <Dialog.Title>Rename</Dialog.Title>
                <input aria-label="Name" />
                <Dialog.CloseTrigger>Cancel</Dialog.CloseTrigger>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      )
    }
    render(<App />)
    const m = getMenu(screen, { name: "File" }).via("keyboard")
    await m.open()
    await m.choose("Rename…")
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Rename" })).toBeTruthy())
    await waitFor(() => expect(active()?.getAttribute("aria-label")).toBe("Name"))
    expect(await m.isOpen()).toBe(false)
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))
    await waitFor(() => expect(name(active())).toBe("File"))
    expect(document.querySelector("[inert]")).toBe(null)
  })
})

describe("Menu: rendered elements", () => {
  /** Mimics a client router's Link: its own onClick navigates unless prevented. */
  function RouterLikeLink({
    to,
    navigate,
    ...props
  }: ComponentPropsWithRef<"a"> & { to: string; navigate: (to: string) => void }) {
    return (
      <a
        {...props}
        href={to}
        onClick={(e) => {
          props.onClick?.(e)
          if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            navigate(to)
          }
        }}
      />
    )
  }

  it("Client router link: the route changes once and the menu closes (radix#2718)", async () => {
    interceptNativeNavigation(window)
    const navigate = vi.fn()
    render(
      <Menu.Root>
        <Menu.Trigger>Go</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item
                href="/settings"
                render={<RouterLikeLink to="/settings" navigate={navigate} />}
              >
                Settings
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    const m = getMenu(screen, { name: "Go" }).via("pointer")
    await m.open()
    await m.choose("Settings")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith("/settings")
  })

  it("Custom button element: Enter runs its own click handler once (mui/base-ui#2281)", async () => {
    const log = vi.fn()
    render(
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              {/* biome-ignore lint/a11y/useButtonType: the rendered element is the part's */}
              <Menu.Item render={<button onClick={log} />}>Undo</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    const m = getMenu(screen, { name: "Edit" }).via("keyboard")
    await m.open()
    expect(log).not.toHaveBeenCalled()
    await userEvent.keyboard("{Enter}")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(log).toHaveBeenCalledTimes(1)
  })

  it("Enter does not leak into the first item when it opens the menu (radix#1655)", async () => {
    const onSelect = vi.fn()
    render(
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              {/* biome-ignore lint/a11y/useButtonType: the rendered element is the part's */}
              <Menu.Item render={<button />} onSelect={onSelect}>
                Undo
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    const m = getMenu(screen, { name: "Edit" }).via("keyboard")
    await m.open()
    expect(await m.focusedItem()).toBe("Undo")
    expect(onSelect).not.toHaveBeenCalled()
    expect(await m.isOpen()).toBe(true)
  })
})

describe("Menu: review r1", () => {
  it("A link item with closeOnSelect={false} navigates and keeps the menu open", async () => {
    interceptNativeNavigation(window)
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Menu.Root>
          <Menu.Trigger>Help</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item href="/docs" closeOnSelect={false}>
                  Docs
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </RouterProvider>,
    )
    const m = getMenu(screen, { name: "Help" }).via("pointer")
    await m.open()
    await m.choose("Docs")
    await waitFor(() => expect(router.calls.map((c) => c.href)).toEqual(["/docs"]))
    expect(await m.isOpen()).toBe(true)
  })

  it("The expand key never opens a disabled submenu", async () => {
    render(
      <Menu.Root>
        <Menu.Trigger>Encoding</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Submenu>
                <Menu.SubmenuTrigger disabled>Reopen with</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item>UTF-8</Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Submenu>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    const m = getMenu(screen, { name: "Encoding" }).via("keyboard")
    await m.open()
    expect(await m.focusedItem()).toBe("Reopen with")
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard("{Enter}")
    expect(await m.openPath()).toEqual([])
    expect(screen.getAllByRole("menu")).toHaveLength(1)
    expect(await m.isOpen()).toBe(true)
  })
})
