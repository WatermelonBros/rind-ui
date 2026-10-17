// Hover Card scenarios (openspec add-hover-card), in jsdom and in real browsers, through the
// hover card driver where possible. Delays run on vi fake timers advanced through the adapter
// and user-event (`advanceTimers`), so a 700 ms open delay costs no real time.
import { getLayerStack, type HoverCardChangeDetails } from "@rind-ui/core"
import { Dialog, HoverCard, type HoverCardRootProps } from "@rind-ui/react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { domEnv, getHoverCard, installAnnouncementLog } from "../index"

// --- time -----------------------------------------------------------------------------------

const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))

/** Fake timers, with user-event and the driver adapter advancing them. */
function fakeTime() {
  vi.useFakeTimers()
  // Testing Library drains its async wrapper with a timer only `jest` fake timers advance.
  vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
  return { user, env: () => domEnv({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) }) }
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// --- fixtures -------------------------------------------------------------------------------

function Card({
  children,
  name = "Jane Doe",
  ...root
}: Partial<HoverCardRootProps> & { name?: string; children?: ReactNode }) {
  return (
    <>
      <input aria-label="Search" />
      <HoverCard.Root {...root}>
        <HoverCard.Trigger href="/u/jane">{name}</HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Positioner>
            <HoverCard.Content>
              <HoverCard.Arrow />
              <p>Designer in Lisbon.</p>
              {children ?? <button type="button">Follow</button>}
            </HoverCard.Content>
          </HoverCard.Positioner>
        </HoverCard.Portal>
      </HoverCard.Root>
      <a href="/after">After</a>
    </>
  )
}

const trigger = (name = "Jane Doe") => screen.getByRole("link", { name })
const active = () => document.activeElement

describe("HoverCard: anatomy and ARIA", () => {
  it("Link trigger: keeps role link and href, gets the popup ARIA; closed has no aria-controls", () => {
    render(<Card />)
    const t = trigger()
    expect(t.getAttribute("href")).toBe("/u/jane")
    expect(t.getAttribute("aria-haspopup")).toBe("dialog")
    expect(t.getAttribute("aria-expanded")).toBe("false")
    expect(t.hasAttribute("aria-controls")).toBe(false)
    expect(t.hasAttribute("aria-describedby")).toBe(false)
  })

  it("Open card: aria-expanded, aria-controls, the content is a dialog named by the link", async () => {
    const { env } = fakeTime()
    render(<Card />)
    await getHoverCard(env(), { name: "Jane Doe" }).via("pointer").show()
    const dialog = screen.getByRole("dialog", { name: "Jane Doe" })
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
    expect(trigger().getAttribute("aria-controls")).toBe(dialog.id)
    expect(dialog.hasAttribute("aria-modal")).toBe(false)
    expect(dialog.getAttribute("tabindex")).toBe("-1")
  })
})

describe("HoverCard: opening", () => {
  it("Lingering on a link: Tab onto it and wait 700 ms opens with reason focus, focus stays", async () => {
    const { user } = fakeTime()
    const onOpenChange = vi.fn()
    render(<Card onOpenChange={onOpenChange} />)
    act(() => screen.getByRole("textbox").focus())
    await user.tab()
    expect(active()).toBe(trigger())
    await advance(699)
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
    await advance(1)
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
    const details = onOpenChange.mock.calls[0]?.[1] as HoverCardChangeDetails
    expect(details.reason).toBe("focus")
    expect(active()).toBe(trigger())
  })

  it("Tabbing quickly through links: 200 ms on each opens nothing", async () => {
    const { user } = fakeTime()
    render(
      <>
        {["Ann", "Bob", "Cy"].map((n) => (
          <HoverCard.Root key={n}>
            <HoverCard.Trigger href={`/u/${n}`}>{n}</HoverCard.Trigger>
            <HoverCard.Portal>
              <HoverCard.Positioner>
                <HoverCard.Content>{n}'s card</HoverCard.Content>
              </HoverCard.Positioner>
            </HoverCard.Portal>
          </HoverCard.Root>
        ))}
      </>,
    )
    for (let i = 0; i < 3; i++) {
      await user.tab()
      await advance(200)
    }
    expect(screen.queryAllByRole("dialog")).toHaveLength(0)
  })

  it("Hover open: focus stays in the search field", async () => {
    const { env } = fakeTime()
    render(<Card />)
    const search = screen.getByRole("textbox")
    act(() => search.focus())
    await getHoverCard(env(), { name: "Jane Doe" }).via("pointer").show()
    expect(active()).toBe(search)
  })

  it("Programmatic focus (a popover's autofocus) does not open it (radix#2138)", async () => {
    fakeTime()
    render(<Card />)
    act(() => trigger().focus())
    await advance(1000)
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
  })

  it("Tap follows the link: nothing prevents the touch and nothing opens (reka-ui#802)", async () => {
    fakeTime()
    render(<Card />)
    const down = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
    })
    act(() => {
      trigger().dispatchEvent(down)
    })
    await advance(1000)
    expect(down.defaultPrevented).toBe(false)
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
  })

  it("Disabled: never opens", async () => {
    const { user } = fakeTime()
    render(<Card disabled />)
    await user.tab()
    await user.tab()
    await advance(1000)
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
  })
})

describe("HoverCard: keyboard access and closing", () => {
  it("Follow button: Tab enters the content and it stays open (radix#2692)", async () => {
    const { env } = fakeTime()
    render(<Card />)
    const h = getHoverCard(env(), { name: "Jane Doe" }).via("keyboard")
    await h.show()
    await h.enter()
    expect(active()?.textContent).toBe("Follow")
    expect(await h.isOpen()).toBe(true)
    expect(await h.hasFocus()).toBe(true)
  })

  it("Escape then continue: closes with focus on the trigger, Tab moves after it", async () => {
    const { env, user } = fakeTime()
    const onOpenChange = vi.fn()
    render(<Card onOpenChange={onOpenChange} />)
    const h = getHoverCard(env(), { name: "Jane Doe" }).via("keyboard")
    await h.show()
    await h.enter()
    await user.keyboard("{Escape}")
    expect(await h.isOpen()).toBe(false)
    expect(active()).toBe(trigger())
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    )
    // Escape closed it: the next Tab follows the page order (the card is gone).
    await user.tab()
    expect(active()?.textContent).toBe("After")
  })

  it("Pointer leaves while the trigger has keyboard focus: it stays open (zag#3224)", async () => {
    const { env } = fakeTime()
    render(<Card />)
    const h = getHoverCard(env(), { name: "Jane Doe" }).via("keyboard")
    await h.show()
    // The pointer comes and goes on the trigger.
    act(() => {
      trigger().dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }))
    })
    await advance(1000)
    expect(await h.isOpen()).toBe(true)
  })

  it("Tab past the end continues after the trigger and closes it", async () => {
    const { env, user } = fakeTime()
    render(<Card />)
    const h = getHoverCard(env(), { name: "Jane Doe" }).via("keyboard")
    await h.show()
    await h.enter()
    await user.tab()
    expect(active()?.textContent).toBe("After")
    await advance(300)
    expect(await h.isOpen()).toBe(false)
  })

  it("Announcements: none", async () => {
    const { env, user } = fakeTime()
    const log = installAnnouncementLog()
    const start = log.length
    render(<Card />)
    const h = getHoverCard(env(), { name: "Jane Doe" }).via("keyboard")
    await h.show()
    await user.keyboard("{Escape}")
    expect(log.length).toBe(start)
  })
})

describe("HoverCard: layers", () => {
  it("Hover card inside a dialog: Escape closes only the card (radix#920)", async () => {
    const { env, user } = fakeTime()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>People</Dialog.Title>
            <Card />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    const h = getHoverCard(env(), { name: "Jane Doe" }).via("keyboard")
    await h.show()
    await user.keyboard("{Escape}")
    expect(await h.isOpen()).toBe(false)
    expect(screen.getByRole("dialog", { name: "People" })).toBeTruthy()
  })

  it("Nested hover card: the inner one is nested, the outer has a nested child (mui/base-ui#3673)", async () => {
    const { env, user } = fakeTime()
    render(
      <Card>
        <HoverCard.Root>
          <HoverCard.Trigger href="/team">Design team</HoverCard.Trigger>
          <HoverCard.Portal>
            <HoverCard.Positioner>
              <HoverCard.Content>Six people.</HoverCard.Content>
            </HoverCard.Positioner>
          </HoverCard.Portal>
        </HoverCard.Root>
      </Card>,
    )
    await getHoverCard(env(), { name: "Jane Doe" }).via("keyboard").show()
    // Tab from the trigger into the card, onto the inner preview link, then its delay.
    await user.tab()
    expect(active()).toBe(trigger("Design team"))
    await advance(700)
    expect(trigger("Design team").getAttribute("aria-expanded")).toBe("true")
    const [outer, nested] = screen.getAllByRole("dialog")
    expect(nested?.hasAttribute("data-nested")).toBe(true)
    expect(outer?.hasAttribute("data-has-nested")).toBe(true)
    expect(getLayerStack(document).layers()).toHaveLength(2)
  })

  it("Kept mounted while closed: registers no layer (bits-ui#1697)", async () => {
    fakeTime()
    render(<Card keepMounted />)
    await advance(1000)
    expect(getLayerStack(document).layers()).toHaveLength(0)
    expect(screen.queryByRole("dialog")).toBe(null)
  })

  it("Button trigger: a development warning recommends Popover", () => {
    render(
      <HoverCard.Root>
        <HoverCard.Trigger render={<button type="button" />}>Jane</HoverCard.Trigger>
      </HoverCard.Root>,
    )
    expect(
      vi.mocked(console.warn).mock.calls.some((c) => String(c[0]).includes("use a Popover")),
    ).toBe(true)
  })
})
