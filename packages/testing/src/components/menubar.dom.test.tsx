// Menubar scenarios (openspec add-menubar): the spec's behaviour in jsdom and real browsers.
import {
  Menu,
  Menubar,
  type MenubarActions,
  type MenubarRootProps,
  RindProvider,
} from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, lazy, StrictMode, Suspense, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { getMenubar } from "../index"

const active = () => document.activeElement
const name = (el: Element | null) => el?.textContent?.trim() ?? null
const open = () =>
  screen
    .queryAllByRole("menuitem")
    .filter((el) => el.getAttribute("aria-expanded") === "true")
    .map((el) => name(el))

function App({
  onSelect = () => {},
  editDisabled = false,
  ...root
}: Partial<MenubarRootProps> & { onSelect?: (k: string) => void; editDisabled?: boolean }) {
  const menu = (value: string, label: string, items: string[], disabled = false) => (
    <Menubar.Menu value={value} disabled={disabled}>
      <Menubar.Trigger>{label}</Menubar.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            {items.map((i) => (
              <Menu.Item key={i} value={i} onSelect={() => onSelect(i)}>
                {i}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menubar.Menu>
  )
  return (
    <>
      <button type="button">Before</button>
      <Menubar.Root aria-label="Application" {...root}>
        {menu("file", "File", ["New", "Open"])}
        {menu("edit", "Edit", ["Undo", "Find…"], editDisabled)}
        {menu("view", "View", ["Zoom"])}
      </Menubar.Root>
      <button type="button">After</button>
    </>
  )
}

describe("menubar", () => {
  it("is one tab stop with arrow keys and typeahead", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.tab()
    await user.tab()
    expect(name(active())).toBe("File")
    await user.keyboard("{ArrowRight}")
    expect(name(active())).toBe("Edit")
    await user.keyboard("{ArrowLeft}")
    expect(name(active())).toBe("File")
    await user.keyboard("v")
    expect(name(active())).toBe("View")
    expect(open()).toEqual([])
    await user.tab()
    expect(name(active())).toBe("After")
    await user.tab({ shift: true })
    expect(name(active())).toBe("View")
  })

  it("opens by key, switches by arrow, closes by Escape", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<App onValueChange={onValueChange} />)
    await user.tab()
    await user.tab()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(name(active())).toBe("New"))
    expect(open()).toEqual(["File"])
    await user.keyboard("{ArrowRight}")
    await waitFor(() => expect(name(active())).toBe("Undo"))
    expect(open()).toEqual(["Edit"])
    await user.keyboard("{Escape}")
    await waitFor(() => expect(name(active())).toBe("Edit"))
    expect(open()).toEqual([])
    expect(onValueChange.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([
      ["file", "trigger"],
      ["edit", "menu-navigate"],
      [null, "escape-key"],
    ])
  })

  it("one press switches, hover switches, open mode ends on close", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("menuitem", { name: "File" }))
    expect(open()).toEqual(["File"])
    await user.click(screen.getByRole("menuitem", { name: "Edit" }))
    expect(open()).toEqual(["Edit"])
    await user.hover(screen.getByRole("menuitem", { name: "View" }))
    expect(open()).toEqual(["View"])
    // The click that follows the hover keeps the menu it opened; the next one closes it.
    await user.click(screen.getByRole("menuitem", { name: "View" }))
    expect(open()).toEqual(["View"])
    await user.click(screen.getByRole("menuitem", { name: "View" }))
    expect(open()).toEqual([])
    await user.hover(screen.getByRole("menuitem", { name: "File" }))
    expect(open()).toEqual([])
  })

  it("skips a disabled item when switching by keyboard", async () => {
    const user = userEvent.setup()
    render(<App editDisabled />)
    await user.tab()
    await user.tab()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(name(active())).toBe("New"))
    await user.keyboard("{ArrowRight}")
    await waitFor(() => expect(open()).toEqual(["View"]))
  })

  it("runs an item and closes", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<App onSelect={onSelect} />)
    await user.click(screen.getByRole("menuitem", { name: "Edit" }))
    const positioner = () => document.querySelector('[data-scope="menu"][data-part="positioner"]')
    await waitFor(() =>
      expect(positioner()?.getAttribute("style")).not.toContain("pointer-events: none"),
    )
    // Modal: the page is inert, the open menu and the bar are not.
    expect(positioner()?.closest("[inert]")).toBeNull()
    expect(screen.getByRole("menubar").closest("[inert]")).toBeNull()
    expect(screen.getByRole("button", { name: "After" }).closest("[inert]")).not.toBeNull()
    await user.click(screen.getByRole("menuitem", { name: "Find…" }))
    expect(onSelect).toHaveBeenCalledWith("Find…")
    await waitFor(() => expect(open()).toEqual([]))
  })

  it("driver round trip (spec scenario)", async () => {
    const onSelect = vi.fn()
    render(<App onSelect={onSelect} />)
    const bar = getMenubar(screen, { name: "Application" })
    expect(await bar.items()).toEqual(["File", "Edit", "View"])
    await bar.openMenu("File")
    await bar.switchTo("Edit")
    await bar.menu("Edit").choose("Find…")
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(await bar.currentMenu()).toBeNull()
  })

  it("driver round trip by keyboard", async () => {
    const onSelect = vi.fn()
    render(<App onSelect={onSelect} />)
    const bar = getMenubar(screen, { name: "Application" }).via("keyboard")
    await bar.tabIn()
    await bar.moveTo("View")
    await bar.openMenu("File")
    await bar.switchTo("View")
    expect(await bar.currentMenu()).toBe("View")
    await bar.closeMenu()
    expect(await bar.focusedItem()).toBe("View")
    await bar.tabOut()
    expect(await bar.tabStop()).toBe("View")
  })

  it("roles: menubar, menuitem items with a popup, wrappers none, no aria-owns (ariakit#5262)", async () => {
    const user = userEvent.setup()
    render(<App />)
    const bar = screen.getByRole("menubar", { name: "Application" })
    expect(bar.getAttribute("aria-orientation")).toBeNull()
    const items = screen.getAllByRole("menuitem")
    expect(items.map((i) => i.getAttribute("aria-haspopup"))).toEqual(["menu", "menu", "menu"])
    await user.click(items[1] as HTMLElement)
    expect(document.querySelector("[aria-owns]")).toBeNull()
    const menu = await screen.findByRole("menu")
    expect(menu.getAttribute("aria-labelledby")).toBe(items[1]?.id)
    expect(bar.getAttribute("data-state")).toBe("open")
    expect(items.map((i) => i.getAttribute("data-state"))).toEqual(["closed", "open", "closed"])
  })

  it("arrows never open and leave no stale highlight (unovue/reka-ui#164)", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.tab()
    await user.tab()
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(open()).toEqual([])
    const highlighted = screen
      .getAllByRole("menuitem")
      .filter((i) => i.hasAttribute("data-highlighted"))
      .map(name)
    expect(highlighted).toEqual(["View"])
  })

  it("ArrowUp opens on the last item; ArrowDown on the first", async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.tab()
    await user.tab()
    await user.keyboard("{ArrowUp}")
    await waitFor(() => expect(name(active())).toBe("Open"))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(name(active())).toBe("File"))
    await user.keyboard("{ArrowDown}")
    await waitFor(() => expect(name(active())).toBe("New"))
  })

  it("vertical: Up/Down on the bar, the expand key opens, collapse closes (ariakit#7410)", async () => {
    const user = userEvent.setup()
    render(<App orientation="vertical" />)
    expect(screen.getByRole("menubar").getAttribute("aria-orientation")).toBe("vertical")
    await user.tab()
    await user.tab()
    await user.keyboard("{ArrowDown}")
    expect(name(active())).toBe("Edit")
    expect(open()).toEqual([])
    await user.keyboard("{ArrowRight}")
    await waitFor(() => expect(name(active())).toBe("Undo"))
    // The expand key on a plain item does nothing; collapse closes back to the item.
    await user.keyboard("{ArrowRight}")
    expect(open()).toEqual(["Edit"])
    await user.keyboard("{ArrowLeft}")
    await waitFor(() => expect(name(active())).toBe("Edit"))
    expect(open()).toEqual([])
  })

  it("right-to-left: ArrowLeft switches to the next menu", async () => {
    const user = userEvent.setup()
    render(
      <RindProvider dir="rtl">
        <App />
      </RindProvider>,
    )
    await user.tab()
    await user.tab()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(name(active())).toBe("New"))
    await user.keyboard("{ArrowLeft}")
    await waitFor(() => expect(open()).toEqual(["Edit"]))
  })

  it("Tab closes the menu and leaves the bar", async () => {
    const user = userEvent.setup()
    const changes = vi.fn()
    render(<App onValueChange={changes} />)
    await user.click(screen.getByRole("menuitem", { name: "File" }))
    await user.tab()
    await waitFor(() => expect(name(active())).toBe("After"))
    expect(open()).toEqual([])
    expect(changes.mock.calls.at(-1)?.[1].reason).toBe("tab-key")
  })

  it("a disabled menubar: aria-disabled items, nothing opens (mui/base-ui#2727)", async () => {
    const user = userEvent.setup()
    render(<App disabled />)
    const items = screen.getAllByRole("menuitem")
    expect(items.map((i) => i.getAttribute("aria-disabled"))).toEqual(["true", "true", "true"])
    await user.click(items[0] as HTMLElement)
    await user.keyboard("{Enter}{ArrowDown}")
    expect(open()).toEqual([])
  })

  it("defaultValue opens its menu on mount", async () => {
    render(<App defaultValue="edit" />)
    await waitFor(() => expect(open()).toEqual(["Edit"]))
  })

  it("controlled: a programmatic value, then hover, never two open (ariakit#7083)", async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [value, setValue] = useState<string | null>(null)
      return (
        <>
          <button type="button" onClick={() => setValue("view")}>
            Shortcut
          </button>
          <App value={value} onValueChange={setValue} modal={false} />
        </>
      )
    }
    render(<Controlled />)
    await user.click(screen.getByRole("button", { name: "Shortcut" }))
    await waitFor(() => expect(open()).toEqual(["View"]))
    await user.hover(screen.getByRole("menuitem", { name: "File" }))
    await waitFor(() => expect(open()).toEqual(["File"]))
  })

  it("non-modal: an outside press closes and reaches the page", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <>
        <App modal={false} />
        <button type="button" onClick={onClick}>
          Page
        </button>
      </>,
    )
    await user.click(screen.getByRole("menuitem", { name: "File" }))
    await user.click(screen.getByRole("button", { name: "Page" }))
    expect(onClick).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(open()).toEqual([]))
  })

  it("focus() reaches the tab stop and opens nothing", async () => {
    const ref = createRef<MenubarActions>()
    render(<App actionsRef={ref} />)
    act(() => ref.current?.focus())
    expect(name(active())).toBe("File")
    expect(open()).toEqual([])
  })

  it("Strict Mode: opens, switches, closes", async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    await user.click(screen.getByRole("menuitem", { name: "File" }))
    await user.hover(screen.getByRole("menuitem", { name: "Edit" }))
    expect(open()).toEqual(["Edit"])
    await user.keyboard("{Escape}")
    await waitFor(() => expect(open()).toEqual([]))
  })

  it("warns once for an unnamed menubar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<App aria-label={undefined as never} />)
    expect(
      warn.mock.calls.some(
        (c) => String(c[0]).includes("menubar") && String(c[0]).includes("no accessible name"),
      ),
    ).toBe(true)
    warn.mockRestore()
  })

  it("a menu whose content is inside a Suspense boundary opens (radix-ui/primitives#2569)", async () => {
    const user = userEvent.setup()
    const Items = lazy(async () => ({
      default: () => <Menu.Item value="late">Late item</Menu.Item>,
    }))
    render(
      <Menubar.Root aria-label="Application">
        <Menubar.Menu value="file">
          <Menubar.Trigger>File</Menubar.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Suspense fallback={null}>
                  <Items />
                </Suspense>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menubar.Menu>
      </Menubar.Root>,
    )
    await user.click(screen.getByRole("menuitem", { name: "File" }))
    expect(await screen.findByRole("menuitem", { name: "Late item" })).toBeTruthy()
    expect(open()).toEqual(["File"])
  })

  it("a menu portalled into a given container, e.g. a fullscreen element (huntabyte/bits-ui#1203)", async () => {
    const user = userEvent.setup()
    const stage = document.createElement("div")
    document.body.append(stage)
    render(
      <Menubar.Root aria-label="Application">
        <Menubar.Menu value="file">
          <Menubar.Trigger>File</Menubar.Trigger>
          <Menu.Portal container={stage}>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="new">New</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menubar.Menu>
      </Menubar.Root>,
    )
    await user.click(screen.getByRole("menuitem", { name: "File" }))
    const item = await screen.findByRole("menuitem", { name: "New" })
    expect(stage.contains(item)).toBe(true)
    stage.remove()
  })
})
