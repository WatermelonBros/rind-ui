// Submenu pointer intent with real layout (task 5.2): hover delay, sweeps over adjacent
// submenu triggers, the diagonal path into a submenu, returning to the own trigger, resting
// in the grace area, a flipped submenu, and pointer highlight rules. Pointer moves are
// dispatched at coordinates (the browser tells what is under them); the machines' delays
// run on a virtual clock, so nothing here waits for elapsed time.
import { Menu, RindProvider } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { getMenu, virtualClock } from "../index"

let clock = virtualClock()
afterEach(() => {
  clock = virtualClock()
  last = null
})

/** The deepest element at a point. */
const at = (x: number, y: number) => document.elementFromPoint(x, y) ?? document.body

let last: Element | null = null
/** One mouse movement to a point: out/over when the element under it changes, then move. */
function move(x: number, y: number) {
  const el = at(x, y)
  const init = { bubbles: true, composed: true, clientX: x, clientY: y, pointerType: "mouse" }
  if (el !== last) {
    last?.dispatchEvent(new PointerEvent("pointerout", { ...init, relatedTarget: el }))
    last?.dispatchEvent(new PointerEvent("pointerleave", { ...init, bubbles: false }))
    el.dispatchEvent(new PointerEvent("pointerover", { ...init, relatedTarget: last }))
    el.dispatchEvent(new PointerEvent("pointerenter", { ...init, bubbles: false }))
    last = el
  }
  el.dispatchEvent(new PointerEvent("pointermove", { ...init, cancelable: true }))
}
/** A straight path in 2 px steps. */
function sweep(from: readonly [number, number], to: readonly [number, number]) {
  const [x0, y0] = from
  const [x1, y1] = to
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2))
  for (let i = 0; i <= n; i++) move(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)
}
const center = (el: Element): [number, number] => {
  const r = el.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2]
}
const item = (name: string) => screen.getByRole("menuitem", { name })
const advance = (ms: number) => act(() => clock.advance(ms))
const openPath = () =>
  [...document.querySelectorAll('[data-part="submenu-trigger"][data-state="open"]')].map(
    (e) => e.textContent,
  )

function App({ children, flip = false }: { children?: ReactNode; flip?: boolean }) {
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }}>
      <div style={flip ? { position: "fixed", right: 0, top: 0 } : { padding: 8 }}>
        <Menu.Root>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content style={{ display: "grid", width: 160 }}>
                {["Open recent", "Share", "Export", "Move to", "Copy to"].map((label) => (
                  <Menu.Submenu key={label}>
                    <Menu.SubmenuTrigger style={{ height: 24 }}>{label}</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Content style={{ display: "grid", width: 140 }}>
                          <Menu.Item style={{ height: 24 }}>{`${label} A`}</Menu.Item>
                          <Menu.Item style={{ height: 24 }}>{`${label} B`}</Menu.Item>
                          <Menu.Item style={{ height: 24 }}>{`${label} C`}</Menu.Item>
                        </Menu.Content>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Submenu>
                ))}
                <Menu.Item style={{ height: 24 }}>Close</Menu.Item>
                <Menu.Item style={{ height: 24 }} disabled>
                  Print
                </Menu.Item>
                {children}
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </RindProvider>
  )
}

/** A narrow submenu trigger above full-width items: paths into the submenu cross them. */
function Narrow() {
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }}>
      <div style={{ padding: 8 }}>
        <Menu.Root>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content style={{ display: "grid", width: 240 }}>
                {/* Placed past the parent's edge, so a path into it crosses "Close" and "Save". */}
                <Menu.Submenu positioning={{ sideOffset: 150 }}>
                  <Menu.SubmenuTrigger style={{ height: 24, width: 100 }}>
                    Open recent
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Content style={{ display: "grid", width: 140 }}>
                        <Menu.Item style={{ height: 24 }}>Open recent A</Menu.Item>
                        <Menu.Item style={{ height: 24 }}>Open recent B</Menu.Item>
                        <Menu.Item style={{ height: 24 }}>Open recent C</Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Submenu>
                <Menu.Item style={{ height: 24 }}>Close</Menu.Item>
                <Menu.Item style={{ height: 24 }}>Save</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </RindProvider>
  )
}

async function openFile() {
  await getMenu(screen, { name: "File" }).via("pointer").open()
}

/** Hovers a submenu trigger and runs its open delay; resolves once the submenu is placed. */
async function hoverOpen(name: string) {
  move(...center(item(name)))
  await advance(100)
  await waitFor(() => expect(openPath()).toEqual([name]))
  await waitFor(() => expect(document.querySelector('[role="menu"][data-placing]')).toBe(null))
}

describe("Menu: submenu pointer intent", () => {
  it("Hover opens a submenu after its delay; focus stays on the trigger item", async () => {
    render(<App />)
    await openFile()
    move(...center(item("Share")))
    await advance(99)
    expect(openPath()).toEqual([])
    await advance(1)
    await waitFor(() => expect(openPath()).toEqual(["Share"]))
    expect(document.activeElement?.textContent).toBe("Share")
  })

  it("Sweeping across submenu triggers opens only the last one (mui/base-ui#5152, zag#2811)", async () => {
    render(<App />)
    await openFile()
    sweep(center(item("Open recent")), center(item("Copy to")))
    await advance(100)
    await waitFor(() => expect(openPath()).toEqual(["Copy to"]))
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2)
  })

  it("Diagonal path to a submenu: crossed items are never highlighted (zag#2955, radix#3761)", async () => {
    render(<Narrow />)
    await openFile()
    await hoverOpen("Open recent")
    const highlighted = new Set<string>()
    const observer = new MutationObserver(() => {
      for (const el of document.querySelectorAll("[data-highlighted]")) {
        highlighted.add(el.textContent ?? "")
      }
    })
    observer.observe(document.body, { subtree: true, attributes: true })
    // Out of the narrow trigger's right side, down across "Close" and "Save" (full width),
    // into the middle of the submenu's last item.
    const r = item("Open recent").getBoundingClientRect()
    sweep([r.right - 4, r.top + 4], center(item("Open recent C")))
    await act(async () => {})
    observer.disconnect()
    expect(openPath()).toEqual(["Open recent"])
    expect([...highlighted].filter((t) => t === "Close" || t === "Save")).toEqual([])
  })

  it("Resting in the grace area ends it: the submenu closes, the item under the pointer is highlighted (radix#2935)", async () => {
    render(<Narrow />)
    await openFile()
    await hoverOpen("Open recent")
    // Along the straight path into the submenu, stopping where it is over "Close".
    const r = item("Open recent").getBoundingClientRect()
    const from: [number, number] = [r.right - 4, r.top + 4]
    const to = center(item("Open recent C"))
    const [, cy] = center(item("Close"))
    const t = (cy - from[1]) / (to[1] - from[1])
    sweep(from, [from[0] + (to[0] - from[0]) * t, cy])
    await act(async () => {})
    expect(openPath()).toEqual(["Open recent"])
    await advance(300)
    await waitFor(() => expect(openPath()).toEqual([]))
    await waitFor(() => expect(item("Close").hasAttribute("data-highlighted")).toBe(true))
    expect(document.activeElement).toBe(item("Close"))
  })

  it("Flipped submenu: a flick onto its item and a click activates it (radix#4036)", async () => {
    render(<App flip />)
    await openFile()
    await hoverOpen("Export")
    const sub = document.querySelectorAll('[role="menu"]')[1]
    expect(sub?.getAttribute("data-side")).toBe("left")
    sweep(center(item("Export")), center(item("Export B")))
    await act(async () => {})
    expect(openPath()).toEqual(["Export"])
    item("Export B").click()
    await waitFor(() => expect(screen.queryAllByRole("menu")).toHaveLength(0))
  })
})

describe("Menu: pointer highlight", () => {
  it("Hovering a disabled item clears the pointer highlight (mui/base-ui#1733)", async () => {
    render(<App />)
    await openFile()
    sweep(center(item("Close")), center(item("Close")))
    await waitFor(() => expect(item("Close").hasAttribute("data-highlighted")).toBe(true))
    sweep(center(item("Close")), center(item("Print")))
    await waitFor(() => expect(item("Close").hasAttribute("data-highlighted")).toBe(false))
    expect(item("Print").hasAttribute("data-highlighted")).toBe(false)
  })

  it("Pointer leaves the content: no item stays highlighted (reka-ui#2596)", async () => {
    render(<App />)
    await openFile()
    sweep(center(item("Close")), center(item("Close")))
    await waitFor(() => expect(item("Close").hasAttribute("data-highlighted")).toBe(true))
    const r = item("Close").getBoundingClientRect()
    sweep(center(item("Close")), [r.right + 200, r.top])
    await waitFor(() => expect(document.querySelector("[data-highlighted]")).toBe(null))
  })

  it("Input inside the menu keeps focus while the pointer moves over items (radix#2193)", async () => {
    render(
      <App>
        <input aria-label="Search" />
      </App>,
    )
    await openFile()
    const search = screen.getByRole("textbox", { name: "Search" })
    search.focus()
    sweep(center(search), center(item("Close")))
    await waitFor(() => expect(item("Close").hasAttribute("data-highlighted")).toBe(true))
    expect(document.activeElement).toBe(search)
  })
})
