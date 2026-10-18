// Menubar pointer paths with real layout (task 5.2): hover switching, a fast sweep across
// the bar, one press switching a modal menu, a touch that turns into a scroll. Pointer
// moves are dispatched at coordinates (the browser tells what is under them).
import { Menu, Menubar } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

const LABELS = ["File", "Edit", "View", "Go", "Help"]

let last: Element | null = null
afterEach(() => {
  last = null
})
const at = (x: number, y: number) => document.elementFromPoint(x, y) ?? document.body
/** One mouse movement to a point: out/over when the element under it changes, then move. */
function move(x: number, y: number, pointerType = "mouse") {
  const el = at(x, y)
  const init = { bubbles: true, composed: true, clientX: x, clientY: y, pointerType }
  if (el !== last) {
    last?.dispatchEvent(new PointerEvent("pointerout", { ...init, relatedTarget: el }))
    el.dispatchEvent(new PointerEvent("pointerover", { ...init, relatedTarget: last }))
    last = el
  }
  el.dispatchEvent(new PointerEvent("pointermove", { ...init, cancelable: true }))
}
const center = (el: Element) => {
  const r = el.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2] as const
}
const item = (name: string) => screen.getByRole("menuitem", { name })
const openNames = () =>
  screen
    .queryAllByRole("menuitem")
    .filter((el) => el.getAttribute("aria-haspopup") && el.getAttribute("aria-expanded") === "true")
    .map((el) => el.textContent)

function App() {
  return (
    <Menubar.Root aria-label="Application" style={{ display: "flex", gap: 4 }}>
      {LABELS.map((l) => (
        <Menubar.Menu key={l} value={l}>
          <Menubar.Trigger style={{ padding: "4px 8px" }}>{l}</Menubar.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value={`${l}-a`}>{`${l} one`}</Menu.Item>
                <Menu.Item value={`${l}-b`}>{`${l} two`}</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menubar.Menu>
      ))}
    </Menubar.Root>
  )
}

describe("Menubar pointer paths", () => {
  it("hover switches with no click once a menu is open; nothing opens on hover before", async () => {
    render(<App />)
    move(...center(item("Edit")))
    expect(openNames()).toEqual([])
    await userEvent.click(item("File"))
    await waitFor(() => expect(openNames()).toEqual(["File"]))
    move(...center(item("Edit")))
    await waitFor(() => expect(openNames()).toEqual(["Edit"]))
  })

  it("a fast sweep across five items: never two open, the last one open at the end", async () => {
    render(<App />)
    await userEvent.click(item("File"))
    await waitFor(() => expect(openNames()).toEqual(["File"]))
    const [x0, y] = center(item("File"))
    const [x1] = center(item("Help"))
    for (let x = x0; x <= x1; x += 3) {
      move(x, y)
      expect(openNames().length).toBeLessThanOrEqual(1)
    }
    await waitFor(() => expect(openNames()).toEqual(["Help"]))
  })

  it("one press switches a modal menu (ariakit#4023, kobaltedev/kobalte#544)", async () => {
    render(<App />)
    await userEvent.click(item("File"))
    await waitFor(() => expect(openNames()).toEqual(["File"]))
    // The bar stays outside the inert set: the press reaches the other item.
    expect(item("View").closest("[inert]")).toBeNull()
    await userEvent.click(item("View"))
    await waitFor(() => expect(openNames()).toEqual(["View"]))
  })

  it("a touch that turns into a scroll opens nothing (radix-ui/primitives#3267)", async () => {
    render(<App />)
    const el = item("File")
    const [x, y] = center(el)
    const init = { bubbles: true, composed: true, clientX: x, clientY: y, pointerType: "touch" }
    el.dispatchEvent(new PointerEvent("pointerdown", { ...init, isPrimary: true, button: 0 }))
    // The browser takes the gesture for a scroll: the pointer is cancelled, no click follows.
    el.dispatchEvent(new PointerEvent("pointercancel", init))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(openNames()).toEqual([])
  })

  it("touch never hover-switches", async () => {
    render(<App />)
    await userEvent.click(item("File"))
    await waitFor(() => expect(openNames()).toEqual(["File"]))
    move(...center(item("Edit")), "touch")
    expect(openNames()).toEqual(["File"])
  })
})
