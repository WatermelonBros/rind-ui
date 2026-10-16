// Menu server markup and hydration: a closed or `defaultOpen` menu server-renders, hydrates
// without mismatch warnings, then behaves through the driver. StrictMode double effects must
// not double-select or lose focus.
import { Menu } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getMenu } from "../index"

afterEach(() => vi.restoreAllMocks())

const tree = (defaultOpen = false, onSelect: (v: string) => void = () => {}) => (
  <Menu.Root defaultOpen={defaultOpen}>
    <Menu.Trigger>Actions</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.Item onSelect={() => onSelect("copy")}>Copy</Menu.Item>
          <Menu.Item onSelect={() => onSelect("paste")}>Paste</Menu.Item>
          <Menu.Submenu>
            <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item onSelect={() => onSelect("sub")}>Nested</Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Submenu>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
)

describe("Menu hydration", () => {
  it.each([false, true])(
    "hydrates silently, then the driver opens and chooses (defaultOpen=%s)",
    async (defaultOpen) => {
      const container = document.createElement("div")
      container.innerHTML = renderToString(tree(defaultOpen))
      document.body.append(container)
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      let root: ReturnType<typeof hydrateRoot> | undefined
      const onSelect = vi.fn()
      await act(async () => {
        root = hydrateRoot(container, tree(defaultOpen, onSelect), {
          onRecoverableError: (e) => error(String(e)),
        })
      })
      const m = getMenu(screen, { name: "Actions" }).via("keyboard")
      if (!defaultOpen) {
        expect(await m.isOpen()).toBe(false)
        await m.open()
      }
      await waitFor(async () => expect(await m.isOpen()).toBe(true))
      // A defaultOpen menu skips `open()`: wait for its initial focus like `open()` does.
      await waitFor(async () => expect(await m.focusedItem()).toBe("Copy"))
      await m.choose("Paste")
      await waitFor(async () => expect(await m.isOpen()).toBe(false))
      const calls = [...error.mock.calls, ...warn.mock.calls].map((c) => String(c[0]).slice(0, 200))
      await act(async () => root?.unmount())
      container.remove()
      expect(calls).toEqual([])
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith("paste")
    },
  )

  it("server markup: closed trigger is collapsed with a menu popup", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree(false))
    const trigger = box.querySelector<HTMLElement>("button")
    expect(trigger?.getAttribute("aria-expanded")).toBe("false")
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu")
    expect(box.querySelector('[role="menu"]')).toBeNull()
  })
})

describe("Menu StrictMode", () => {
  it("opens with the keyboard on the first item, chooses once, opens a submenu with ArrowRight", async () => {
    const onSelect = vi.fn()
    render(<StrictMode>{tree(false, onSelect)}</StrictMode>)
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    expect(await m.focusedItem()).toBe("Copy")
    await m.choose("Copy")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    expect(onSelect).toHaveBeenCalledTimes(1)

    await m.open()
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}")
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Nested" })).not.toBeNull())
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Nested"))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
