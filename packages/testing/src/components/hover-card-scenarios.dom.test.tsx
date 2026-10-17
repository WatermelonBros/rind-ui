// Hover Card scenarios that need pointer movement, nested layers and focus rules (openspec
// add-hover-card), in jsdom and in real browsers. Delays run on a virtual clock injected as
// the scheduler, so nothing waits for elapsed time. Pointer paths use coordinates in browsers
// (the browser tells what is under them) and direct events on the element in jsdom.
import type { HoverCardChangeDetails } from "@rind-ui/core"
import { Dialog, HoverCard, type HoverCardRootProps, Popover, RindProvider } from "@rind-ui/react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { virtualClock } from "../index"

const isJsdom = navigator.userAgent.includes("jsdom")

let clock = virtualClock()
let last: Element | null = null
afterEach(() => {
  cleanup()
  clock = virtualClock()
  last = null
  vi.restoreAllMocks()
})
const advance = (ms: number) => act(() => clock.advance(ms))

// --- pointer ----------------------------------------------------------------------------------

const at = (x: number, y: number) => document.elementFromPoint(x, y) ?? document.body
const center = (el: Element): [number, number] => {
  const r = el.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2]
}
/** One mouse movement to an element or point: boundary events when the target changes. */
function move(target: Element | readonly [number, number]) {
  const [x, y] = Array.isArray(target) ? target : isJsdom ? [0, 0] : center(target as Element)
  const el = Array.isArray(target) || !isJsdom ? at(x as number, y as number) : (target as Element)
  const init = { bubbles: true, composed: true, clientX: x, clientY: y, pointerType: "mouse" }
  act(() => {
    if (el !== last) {
      last?.dispatchEvent(new PointerEvent("pointerout", { ...init, relatedTarget: el }))
      last?.dispatchEvent(new PointerEvent("pointerleave", { ...init, bubbles: false }))
      el.dispatchEvent(new PointerEvent("pointerover", { ...init, relatedTarget: last }))
      el.dispatchEvent(new PointerEvent("pointerenter", { ...init, bubbles: false }))
      last = el
    }
    el.dispatchEvent(new PointerEvent("pointermove", { ...init, cancelable: true }))
  })
}
/** A straight path in 2 px steps (browsers only: jsdom has no layout). */
function sweep(from: readonly [number, number], to: readonly [number, number]) {
  const [x0, y0] = from
  const [x1, y1] = to
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2))
  for (let i = 0; i <= n; i++) move([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n])
}
/** Somewhere away from everything the fixtures render. */
const away = () => move(isJsdom ? document.body : [window.innerWidth - 4, window.innerHeight - 4])

// --- fixtures ---------------------------------------------------------------------------------

const trigger = () => screen.getByRole("link", { name: "Jane Doe" })
const card = () => screen.getByRole("dialog", { name: "Jane Doe" })
const isOpen = () => trigger().getAttribute("aria-expanded") === "true"
const active = () => document.activeElement

function Card({ children, ...root }: Partial<HoverCardRootProps> & { children?: ReactNode }) {
  return (
    <HoverCard.Root {...root}>
      <HoverCard.Trigger href="/u/jane">Jane Doe</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Positioner>
          <HoverCard.Content style={{ width: 200, height: 80 }}>
            <p>Designer in Lisbon.</p>
            {children ?? <button type="button">Follow</button>}
          </HoverCard.Content>
        </HoverCard.Positioner>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}

function App({ children }: { children: ReactNode }) {
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }}>
      <div style={{ padding: 8 }}>
        <input aria-label="Search" />
        {children}
      </div>
    </RindProvider>
  )
}

/** Rests the pointer on the trigger, waits out the open delay and the first placement. */
async function openByHover() {
  move(trigger())
  await advance(700)
  await waitFor(() => expect(isOpen()).toBe(true))
  if (!isJsdom) {
    await waitFor(() =>
      expect(card().getBoundingClientRect().top).toBeGreaterThanOrEqual(
        trigger().getBoundingClientRect().bottom,
      ),
    )
  }
}

describe("HoverCard scenarios: closing by pointer", () => {
  it.runIf(!isJsdom)("Pointer leaves: closes 300 ms later with reason pointer-leave", async () => {
    const onOpenChange = vi.fn()
    render(
      <App>
        <Card onOpenChange={onOpenChange} />
      </App>,
    )
    await openByHover()
    const [tx, ty] = center(trigger())
    // Away from the card: along the trigger's row, to the right.
    sweep([tx, ty], [tx + 120, ty])
    await advance(299)
    expect(isOpen()).toBe(true)
    await advance(1)
    await waitFor(() => expect(isOpen()).toBe(false))
    const details = onOpenChange.mock.lastCall?.[1] as HoverCardChangeDetails
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false)
    expect(details.reason).toBe("pointer-leave")
  })

  it.runIf(!isJsdom)(
    "Crossing the gap: from the trigger onto the card 8 px below stays open (zag#3181, reka-ui#1063)",
    async () => {
      render(
        <App>
          <Card />
        </App>,
      )
      await openByHover()
      sweep(center(trigger()), center(card()))
      await advance(1000)
      expect(isOpen()).toBe(true)
      // The positioner sits 8 px below the trigger (the content's own paragraph margin aside).
      const positioner = card().parentElement as HTMLElement
      // Sub-pixel layout differs by engine (8.34 px in Firefox and WebKit).
      const gap = positioner.getBoundingClientRect().top - trigger().getBoundingClientRect().bottom
      expect(Math.abs(gap - 8)).toBeLessThan(1)
    },
  )

  it("Browser autofill over the card: focus in an input keeps it open when the pointer leaves (radix#2502)", async () => {
    render(
      <App>
        <Card>
          <input aria-label="Email" />
        </Card>
      </App>,
    )
    await openByHover()
    act(() => screen.getByRole("textbox", { name: "Email" }).focus())
    away()
    await advance(1000)
    expect(isOpen()).toBe(true)
  })

  it.runIf(!isJsdom)(
    "Select inside the card: pointer over the child layer's portalled content keeps both open (radix#3175)",
    async () => {
      render(
        <App>
          <Card>
            <Popover.Root defaultOpen>
              <Popover.Trigger>Options</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Content aria-label="Child" style={{ width: 120, height: 40 }}>
                    Pick one
                  </Popover.Content>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </Card>
        </App>,
      )
      await openByHover()
      const child = await screen.findByRole("dialog", { name: "Child" })
      await waitFor(() => expect(child.getBoundingClientRect().width).toBeGreaterThan(0))
      // Leave the card and its trigger for the child's content, wherever it was placed.
      move(trigger())
      move(center(child))
      await advance(1000)
      expect(isOpen()).toBe(true)
      expect(screen.getByRole("dialog", { name: "Child" })).toBe(child)
    },
  )

  it.runIf(!isJsdom)(
    "Kept mounted while closed: the pointer over where the hidden content was opens nothing (bits-ui#1697)",
    async () => {
      render(
        <App>
          <Card keepMounted />
        </App>,
      )
      await openByHover()
      const spot = center(card())
      const user = userEvent.setup()
      await user.keyboard("{Escape}")
      await waitFor(() => expect(isOpen()).toBe(false))
      await waitFor(() =>
        expect(document.querySelector('[data-part="content"]')?.hasAttribute("hidden")).toBe(true),
      )
      move(spot)
      move([spot[0] + 4, spot[1] + 4])
      await advance(2000)
      expect(isOpen()).toBe(false)
    },
  )
})

describe("HoverCard scenarios: keyboard and layers", () => {
  it("Escape during IME composition inside the card: stays open, then a plain Escape closes", async () => {
    render(
      <App>
        <Card>
          <input aria-label="Email" />
        </Card>
      </App>,
    )
    await openByHover()
    const input = screen.getByRole("textbox", { name: "Email" })
    act(() => input.focus())
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          isComposing: true,
          keyCode: 229,
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    await advance(1000)
    expect(isOpen()).toBe(true)
    await userEvent.setup().keyboard("{Escape}")
    await waitFor(() => expect(isOpen()).toBe(false))
  })

  it("Hover card inside a dialog, opened by pointer: Escape closes only the card (radix#920)", async () => {
    render(
      <RindProvider environment={{ scheduler: clock.scheduler }}>
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Title>People</Dialog.Title>
                <Card />
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Portal>
        </Dialog.Root>
      </RindProvider>,
    )
    await openByHover()
    await userEvent.setup().keyboard("{Escape}")
    await waitFor(() => expect(isOpen()).toBe(false))
    expect(screen.getByRole("dialog", { name: "People" })).toBeTruthy()
  })

  it("Focus restore: Escape with focus inside the card returns focus to the trigger", async () => {
    render(
      <App>
        <Card />
      </App>,
    )
    await openByHover()
    const follow = screen.getByRole("button", { name: "Follow" })
    act(() => follow.focus())
    expect(active()).toBe(follow)
    await userEvent.setup().keyboard("{Escape}")
    await waitFor(() => expect(isOpen()).toBe(false))
    await waitFor(() => expect(active()).toBe(trigger()))
  })

  it("Focus restore: Escape after a hover open leaves focus in a page input", async () => {
    render(
      <App>
        <Card />
      </App>,
    )
    const search = screen.getByRole("textbox", { name: "Search" })
    act(() => search.focus())
    await openByHover()
    expect(active()).toBe(search)
    await userEvent.setup().keyboard("{Escape}")
    await waitFor(() => expect(isOpen()).toBe(false))
    expect(active()).toBe(search)
  })

  it("Popover autofocus on a preview trigger: the hover card stays closed after 1000 ms (radix#2138)", async () => {
    render(
      <RindProvider environment={{ scheduler: clock.scheduler }}>
        <Popover.Root defaultOpen initialFocus={() => document.getElementById("preview")}>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Content aria-label="Host">
                <Card>
                  <span>Preview</span>
                </Card>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </RindProvider>,
    )
    // The fixture's trigger takes the id the popover's initial focus looks for.
    const link = await screen.findByRole("link", { name: "Jane Doe" })
    link.id = "preview"
    await waitFor(() => expect(active()).toBe(link))
    await advance(1000)
    expect(link.getAttribute("aria-expanded")).toBe("false")
  })
})
