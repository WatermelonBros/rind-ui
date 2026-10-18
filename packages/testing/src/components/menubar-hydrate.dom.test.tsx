// Menubar server markup (spec "One Tab Stop"): the first item is the tab stop before
// hydration, and hydration is silent.
import { Menu, Menubar } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (
  <Menubar.Root aria-label="Application">
    {["File", "Edit", "View"].map((l) => (
      <Menubar.Menu key={l} value={l}>
        <Menubar.Trigger>{l}</Menubar.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value={`${l}-1`}>{`${l} item`}</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menubar.Menu>
    ))}
  </Menubar.Root>
)

const items = (box: Element) => [...box.querySelectorAll<HTMLElement>('[data-host="menubar"]')]

describe("Menubar hydration", () => {
  it("server markup: role menubar, menuitem items, the first is the only tab stop", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree)
    expect(box.querySelector('[role="menubar"]')?.getAttribute("aria-label")).toBe("Application")
    const all = items(box)
    expect(all.map((i) => i.getAttribute("role"))).toEqual(["menuitem", "menuitem", "menuitem"])
    expect(all.filter((i) => i.getAttribute("tabindex") === "0").map((i) => i.textContent)).toEqual(
      ["File"],
    )
  })

  it("hydrates without warnings and keeps one tab stop", async () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree)
    document.body.append(box)
    const error = vi.spyOn(console, "error")
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(box, tree)
    })
    expect(error).not.toHaveBeenCalled()
    expect(items(box).filter((i) => i.getAttribute("tabindex") === "0")).toHaveLength(1)
    act(() => root?.unmount())
    box.remove()
  })
})
