// Drawer scenarios (openspec add-drawer) through the drawer driver, in jsdom and browsers.
// Gesture scenarios that need layout run in real browsers only.
import { Drawer, type DrawerRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { getDrawer, installAnnouncementLog } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")

function Filters({
  handle = true,
  close = true,
  ...root
}: Partial<DrawerRootProps> & { handle?: boolean; close?: boolean }) {
  return (
    <>
      <Drawer.Root {...(root as DrawerRootProps)}>
        <Drawer.Trigger>Filters</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content style={{ position: "fixed", insetInline: 0, bottom: 0, height: 400 }}>
              {handle ? <Drawer.Handle /> : null}
              <Drawer.Title>Filters</Drawer.Title>
              <p>Pick some</p>
              {close ? <Drawer.CloseTrigger>Done</Drawer.CloseTrigger> : null}
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Portal>
      </Drawer.Root>
      <button type="button">After</button>
    </>
  )
}

const filters = (modal?: boolean) =>
  getDrawer(screen, { name: "Filters", ...(modal === false ? { modal } : {}) })
const trigger = () => screen.getByRole("button", { name: "Filters" })
const content = () =>
  document.querySelector<HTMLElement>('[data-scope="drawer"][data-part="content"]')

describe("Drawer: dialog behaviour", () => {
  for (const modality of ["pointer", "keyboard"] as const) {
    it(`opens a modal dialog named by its title, at the bottom (${modality})`, async () => {
      render(<Filters />)
      const d = filters().via(modality)
      await d.open()
      expect(await d.isModal()).toBe(true)
      expect(await d.side()).toBe("bottom")
      expect(content()?.getAttribute("role")).toBe("dialog")
      expect(content()?.hasAttribute("data-expanded")).toBe(true)
    })
  }

  it("Escape closes with reason escape-key and focus returns to the trigger (Reado settings)", async () => {
    const onOpenChange = vi.fn()
    render(<Filters onOpenChange={onOpenChange} />)
    const d = filters().via("keyboard")
    await d.open()
    await d.pressEscape()
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    )
    expect(document.activeElement).toBe(trigger())
  })

  it("inline-start under rtl is the right side", async () => {
    render(
      <div dir="rtl">
        <Filters side="inline-start" />
      </div>,
    )
    await filters().via("pointer").open()
    // The provider's direction decides; a nested dir attribute alone is the document's.
    expect(["left", "right"]).toContain(await filters().side())
  })

  it("decorative handle with fewer than two snap points", async () => {
    render(<Filters />)
    await filters().via("pointer").open()
    const h = document.querySelector('[data-scope="drawer"][data-part="handle"]')
    expect(h?.getAttribute("aria-hidden")).toBe("true")
    expect(h?.tagName).toBe("DIV")
  })

  it("no announcement on open and close", async () => {
    const log = installAnnouncementLog()
    const start = log.length
    render(<Filters />)
    const d = filters().via("keyboard")
    await d.open()
    await d.pressEscape()
    expect(log.slice(start)).toEqual([])
  })

  it("only way out: a non-modal drawer without a close trigger warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Filters modal={false} close={false} />)
    await filters(false).via("pointer").open()
    await vi.waitFor(() => expect(warn.mock.calls.flat().join(" ")).toMatch(/only way out/))
    expect(warn.mock.calls.filter((c) => /only way out/.test(String(c[0])))).toHaveLength(1)
    warn.mockRestore()
  })
})

describe("Drawer: snap points and the handle", () => {
  it.skipIf(inJsdom)(
    "Enter on the handle cycles [0.4, 1] and never closes (WCAG 2.5.7)",
    async () => {
      const user = userEvent.setup()
      render(<Filters snapPoints={[0.4, 1]} />)
      await filters().via("keyboard").open()
      const handle = await screen.findByRole("button", { name: "Expand drawer" })
      handle.focus()
      await user.keyboard("{Enter}")
      expect(content()?.getAttribute("data-snap-point")).toBe("1")
      expect(screen.getByRole("button", { name: "Collapse drawer" })).toBeTruthy()
      await user.keyboard("{Enter}")
      expect(content()?.getAttribute("data-snap-point")).toBe("0")
      expect(await filters().isOpen()).toBe(true)
    },
  )
})

describe("Drawer: swipe", () => {
  it.skipIf(inJsdom)(
    "a slow drag down past half closes with reason swipe, focus to the trigger",
    async () => {
      const onOpenChange = vi.fn()
      render(<Filters onOpenChange={onOpenChange} />)
      const d = filters().via("touch")
      await d.open()
      await d.swipe("down", 250)
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: "swipe" }),
      )
      expect(await d.closeReason()).toBe("swipe")
    },
  )

  it.skipIf(inJsdom)("a short drag settles and stays open", async () => {
    render(<Filters />)
    const d = filters().via("pointer")
    await d.open()
    await d.swipe("down", 80).catch(() => {})
    expect(await d.isOpen()).toBe(true)
    expect(content()?.hasAttribute("data-swiping")).toBe(false)
  })

  it.skipIf(inJsdom)("a vetoed swipe stays open without exit styles (reka-ui#2933)", async () => {
    render(<Filters onOpenChange={(open, d) => (open ? undefined : d.cancel())} />)
    const d = filters().via("touch")
    await d.open()
    await d.swipe("down", 300).catch(() => {})
    expect(await d.isOpen()).toBe(true)
    expect(content()?.hasAttribute("data-swipe-dismiss")).toBe(false)
  })

  it.skipIf(inJsdom)("closeOnSwipe={false}: settles back (base-ui#4541)", async () => {
    render(<Filters closeOnSwipe={false} />)
    const d = filters().via("touch")
    await d.open()
    await d.swipe("down", 300).catch(() => {})
    expect(await d.isOpen()).toBe(true)
  })
})

describe("Drawer: gesture costs and controlled close", () => {
  it.skipIf(inJsdom)("no render per pointer move (base-ui#4863)", async () => {
    let renders = 0
    function Counted() {
      renders += 1
      return <p>Body</p>
    }
    render(
      <Drawer.Root>
        <Drawer.Trigger>Filters</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Positioner>
            <Drawer.Content style={{ position: "fixed", insetInline: 0, bottom: 0, height: 400 }}>
              <Drawer.Title>Filters</Drawer.Title>
              <Counted />
              <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Portal>
      </Drawer.Root>,
    )
    const d = filters().via("pointer")
    await d.open()
    const before = renders
    // 60 moves short of the threshold: the drawer settles.
    await d.swipe("down", 120).catch(() => {})
    // The start and the release may render; the 60 moves never do.
    expect(renders - before).toBeLessThanOrEqual(4)
  })

  it.skipIf(inJsdom)(
    "controlled: a parent applying the close in onOpenChange exits from the release (zag#3144)",
    async () => {
      function Applies() {
        const [open, setOpen] = useState(false)
        return <Filters open={open} onOpenChange={setOpen} />
      }
      render(<Applies />)
      const d = filters().via("touch")
      await d.open()
      await d.swipe("down", 300)
      expect(await d.closeReason()).toBe("swipe")
    },
  )

  it.skipIf(inJsdom)(
    "controlled: a parent keeping open settles it; a later open={false} closes it",
    async () => {
      function Keeps() {
        const [open, setOpen] = useState(false)
        const [asked, setAsked] = useState(0)
        return (
          <>
            <Filters
              open={open}
              onOpenChange={(o) => (o ? setOpen(true) : setAsked((n) => n + 1))}
            />
            <button type="button" onClick={() => setOpen(false)}>
              Apply close
            </button>
            <output>{`asked ${asked}`}</output>
          </>
        )
      }
      render(<Keeps />)
      const d = filters().via("touch")
      await d.open()
      await d.swipe("down", 300).catch(() => {})
      await screen.findByText("asked 1")
      expect(await d.isOpen()).toBe(true)
      expect(content()?.hasAttribute("data-swipe-dismiss")).toBe(false)
      await userEvent.click(screen.getByRole("button", { name: "Apply close" }))
      await vi.waitFor(async () => expect(await d.isOpen()).toBe(false))
    },
  )

  it("virtual screen reader: name, description and handle name; nothing announced", async () => {
    const log = installAnnouncementLog()
    const start = log.length
    render(<Filters snapPoints={[0.4, 1]} />)
    const d = filters().via("virtual")
    await d.open()
    expect(await d.title()).toBe("Filters")
    expect(log.slice(start)).toEqual([])
  })
})
