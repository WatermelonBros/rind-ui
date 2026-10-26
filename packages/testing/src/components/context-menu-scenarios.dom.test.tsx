// Context Menu regression scenarios (openspec add-context-menu): one test per scenario, named
// after the spec scenario and the upstream issue it guards. jsdom and chromium unless layout
// is needed. Long presses run on a virtual clock: nothing here waits for elapsed time.
import {
  ContextMenu,
  type ContextMenuActions,
  type ContextMenuRootProps,
  Menu,
  Popover,
  RindProvider,
} from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { domEnv, getContextMenu, virtualClock } from "../index"

const isJsdom = navigator.userAgent.includes("jsdom")
const active = () => document.activeElement

type Props = Partial<ContextMenuRootProps> & {
  children?: ReactNode
  label?: string
  menuLabel?: string | null
  onSelect?: (v: string) => void
}

function Files({
  children,
  label = "README.md",
  menuLabel = "File actions",
  onSelect = () => {},
  ...root
}: Props) {
  return (
    <ContextMenu.Root {...root}>
      <ContextMenu.Trigger style={{ width: 300, height: 120 }}>
        <button type="button">{label}</button>
        {children}
      </ContextMenu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content {...(menuLabel === null ? {} : { "aria-label": menuLabel })}>
            <Menu.Item onSelect={() => onSelect("rename")}>Rename</Menu.Item>
            <Menu.Item onSelect={() => onSelect("delete")}>Delete</Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </ContextMenu.Root>
  )
}

/** Renders on a fresh virtual clock; returns it with a touch-capable driver target. */
function onClock(ui: ReactNode) {
  const clock = virtualClock()
  render(<RindProvider environment={{ scheduler: clock.scheduler }}>{ui}</RindProvider>)
  return { clock, target: domEnv({ advanceClock: (ms) => clock.advance(ms) }) }
}

const touch = (type: string, el: Element, x: number, y: number, pointerType = "touch") =>
  act(() => {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        pointerId: 7,
        pointerType,
        isPrimary: true,
        buttons: type === "pointerup" ? 0 : 1,
      }),
    )
  })

const contextmenu = (el: Element, x = 5, y = 5) =>
  act(() => {
    el.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    )
  })

const menus = () => screen.queryAllByRole("menu")

afterEach(() => vi.restoreAllMocks())

describe("ContextMenu scenarios: long press", () => {
  it("Long press opens at the finger, content focused, nothing highlighted (radix#701)", async () => {
    const { target } = onClock(<Files />)
    const c = getContextMenu(target, { text: "README.md" }).via("touch")
    await c.openAt()
    expect(await c.isOpen()).toBe(true)
    expect(active()?.getAttribute("role")).toBe("menu")
    expect(await c.highlighted()).toBe(null)
  })

  it("Jitter: a 4 px move still opens, a 15 px move does not", async () => {
    const { clock } = onClock(<Files />)
    const row = screen.getByRole("button", { name: "README.md" })
    await touch("pointerdown", row, 50, 50)
    await touch("pointermove", row, 54, 50)
    act(() => clock.advance(500))
    await waitFor(() => expect(menus()).toHaveLength(1))
    await touch("pointerup", row, 54, 50)
  })

  it("Jitter: a 15 px move cancels the press", async () => {
    const { clock } = onClock(<Files />)
    const row = screen.getByRole("button", { name: "README.md" })
    await touch("pointerdown", row, 50, 50)
    await touch("pointermove", row, 65, 50)
    act(() => clock.advance(500))
    expect(menus()).toHaveLength(0)
    await touch("pointerup", row, 65, 50)
    expect(menus()).toHaveLength(0)
  })

  it("Stylus: a pen held 500 ms opens it (mui/base-ui#4854)", async () => {
    const { clock } = onClock(<Files />)
    const row = screen.getByRole("button", { name: "README.md" })
    await touch("pointerdown", row, 50, 50, "pen")
    act(() => clock.advance(500))
    await waitFor(() => expect(menus()).toHaveLength(1))
    await touch("pointerup", row, 50, 50, "pen")
  })

  it("Opt out: longPress={false} opens nothing (radix#748)", async () => {
    const { clock } = onClock(<Files longPress={false} />)
    const row = screen.getByRole("button", { name: "README.md" })
    await touch("pointerdown", row, 50, 50)
    act(() => clock.advance(1000))
    await touch("pointerup", row, 50, 50)
    expect(menus()).toHaveLength(0)
  })

  it("Android: a long press then the native contextmenu opens once", async () => {
    const onOpenChange = vi.fn()
    const { target } = onClock(<Files onOpenChange={onOpenChange} />)
    const c = getContextMenu(target, { text: "README.md" }).via("touch")
    await c.openAt()
    contextmenu(screen.getByText("README.md"), 50, 50)
    expect(await c.isOpen()).toBe(true)
    expect(onOpenChange.mock.calls.filter(([open]) => open === true)).toHaveLength(1)
  })
})

describe("ContextMenu scenarios: several regions", () => {
  it("Pane menu around a row menu: only the inner one opens (radix#4165)", async () => {
    const { target } = onClock(
      <ContextMenu.Root>
        <ContextMenu.Trigger style={{ width: 400, height: 200 }}>
          <Files label="Row" menuLabel="Row actions" />
        </ContextMenu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content aria-label="Pane actions">
              <Menu.Item>Paste</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </ContextMenu.Root>,
    )
    const row = getContextMenu(target, { text: "Row" })
    await row.via("touch").openAt()
    expect(menus().map((m) => m.getAttribute("aria-label"))).toEqual(["Row actions"])
  })

  it("Pane menu around a row menu: right click on the row opens only the row's", async () => {
    render(
      <ContextMenu.Root>
        <ContextMenu.Trigger style={{ width: 400, height: 200 }}>
          <Files label="Row" menuLabel="Row actions" />
        </ContextMenu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content aria-label="Pane actions">
              <Menu.Item>Paste</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </ContextMenu.Root>,
    )
    await getContextMenu(screen, { text: "Row" }).via("pointer").openAt()
    expect(menus().map((m) => m.getAttribute("aria-label"))).toEqual(["Row actions"])
  })

  it("Fast right clicks across regions end with exactly one menu (bits-ui#1743)", async () => {
    render(
      ["A", "B", "C"].map((n) => (
        <Files key={n} label={n} menuLabel={`${n} actions`} modal={false} />
      )),
    )
    for (const n of ["A", "B", "C"]) {
      await getContextMenu(screen, { text: n, modal: false }).via("pointer").openAt()
    }
    await waitFor(() => expect(menus()).toHaveLength(1))
    expect(menus()[0]?.getAttribute("aria-label")).toBe("C actions")
  })

  it("Region inside a popover: a left click in it keeps the popover open (bits-ui#1948)", async () => {
    render(
      <Popover.Root defaultOpen modal={false}>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Filters panel">
              <Files />
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    const row = await screen.findByText("README.md")
    await waitFor(() => expect(getComputedStyle(row).pointerEvents).not.toBe("none"))
    await userEvent.click(row)
    expect(screen.queryByLabelText("Filters panel")).not.toBe(null)
    expect(screen.getByText("README.md")).toBeTruthy()
  })
})

describe("ContextMenu scenarios: while open", () => {
  it("Right click on an item keeps it open, selects nothing (mui/base-ui#3595)", async () => {
    const onSelect = vi.fn()
    render(<Files onSelect={onSelect} />)
    const c = getContextMenu(screen, { text: "README.md" }).via("pointer")
    await c.openAt()
    contextmenu(screen.getByRole("menuitem", { name: "Rename" }))
    expect(await c.isOpen()).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("Non-modal: a page scroll closes it with reason scroll (radix#2795)", async () => {
    const onOpenChange = vi.fn()
    render(
      <>
        <div data-testid="page" style={{ height: 50, overflow: "auto" }}>
          <div style={{ height: 500 }}>Page</div>
        </div>
        <Files modal={false} onOpenChange={onOpenChange} />
      </>,
    )
    const c = getContextMenu(screen, { text: "README.md", modal: false }).via("pointer")
    await c.openAt()
    act(() => {
      screen.getByTestId("page").dispatchEvent(new Event("scroll"))
    })
    await waitFor(async () => expect(await c.isOpen()).toBe(false))
    const [open, details] = onOpenChange.mock.lastCall ?? []
    expect(open).toBe(false)
    expect(details.reason).toBe("scroll")
  })

  it("Non-modal on a focusable region: Tab moves on from the row, not into the region (base-ui#6063 class)", async () => {
    render(
      <>
        <ContextMenu.Root modal={false}>
          <ContextMenu.Trigger tabIndex={0}>
            <button type="button">first.md</button>
            <button type="button">second.md</button>
          </ContextMenu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content aria-label="File actions">
                <Menu.Item>Rename</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </ContextMenu.Root>
        <button type="button">After</button>
      </>,
    )
    const row = screen.getByRole("button", { name: "second.md" })
    act(() => row.focus())
    await userEvent.keyboard("{Shift>}{F10}{/Shift}")
    await waitFor(() => expect(active()?.textContent).toBe("Rename"))
    await userEvent.keyboard("{Tab}")
    await waitFor(() => expect(active()).toBe(screen.getByRole("button", { name: "After" })))
  })
})

describe("ContextMenu scenarios: programmatic and dev warnings", () => {
  it("Unnamed: one warning naming the instance after opening", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Files menuLabel={null} />)
    await getContextMenu(screen, { text: "README.md" }).via("pointer").openAt()
    const calls = warn.mock.calls.filter(([m]) => String(m).includes("no accessible name"))
    expect(calls).toHaveLength(1)
    expect(String(calls[0]?.[0])).toMatch(/context-menu \S+:/)
  })

  it("Document-wide edit menu: actionsRef.openAt(point, field) reports the field and api", async () => {
    const actions = createRef<ContextMenuActions>()
    const onOpenChange = vi.fn()
    render(
      <>
        <input aria-label="Field" />
        <Files actionsRef={actions} onOpenChange={onOpenChange} />
      </>,
    )
    const field = screen.getByLabelText("Field")
    act(() => actions.current?.openAt({ x: 40, y: 40 }, field))
    await waitFor(() => expect(menus()).toHaveLength(1))
    const [open, details] = onOpenChange.mock.calls[0] ?? []
    expect(open).toBe(true)
    expect(details.target).toBe(field)
    expect(details.reason).toBe("api")
  })

  it("Controlled open without a point: one dev warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Files open onOpenChange={() => {}} />)
    const calls = warn.mock.calls.filter(([m]) => String(m).includes("opened without a point"))
    expect(calls).toHaveLength(1)
  })
})

describe("ContextMenu scenarios: layout (browser only)", () => {
  it.runIf(!isJsdom)("Bottom-right corner: it flips inside the viewport (radix#3066)", async () => {
    render(
      <ContextMenu.Root>
        <ContextMenu.Trigger style={{ position: "fixed", inset: 0 }}>
          <button type="button">Canvas</button>
        </ContextMenu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content aria-label="Canvas actions">
              <Menu.Item>Rename</Menu.Item>
              <Menu.Item>Delete</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </ContextMenu.Root>,
    )
    const c = getContextMenu(screen, { text: "Canvas" }).via("pointer")
    await c.openAt({ x: 0.98, y: 0.98 })
    const box = screen.getByRole("menu").getBoundingClientRect()
    expect(box.right).toBeLessThanOrEqual(window.innerWidth)
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    // Flipped to the other side of the point, not just clamped.
    const px = window.innerWidth * 0.98
    const py = window.innerHeight * 0.98
    expect(box.left < px - 1 || box.top < py - 1).toBe(true)
  })

  it.runIf(!isJsdom)("Inside a scaled layer: it opens at the pointer (within 2 px)", async () => {
    render(
      <div style={{ transform: "scale(1.25)", transformOrigin: "0 0", position: "relative" }}>
        <Files />
      </div>,
    )
    const row = screen.getByRole("button", { name: "README.md" })
    contextmenu(row, 100, 80)
    await waitFor(() => expect(menus()).toHaveLength(1))
    await waitFor(() => {
      const box = screen.getByRole("menu").getBoundingClientRect()
      expect(Math.abs(box.left - 100)).toBeLessThanOrEqual(2)
      expect(Math.abs(box.top - 80)).toBeLessThanOrEqual(2)
    })
  })
})

describe("ContextMenu: review r1", () => {
  it("At most one context menu per document: opening one (even by openAt) closes the other", async () => {
    const a = createRef<ContextMenuActions>()
    const b = createRef<ContextMenuActions>()
    render(
      (
        [
          ["0", a],
          ["1", b],
        ] as const
      ).map(([i, ref]) => (
        <ContextMenu.Root key={i} actionsRef={ref} modal={false}>
          <ContextMenu.Trigger>{`Region ${i}`}</ContextMenu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content aria-label={`Menu ${i}`}>
                <Menu.Item>Item</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </ContextMenu.Root>
      )),
    )
    act(() => a.current?.openAt({ x: 10, y: 10 }))
    await waitFor(() => expect(screen.getByRole("menu", { name: "Menu 0" })).toBeTruthy())
    act(() => b.current?.openAt({ x: 20, y: 20 }))
    await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(1))
    expect(screen.getByRole("menu", { name: "Menu 1" })).toBeTruthy()
  })

  it("The platform callout is suppressed on the region during a touch press", () => {
    render(
      <ContextMenu.Root>
        <ContextMenu.Trigger>Photo</ContextMenu.Trigger>
      </ContextMenu.Root>,
    )
    const region = screen.getByText("Photo")
    const init = { bubbles: true, cancelable: true, pointerId: 3, pointerType: "touch" }
    act(() => {
      region.dispatchEvent(new PointerEvent("pointerdown", init))
    })
    expect(region.hasAttribute("data-rind-long-pressing")).toBe(true)
    // WebKit is the engine with a callout; elsewhere the property is unknown.
    if (CSS.supports("-webkit-touch-callout", "none")) {
      expect(region.style.getPropertyValue("-webkit-touch-callout")).toBe("none")
    }
    act(() => {
      region.dispatchEvent(new PointerEvent("pointerup", init))
    })
    expect(region.hasAttribute("data-rind-long-pressing")).toBe(false)
  })
})
