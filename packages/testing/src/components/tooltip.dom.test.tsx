// Tooltip scenarios (openspec add-tooltip): every spec scenario and cited regression, in
// jsdom and in real browsers, through the tooltip driver where possible. Delays run on vi
// fake timers advanced through the adapter and user-event (`advanceTimers`), so a 700 ms open
// delay costs no real time; layout-dependent scenarios (flip at the viewport edge, a real exit
// animation) run in the browsers only.
import { getLayerStack, platforms, type TooltipChangeDetails } from "@rind-ui/core"
import {
  Checkbox,
  Dialog,
  Popover,
  RindProvider,
  Switch,
  Tooltip,
  type TooltipActions,
  type TooltipRootProps,
} from "@rind-ui/react"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, type ReactNode, type RefObject, StrictMode, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { domEnv, getTooltip, installAnnouncementLog } from "../index"

const isJsdom = navigator.userAgent.includes("jsdom")

// --- time -----------------------------------------------------------------------------------

const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))
type User = ReturnType<typeof userEvent.setup>

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
  document.getElementById("test-style")?.remove()
})

// --- fixtures -------------------------------------------------------------------------------

interface TipProps extends Partial<TooltipRootProps> {
  readonly name?: string
  readonly text?: string
  readonly id?: string
  readonly inline?: boolean
  readonly triggerProps?: Record<string, unknown>
  readonly children?: ReactNode
  readonly contentChildren?: ReactNode
}

/** A trigger named `name` with a tooltip `text`, portalled by default. */
function Tip({
  name = "Delete",
  text = "Delete permanently",
  inline = false,
  triggerProps,
  contentChildren,
  children,
  ...root
}: TipProps) {
  const body = (
    <Tooltip.Positioner>
      <Tooltip.Content>
        <Tooltip.Arrow />
        {text}
        {contentChildren}
      </Tooltip.Content>
    </Tooltip.Positioner>
  )
  return (
    <Tooltip.Root {...root}>
      <Tooltip.Trigger {...triggerProps}>{children ?? name}</Tooltip.Trigger>
      {inline ? body : <Tooltip.Portal>{body}</Tooltip.Portal>}
    </Tooltip.Root>
  )
}

/** Three toolbar buttons, each with a tooltip. */
function Toolbar(props: Partial<TooltipRootProps> & { names?: string[] }) {
  const { names = ["Bold", "Italic", "Underline"], ...root } = props
  return (
    <div role="toolbar" aria-label="Format">
      {names.map((n) => (
        <Tip key={n} name={n} text={`${n} text`} {...root} />
      ))}
    </div>
  )
}

const trigger = (name = "Delete") => screen.getByRole("button", { name })
const contentOf = (name = "Delete") => {
  const id = trigger(name).getAttribute("aria-describedby") ?? ""
  return document.getElementById(id.split(" ").at(-1) ?? "") as HTMLElement
}
/** Open as the content says (a trigger shared with a popover shows the popover's state). */
const isOpen = (name = "Delete") => contentOf(name)?.getAttribute("data-state") === "open"
const openContents = () => document.querySelectorAll('[data-part="content"][data-state="open"]')
const active = () => document.activeElement
/** The first placement happened (until then the positioner has pointer-events: none). */
const placed = (name = "Delete") =>
  vi.waitFor(() => expect(contentOf(name).hasAttribute("data-placing")).toBe(false))
// Bottom right: far from the trigger, which sits at the top left of the page.
const farAway = { clientX: 390, clientY: 780 }

/** The pointer moves onto an element (explicit coordinates keep real hit tests honest). */
async function over(user: User, el: Element) {
  const r = el.getBoundingClientRect()
  await act(() =>
    user.pointer({
      target: el,
      coords: { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 },
    }),
  )
}
/** The pointer moves onto the page body, far from every tooltip part. */
async function away(user: User) {
  await act(() => user.pointer({ target: document.body, coords: farAway }))
}
const tab = (user: User) => act(() => user.keyboard("{Tab}"))
const key = (user: User, k: string) => act(() => user.keyboard(k))

const changes = () => {
  const fn = vi.fn<(open: boolean, details: TooltipChangeDetails) => void>()
  return Object.assign(fn, {
    pairs: () => fn.mock.calls.map(([open, d]) => [open, d.reason] as const),
  })
}

// ---------------------------------------------------------------------------------------------

describe("Anatomy", () => {
  it("every rendered part carries data-scope, data-part and the instance", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await over(user, trigger())
    await advance(700)
    const instance = trigger().getAttribute("data-instance")
    expect(instance).toBeTruthy()
    for (const part of ["trigger", "positioner", "content", "arrow"]) {
      const el = document.querySelector(`[data-scope="tooltip"][data-part="${part}"]`)
      expect(el, part).not.toBeNull()
      expect(el?.getAttribute("data-instance"), part).toBe(instance)
    }
  })

  it("the positioner is portalled; inline renders it in place", () => {
    render(
      <>
        <Tip name="Portalled" />
        <Tip name="Inline" inline />
      </>,
    )
    expect(contentOf("Portalled").closest("[data-rind-portal]")).toBeTruthy()
    expect(contentOf("Inline").closest("[data-rind-portal]")).toBeNull()
    expect(trigger("Inline").parentElement?.contains(contentOf("Inline"))).toBe(true)
  })

  it("Trigger rendered as an icon button component keeps its wiring and opens on hover and focus", async () => {
    const { user } = fakeTime()
    const IconButton = ({ ref, ...props }: React.ComponentProps<"button">) => (
      <button ref={ref} type="button" data-icon="" {...props} />
    )
    render(
      <Tooltip.Root>
        <Tooltip.Trigger render={<IconButton aria-label="Bold" />} />
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>Make bold</Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    )
    const button = screen.getByRole("button", { name: "Bold" })
    expect(button.hasAttribute("data-icon")).toBe(true)
    expect(button.getAttribute("aria-describedby")).toBeTruthy()
    // A component trigger keeps its own identity: the tooltip's state is on its content.
    const content = document.getElementById(button.getAttribute("aria-describedby") ?? "")
    expect(button.hasAttribute("data-scope")).toBe(false)
    await over(user, button)
    await advance(700)
    expect(content?.getAttribute("data-state")).toBe("open")
    await away(user)
    await advance(300)
    expect(content?.getAttribute("data-state")).toBe("closed")
    await act(async () => button.blur())
    await tab(user)
    expect(document.activeElement).toBe(button)
    expect(content?.getAttribute("data-state")).toBe("open")
  })

  it("a function render prop receives the merged props", () => {
    render(
      <Tooltip.Root>
        <Tooltip.Trigger render={(props) => <a href="#x" {...props} />}>Docs</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>Read the docs</Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    )
    const link = screen.getByRole("link", { name: "Docs" })
    expect(link.getAttribute("aria-describedby")).toBeTruthy()
    expect(link.getAttribute("data-scope")).toBe("tooltip")
  })
})

describe("Open State And Reasons", () => {
  it("Escape reason", async () => {
    const { user } = fakeTime()
    const onOpenChange = changes()
    render(<Tip onOpenChange={onOpenChange} />)
    await tab(user)
    expect(isOpen()).toBe(true)
    await key(user, "{Escape}")
    expect(isOpen()).toBe(false)
    expect(onOpenChange.pairs()).toEqual([
      [true, "focus"],
      [false, "escape-key"],
    ])
  })

  it("Becoming disabled closes with reason disabled and does not reopen on hover or focus", async () => {
    const { user } = fakeTime()
    const onOpenChange = changes()
    const { rerender } = render(<Tip onOpenChange={onOpenChange} />)
    await over(user, trigger())
    await advance(700)
    expect(isOpen()).toBe(true)
    rerender(<Tip onOpenChange={onOpenChange} disabled />)
    expect(isOpen()).toBe(false)
    expect(onOpenChange.pairs().at(-1)).toEqual([false, "disabled"])
    await away(user)
    await over(user, trigger())
    await advance(2000)
    expect(isOpen()).toBe(false)
    await act(async () => trigger().blur())
    await tab(user)
    expect(active()).toBe(trigger())
    expect(isOpen()).toBe(false)
    expect(onOpenChange).toHaveBeenCalledTimes(2)
  })

  it("a disabled tooltip never opens", async () => {
    const { user } = fakeTime()
    render(<Tip disabled />)
    await over(user, trigger())
    await advance(2000)
    await tab(user)
    expect(isOpen()).toBe(false)
  })

  it("controlled: onOpenChange proposes, the parent decides", async () => {
    const { user } = fakeTime()
    const log = changes()
    function Controlled() {
      const [open, setOpen] = useState(false)
      return (
        <Tip
          open={open}
          onOpenChange={(o, d) => {
            log(o, d)
            setOpen(o)
          }}
        />
      )
    }
    render(<Controlled />)
    await over(user, trigger())
    await advance(700)
    expect(isOpen()).toBe(true)
    expect(log.pairs()).toEqual([[true, "hover"]])
    await key(user, "{Escape}")
    expect(isOpen()).toBe(false)
    expect(log.pairs().at(-1)).toEqual([false, "escape-key"])
  })

  it("controlled and refused: the parent keeps it closed", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Tip open={false} onOpenChange={log} />)
    await tab(user)
    expect(log.pairs()).toEqual([[true, "focus"]])
    expect(isOpen()).toBe(false)
  })

  it("onOpenChange details.cancel() keeps it closed", async () => {
    const { user } = fakeTime()
    render(<Tip onOpenChange={(_o, d) => d.cancel()} />)
    await tab(user)
    expect(isOpen()).toBe(false)
  })

  it("defaultOpen starts open", () => {
    render(<Tip defaultOpen />)
    expect(isOpen()).toBe(true)
    expect(contentOf().hasAttribute("hidden")).toBe(false)
  })

  it("actionsRef opens and closes with reason api", async () => {
    const actions: RefObject<TooltipActions | null> = createRef()
    const log = changes()
    render(<Tip actionsRef={actions} onOpenChange={log} />)
    act(() => actions.current?.open())
    expect(isOpen()).toBe(true)
    act(() => actions.current?.close())
    expect(isOpen()).toBe(false)
    expect(log.pairs()).toEqual([
      [true, "api"],
      [false, "api"],
    ])
  })
})

describe("Opening On Hover", () => {
  it("First tooltip in a toolbar: 700 ms, reason hover, not instant", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Toolbar onOpenChange={log} />)
    await over(user, trigger("Bold"))
    await advance(699)
    expect(isOpen("Bold")).toBe(false)
    await advance(1)
    expect(isOpen("Bold")).toBe(true)
    expect(log.pairs()).toEqual([[true, "hover"]])
    expect(contentOf("Bold").hasAttribute("data-instant")).toBe(false)
  })

  it("Leaving before the delay: it never opens", async () => {
    const { user } = fakeTime()
    render(<Toolbar />)
    await over(user, trigger("Bold"))
    await advance(300)
    await away(user)
    await advance(5000)
    expect(isOpen("Bold")).toBe(false)
  })

  it("Sweeping across triggers faster than the delay opens none", async () => {
    const { user } = fakeTime()
    render(<Toolbar />)
    for (const n of ["Bold", "Italic", "Underline"]) {
      await over(user, trigger(n))
      await advance(200)
    }
    await away(user)
    await advance(5000)
    expect(openContents()).toHaveLength(0)
  })

  it("Hover with a touch pointer never opens it", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await act(async () => {
      for (const type of ["pointerover", "pointerenter", "pointermove"]) {
        trigger().dispatchEvent(
          new PointerEvent(type, { bubbles: type !== "pointerenter", pointerType: "touch" }),
        )
      }
    })
    await advance(5000)
    expect(isOpen()).toBe(false)
    void user
  })

  it("a custom openDelay", async () => {
    const { user } = fakeTime()
    render(<Tip openDelay={100} />)
    await over(user, trigger())
    await advance(99)
    expect(isOpen()).toBe(false)
    await advance(1)
    expect(isOpen()).toBe(true)
  })

  it("Open requested twice: it opens once, after the delay from the first request", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Tip onOpenChange={log} />)
    await over(user, trigger())
    await advance(100)
    await over(user, trigger())
    await advance(599)
    expect(isOpen()).toBe(false)
    await advance(1)
    expect(isOpen()).toBe(true)
    expect(log).toHaveBeenCalledTimes(1)
  })

  it("Tap on an icon button: the action runs and the tooltip stays closed", async () => {
    const { user } = fakeTime()
    const onClick = vi.fn()
    render(<Tip triggerProps={{ onClick }} />)
    const tip = getTooltip(domEnv({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) }), {
      name: "Delete",
    })
    await tip.via("touch").pressTrigger()
    await advance(5000)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(isOpen()).toBe(false)
    void user
  })
})

describe("Delay group", () => {
  it("Toolbar sweep: the next tooltip opens at once with data-instant, the first closes with group", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Toolbar onOpenChange={log} />)
    await over(user, trigger("Bold"))
    await advance(700)
    await over(user, trigger("Italic"))
    expect(isOpen("Italic")).toBe(true)
    expect(isOpen("Bold")).toBe(false)
    expect(contentOf("Italic").hasAttribute("data-instant")).toBe(true)
    expect(contentOf("Italic").getAttribute("data-state")).toBe("open")
    expect(log.pairs()).toContainEqual([false, "group"])
    expect(log.pairs()[0]).toEqual([true, "hover"])
  })

  it("Moving between adjacent triggers: at no time are both visible", async () => {
    const { user } = fakeTime()
    render(<Toolbar />)
    const seen: number[] = []
    const observer = new MutationObserver(() => seen.push(openContents().length))
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      childList: true,
      attributeFilter: ["data-state", "hidden"],
    })
    await over(user, trigger("Bold"))
    await advance(700)
    await over(user, trigger("Italic"))
    await over(user, trigger("Underline"))
    await advance(100)
    seen.push(openContents().length)
    observer.disconnect()
    expect(Math.max(...seen)).toBe(1)
    expect(isOpen("Underline")).toBe(true)
  })

  it("Opened without a preceding leave: keyboard focus on B closes A (reka-ui#2868)", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Toolbar onOpenChange={log} />)
    await over(user, trigger("Bold"))
    await advance(700)
    expect(isOpen("Bold")).toBe(true)
    await act(async () => trigger("Italic").focus())
    // programmatic focus does not open; a key-driven one does
    await act(async () => trigger("Underline").focus())
    await act(() => user.keyboard("{Shift>}{Tab}{/Shift}"))
    expect(active()).toBe(trigger("Italic"))
    expect(isOpen("Italic")).toBe(true)
    expect(isOpen("Bold")).toBe(false)
    expect(log.pairs()).toContainEqual([false, "group"])
  })

  it("Cold again: a tooltip closed 400 ms ago waits its full delay", async () => {
    const { user } = fakeTime()
    render(<Toolbar />)
    await over(user, trigger("Bold"))
    await advance(700)
    await away(user)
    await advance(300) // closes after the close delay
    expect(isOpen("Bold")).toBe(false)
    await advance(400)
    await over(user, trigger("Italic"))
    await advance(699)
    expect(isOpen("Italic")).toBe(false)
    await advance(1)
    expect(isOpen("Italic")).toBe(true)
    expect(contentOf("Italic").hasAttribute("data-instant")).toBe(false)
  })

  it("Within the skip delay after a close the next one is instant", async () => {
    const { user } = fakeTime()
    render(<Toolbar />)
    await over(user, trigger("Bold"))
    await advance(700)
    await away(user)
    await advance(300)
    await advance(200) // 200 ms into the 300 ms warm window
    await over(user, trigger("Italic"))
    expect(isOpen("Italic")).toBe(true)
    expect(contentOf("Italic").hasAttribute("data-instant")).toBe(true)
  })

  it("Close delay does not extend the window (react-spectrum#9517)", async () => {
    const { user } = fakeTime()
    render(<Toolbar closeDelay={0} />)
    await over(user, trigger("Bold"))
    await advance(700)
    await away(user)
    await advance(0)
    expect(isOpen("Bold")).toBe(false)
    await advance(350)
    await over(user, trigger("Italic"))
    await advance(699)
    expect(isOpen("Italic")).toBe(false)
    await advance(1)
    expect(isOpen("Italic")).toBe(true)
  })

  it("Skip delay zero: moving directly onto another trigger waits the full delay (radix#3873, radix#1110)", async () => {
    const { user } = fakeTime()
    render(<Toolbar skipDelay={0} />)
    await over(user, trigger("Bold"))
    await advance(700)
    expect(isOpen("Bold")).toBe(true)
    await over(user, trigger("Italic"))
    await advance(699)
    expect(isOpen("Italic")).toBe(false)
    await advance(1)
    expect(isOpen("Italic")).toBe(true)
  })

  it("Skip delay zero: after the last one closed there is no warm window", async () => {
    const { user } = fakeTime()
    render(<Toolbar skipDelay={0} />)
    await over(user, trigger("Bold"))
    await advance(700)
    await away(user)
    await advance(300)
    expect(isOpen("Bold")).toBe(false)
    await over(user, trigger("Italic"))
    await advance(699)
    expect(isOpen("Italic")).toBe(false)
    await advance(1)
    expect(isOpen("Italic")).toBe(true)
  })

  it("Open tooltip unmounted: five seconds later another hover waits its full delay (zag#3390)", async () => {
    const { user } = fakeTime()
    function Page({ toolbar }: { toolbar: boolean }) {
      return (
        <>
          {toolbar ? <Toolbar names={["Bold"]} /> : null}
          <Tip name="Other" text="Other text" />
        </>
      )
    }
    const { rerender } = render(<Page toolbar />)
    await over(user, trigger("Bold"))
    await advance(700)
    expect(isOpen("Bold")).toBe(true)
    rerender(<Page toolbar={false} />)
    await advance(5000)
    await over(user, trigger("Other"))
    await advance(699)
    expect(isOpen("Other")).toBe(false)
    await advance(1)
    expect(isOpen("Other")).toBe(true)
    expect(contentOf("Other").hasAttribute("data-instant")).toBe(false)
  })

  it("Instant open: content carries data-state open and data-instant", async () => {
    const { user } = fakeTime()
    render(<Toolbar />)
    await over(user, trigger("Bold"))
    await advance(700)
    await over(user, trigger("Italic"))
    const content = contentOf("Italic")
    expect(content.getAttribute("data-state")).toBe("open")
    expect(content.hasAttribute("data-instant")).toBe(true)
    expect(content.closest('[data-part="positioner"]')?.hasAttribute("data-instant")).toBe(true)
  })
})

describe("Opening On Keyboard Focus", () => {
  it("Tab onto the trigger opens immediately with reason focus", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(
      <>
        <button type="button">Before</button>
        <Tip onOpenChange={log} />
      </>,
    )
    await tab(user)
    await tab(user)
    expect(active()).toBe(trigger())
    expect(isOpen()).toBe(true)
    expect(log.pairs()).toEqual([[true, "focus"]])
    expect(contentOf().hasAttribute("data-instant")).toBe(false)
  })

  it("Focus with a pointer press does not open it", async () => {
    const { user } = fakeTime()
    render(<Tip closeOnPress={false} />)
    await act(() => user.click(trigger()))
    await advance(5000)
    expect(active()).toBe(trigger())
    // the pointer is on the trigger, so it opens by hover after the delay but not by focus
    await away(user)
    await advance(300)
    expect(isOpen()).toBe(false)
  })

  it("Popover initial focus: a tooltip button that receives initial focus stays closed (radix#2248, ark#2565)", async () => {
    const { user } = fakeTime()
    render(
      <Popover.Root>
        <Popover.Trigger>Settings</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Settings">
              <Tip name="Reset" text="Reset all" />
              <input aria-label="Name" />
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    await act(() => user.tab())
    expect(active()).toBe(screen.getByRole("button", { name: "Settings" }))
    await key(user, "{Enter}")
    await advance(100)
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    expect(active()).toBe(trigger("Reset"))
    await advance(1000)
    expect(isOpen("Reset")).toBe(false)
  })

  it("Focus restored after a popover closes with Escape: the tooltip stays closed (react-spectrum#1170, ariakit#750)", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(
      <Popover.Root>
        <Tooltip.Root onOpenChange={log}>
          <Popover.Trigger render={<Tooltip.Trigger />}>Menu</Popover.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Content>Open the menu</Tooltip.Content>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Menu items">
              <button type="button">Item</button>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    await tab(user)
    expect(isOpen("Menu")).toBe(true)
    await key(user, "{Enter}")
    // The press closes the tooltip and opens the popover
    expect(isOpen("Menu")).toBe(false)
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    await key(user, "{Escape}")
    await advance(100)
    await vi.waitFor(() => expect(active()).toBe(trigger("Menu")))
    await advance(2000)
    expect(isOpen("Menu")).toBe(false)
    expect(log.pairs()).toEqual([
      [true, "focus"],
      [false, "trigger-press"],
    ])
  })

  it("Browser tab re-activated: the window refocusing the trigger does not reopen it (radix#1800)", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await tab(user)
    expect(isOpen()).toBe(true)
    await key(user, "{Escape}")
    expect(isOpen()).toBe(false)
    // the user switches tabs and comes back: the window blurs, then the trigger gets `focus`
    await act(async () => {
      window.dispatchEvent(new FocusEvent("blur"))
      trigger().blur()
      trigger().focus()
    })
    await advance(2000)
    expect(active()).toBe(trigger())
    expect(isOpen()).toBe(false)
  })

  it("Focus wrapped by a modal trap opens the first trigger's tooltip (ark#3378)", async () => {
    const { user } = fakeTime()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content aria-label="Tools">
              <Tip name="One" text="First" />
              <Tip name="Two" text="Second" />
              <Tip name="Three" text="Third" />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    await act(async () => trigger("Three").focus())
    expect(isOpen("Three")).toBe(false)
    await tab(user)
    expect(active()).toBe(trigger("One"))
    await vi.waitFor(() => expect(isOpen("One")).toBe(true))
  })

  it("Screen reader cursor: virtual focus stays closed and the description is still there", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await act(async () => trigger().focus())
    await advance(2000)
    expect(isOpen()).toBe(false)
    const tip = getTooltip(domEnv({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) }), {
      name: "Delete",
    })
    expect(await tip.description()).toBe("Delete permanently")
    void user
  })
})

describe("Closing", () => {
  it("Pointer leave closes after closeDelay with reason pointer-leave", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Tip onOpenChange={log} />)
    await over(user, trigger())
    await advance(700)
    await away(user)
    await advance(299)
    expect(isOpen()).toBe(true)
    await advance(1)
    expect(isOpen()).toBe(false)
    expect(log.pairs()).toEqual([
      [true, "hover"],
      [false, "pointer-leave"],
    ])
  })

  it("Brief exit and return within the close delay: it never closes", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Tip onOpenChange={log} />)
    await over(user, trigger())
    await advance(700)
    await away(user)
    await advance(250)
    await over(user, trigger())
    await advance(5000)
    expect(isOpen()).toBe(true)
    expect(log).toHaveBeenCalledTimes(1)
    // The same session: still placed, not back to an invisible first frame (review r1).
    expect(contentOf().hasAttribute("data-placing")).toBe(false)
    expect(contentOf().closest("[data-placing]")).toBeNull()
  })

  it("Press closes and does not reopen until the pointer leaves and enters again", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Tip onOpenChange={log} />)
    await over(user, trigger())
    await advance(700)
    await act(() => user.click(trigger()))
    expect(isOpen()).toBe(false)
    expect(log.pairs().at(-1)).toEqual([false, "trigger-press"])
    await advance(5000)
    expect(isOpen()).toBe(false)
    await away(user)
    await over(user, trigger())
    await advance(700)
    expect(isOpen()).toBe(true)
  })

  it("Enter and Space on the trigger close it with trigger-press (closeOnPress)", async () => {
    const { user } = fakeTime()
    for (const k of ["{Enter}", " "]) {
      const log = changes()
      const { unmount } = render(<Tip onOpenChange={log} />)
      await tab(user)
      expect(isOpen()).toBe(true)
      await key(user, k)
      expect(isOpen()).toBe(false)
      expect(log.pairs().at(-1)).toEqual([false, "trigger-press"])
      unmount()
    }
  })

  it("closeOnPress false: pressing the trigger leaves it open", async () => {
    const { user } = fakeTime()
    render(<Tip closeOnPress={false} />)
    await tab(user)
    await key(user, "{Enter}")
    expect(isOpen()).toBe(true)
    await over(user, trigger())
    await act(() => user.click(trigger()))
    expect(isOpen()).toBe(true)
  })

  it("Focus kept, pointer leaves: it stays open while the trigger keeps keyboard focus", async () => {
    const { user } = fakeTime()
    render(
      <>
        <button type="button">Before</button>
        <Tip />
      </>,
    )
    await tab(user)
    await tab(user)
    expect(isOpen()).toBe(true)
    await over(user, trigger())
    await away(user)
    await advance(5000)
    expect(active()).toBe(trigger())
    expect(isOpen()).toBe(true)
  })

  it("Persistent while hovered: ten seconds on the content and it is still open", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await over(user, trigger())
    await advance(700)
    await placed()
    await over(user, contentOf())
    await advance(10_000)
    expect(isOpen()).toBe(true)
  })

  it("Move onto the tooltip: it stays open when the pointer goes from the trigger to the content (ariakit#887, zag#1506)", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await over(user, trigger())
    await advance(700)
    await placed()
    await over(user, contentOf())
    await advance(2000)
    expect(isOpen()).toBe(true)
    // leaving the content closes it after the delay
    await away(user)
    await advance(300)
    expect(isOpen()).toBe(false)
  })

  it("Tab away closes it at once with reason blur", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(
      <>
        <Tip onOpenChange={log} />
        <button type="button">After</button>
      </>,
    )
    await tab(user)
    expect(isOpen()).toBe(true)
    await tab(user)
    expect(isOpen()).toBe(false)
    expect(log.pairs().at(-1)).toEqual([false, "blur"])
  })

  it("Blur with the pointer still on the trigger keeps it open until the pointer leaves", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await tab(user)
    await over(user, trigger())
    await act(async () => trigger().blur())
    expect(isOpen()).toBe(true)
    await away(user)
    await advance(300)
    expect(isOpen()).toBe(false)
  })

  it("An outside press closes a hover-opened tooltip with reason outside-press", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(
      <>
        <Tip onOpenChange={log} />
        <p>Page text</p>
      </>,
    )
    await over(user, trigger())
    await advance(700)
    await act(() => user.pointer([{ keys: "[MouseLeft]", target: screen.getByText("Page text") }]))
    expect(isOpen()).toBe(false)
    expect(log.pairs().at(-1)).toEqual([false, "outside-press"])
  })

  it("An outside press closes a focus-opened tooltip (outside-press or blur)", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(
      <>
        <Tip onOpenChange={log} />
        <p>Page text</p>
      </>,
    )
    await tab(user)
    await act(() => user.pointer([{ keys: "[MouseLeft]", target: screen.getByText("Page text") }]))
    expect(isOpen()).toBe(false)
    expect(["outside-press", "blur"]).toContain(log.pairs().at(-1)?.[1])
  })

  it("A press on the content does not close it", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await over(user, trigger())
    await advance(700)
    await act(() => user.pointer([{ keys: "[MouseLeft]", target: contentOf() }]))
    expect(isOpen()).toBe(true)
  })

  it("no timer hides an open tooltip on its own", async () => {
    fakeTime()
    render(<Tip defaultOpen />)
    await advance(60_000)
    expect(isOpen()).toBe(true)
  })

  it("closed, a stray Escape or outside press reports nothing", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(
      <>
        <Tip onOpenChange={log} />
        <p>Page</p>
      </>,
    )
    await key(user, "{Escape}")
    await act(() => user.click(screen.getByText("Page")))
    expect(log).not.toHaveBeenCalled()
  })
})

describe("Layer And Escape", () => {
  it("registers a tooltip layer only while open or closing, and none when closed", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    const kinds = () =>
      getLayerStack(document)
        .layers()
        .map((l) => l.id)
    expect(kinds()).toEqual([])
    await over(user, trigger())
    expect(kinds()).toEqual([]) // waiting for the delay: no layer
    await advance(700)
    expect(kinds()).toHaveLength(1)
    await away(user)
    await advance(300)
    await vi.waitFor(() => expect(kinds()).toEqual([]))
  })

  it("Hover tooltip inside a dialog: Escape closes the tooltip first, the second the dialog (mui/base-ui#4022, ariakit#7622)", async () => {
    const { user } = fakeTime()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content aria-label="Edit">
              <button type="button">Name</button>
              <Tip name="Info" text="More info" />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    await act(async () => screen.getByRole("button", { name: "Name" }).focus())
    await over(user, trigger("Info"))
    await advance(700)
    expect(isOpen("Info")).toBe(true)
    expect(active()).toBe(screen.getByRole("button", { name: "Name" }))
    await key(user, "{Escape}")
    expect(isOpen("Info")).toBe(false)
    expect(screen.queryByRole("dialog")).not.toBeNull()
    await key(user, "{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("one Escape produces one close", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(<Tip onOpenChange={log} />)
    await tab(user)
    await key(user, "{Escape}")
    await key(user, "{Escape}")
    expect(log.pairs()).toEqual([
      [true, "focus"],
      [false, "escape-key"],
    ])
  })

  it("Escape while closed closes the popover that contains the focused trigger", async () => {
    const { user } = fakeTime()
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Panel">
              <Tip name="Help" text="Get help" />
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    await act(async () => trigger("Help").focus()) // programmatic: stays closed
    expect(isOpen("Help")).toBe(false)
    await key(user, "{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("Escape is ignored during IME composition", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await tab(user)
    await act(async () => {
      trigger().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true }),
      )
    })
    expect(isOpen()).toBe(true)
    await key(user, "{Escape}")
    expect(isOpen()).toBe(false)
  })

  it("Escape keeps focus and pointer where they are", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await tab(user)
    await key(user, "{Escape}")
    expect(active()).toBe(trigger())
  })

  it("a hover-opened tooltip is not dismissed by focus moving elsewhere (no outside-focus dismissal)", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(
      <>
        <Tip onOpenChange={log} />
        <button type="button">Other</button>
      </>,
    )
    await over(user, trigger())
    await advance(700)
    await act(async () => screen.getByRole("button", { name: "Other" }).focus())
    expect(isOpen()).toBe(true)
    expect(log.pairs()).toEqual([[true, "hover"]])
  })
})

describe("Description And Label Wiring", () => {
  it("Browse-mode reading while closed: the description exists and the content is hidden (react-spectrum#2101)", async () => {
    render(<Tip />)
    const tip = getTooltip(screen, { name: "Delete" })
    expect(await tip.isOpen()).toBe(false)
    expect(await tip.description()).toBe("Delete permanently")
    const content = contentOf()
    expect(content).toBeTruthy()
    expect(content.hasAttribute("hidden")).toBe(true)
    expect(content.getAttribute("role")).toBe("tooltip")
    expect(content.getAttribute("data-state")).toBe("closed")
  })

  it("Consumer description kept: aria-describedby 'hint <content id>' (radix#2598)", () => {
    render(
      <>
        <p id="hint">Hint text</p>
        <Tip triggerProps={{ "aria-describedby": "hint" }} />
      </>,
    )
    const ids = trigger().getAttribute("aria-describedby")?.split(" ") ?? []
    expect(ids[0]).toBe("hint")
    expect(ids).toHaveLength(2)
    expect(ids[1]).toBe(contentOf().id)
  })

  it("Icon-only button labelled by its tooltip, open or closed", async () => {
    const { user } = fakeTime()
    render(
      <Tip type="label" text="Bold" name="">
        <svg role="img" aria-hidden="true" width="4" height="4" />
      </Tip>,
    )
    const button = screen.getByRole("button", { name: "Bold" })
    expect(button.hasAttribute("aria-describedby")).toBe(false)
    const content = document.getElementById(button.getAttribute("aria-labelledby") ?? "")
    expect(content?.hasAttribute("role")).toBe(false)
    expect(content?.getAttribute("data-type")).toBe("label")
    await tab(user)
    expect(button.getAttribute("data-state")).toBe("open")
    expect(screen.getByRole("button", { name: "Bold" })).toBe(button)
  })

  it("Label equals description: a development warning suggests type label", () => {
    render(<Tip name="Delete" text="Delete" />)
    const messages = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes("tooltip") && m.includes('type="label"'))).toBe(true)
  })

  it("Label equals description with the content rendered in place: the warning fires", () => {
    render(<Tip name="Delete" text="Delete" inline />)
    const messages = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes("tooltip") && m.includes('type="label"'))).toBe(true)
  })

  it("Label differing from the description: no warning", () => {
    render(<Tip />)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it("Consumer label overridden: a type label trigger with aria-label warns", () => {
    render(<Tip type="label" text="Bold" triggerProps={{ "aria-label": "Strong" }} name="B" />)
    const messages = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes("aria-label") && m.includes("ignored"))).toBe(true)
  })

  it("a type label tooltip with an aria-label-less trigger does not warn about it", () => {
    render(<Tip type="label" text="Bold" name="B" />)
    const messages = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes("aria-label"))).toBe(false)
  })
})

describe("Not Focusable, Not Interactive", () => {
  it("the content never receives focus and has no tabindex", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await over(user, trigger())
    await advance(700)
    expect(contentOf().hasAttribute("tabindex")).toBe(false)
    await act(() => user.pointer([{ keys: "[MouseLeft]", target: contentOf() }]))
    expect(contentOf().contains(active())).toBe(false)
  })

  it("Link inside a tooltip: a development warning names the tooltip and the link", () => {
    render(
      <Tip
        contentChildren={
          <a href="https://example.com" id="inside">
            More
          </a>
        }
      />,
    )
    const messages = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]))
    const hit = messages.find((m) => m.includes("tabbable"))
    expect(hit, messages.join("\n")).toBeDefined()
    expect(hit).toContain(`tooltip #${trigger().id}`)
    expect(hit).toContain("a")
  })

  it("Link inside an open tooltip rendered in place: the warning fires", () => {
    render(<Tip inline defaultOpen contentChildren={<a href="https://example.com">More</a>} />)
    const messages = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes("tabbable"))).toBe(true)
  })

  it("plain text content does not warn", () => {
    render(<Tip />)
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe("Trigger Requirements", () => {
  it("Explaining a disabled action: an aria-disabled trigger opens on hover and on keyboard focus (mui/base-ui#4966, #3075)", async () => {
    const { user } = fakeTime()
    render(<Tip name="Push" text="Nothing to push" triggerProps={{ "aria-disabled": "true" }} />)
    await over(user, trigger("Push"))
    await advance(700)
    expect(isOpen("Push")).toBe(true)
    await away(user)
    await advance(300)
    expect(isOpen("Push")).toBe(false)
    await tab(user)
    expect(isOpen("Push")).toBe(true)
  })

  it("Natively disabled trigger: a development warning suggests focusableWhenDisabled (ariakit#471, react-spectrum#8539)", () => {
    render(<Tip name="Push" triggerProps={{ disabled: true }} />)
    const messages = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]))
    const hit = messages.find((m) => m.includes("disabled"))
    expect(hit, messages.join("\n")).toBeDefined()
    expect(hit).toContain("focusableWhenDisabled")
  })

  it("a non-focusable rendered trigger warns and gets no tabindex", () => {
    render(
      <Tooltip.Root>
        <Tooltip.Trigger render={<span />}>Plain</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>Text</Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    )
    const span = document.querySelector('[data-part="trigger"]') as HTMLElement
    expect(span.hasAttribute("tabindex")).toBe(false)
    const messages = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes("not focusable"))).toBe(true)
  })

  it("a focusable trigger rendered as another element does not warn", () => {
    render(
      <Tooltip.Root>
        <Tooltip.Trigger render={<a href="#x" />}>Docs</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>Text</Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    )
    expect(console.warn).not.toHaveBeenCalled()
  })

  const SwitchWithTip = ({ outer }: { outer: "tooltip" | "switch" }) => {
    const tip = (
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Content>Turn Wi-Fi on</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    )
    return (
      <Switch.Root>
        <Tooltip.Root>
          {outer === "tooltip" ? (
            <Tooltip.Trigger render={<Switch.Control />}>
              <Switch.Thumb />
            </Tooltip.Trigger>
          ) : (
            <Switch.Control render={<Tooltip.Trigger />}>
              <Switch.Thumb />
            </Switch.Control>
          )}
          {tip}
        </Tooltip.Root>
        <Switch.Label>Wi-Fi</Switch.Label>
      </Switch.Root>
    )
  }

  it.each(["tooltip", "switch"] as const)(
    "A switch as the trigger (%s outermost) keeps its name and opens the tooltip on hover and focus (mui/base-ui#5305)",
    async (outer) => {
      const { user } = fakeTime()
      render(<SwitchWithTip outer={outer} />)
      const control = screen.getByRole("switch", { name: "Wi-Fi" })
      const tipContent = document.getElementById(
        control.getAttribute("aria-describedby")?.split(" ").at(-1) ?? "",
      )
      expect(tipContent?.textContent).toBe("Turn Wi-Fi on")
      await over(user, control)
      await advance(700)
      expect(tipContent?.getAttribute("data-state")).toBe("open")
      await away(user)
      await advance(300)
      expect(tipContent?.getAttribute("data-state")).toBe("closed")
      await tab(user)
      expect(active()).toBe(control)
      expect(tipContent?.getAttribute("data-state")).toBe("open")
      await key(user, " ")
      expect(control.getAttribute("aria-checked")).toBe("true")
      expect(tipContent?.getAttribute("data-state")).toBe("closed")
    },
  )
})

describe("A checkbox as the trigger", () => {
  it("keeps its id, scope and name, and the tooltip opens on hover and on keyboard focus", async () => {
    const { user } = fakeTime()
    render(
      <Checkbox.Root>
        <Tooltip.Root>
          <Tooltip.Trigger render={<Checkbox.Control />}>
            <Checkbox.Indicator />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Content>Get the weekly digest</Tooltip.Content>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Checkbox.Label>Newsletter</Checkbox.Label>
      </Checkbox.Root>,
    )
    const control = screen.getByRole("checkbox", { name: "Newsletter" })
    expect(control.getAttribute("data-scope")).toBe("checkbox")
    expect(control.id).not.toContain("tooltip")
    const tipContent = document.getElementById(
      control.getAttribute("aria-describedby")?.split(" ").at(-1) ?? "",
    )
    expect(tipContent?.textContent).toBe("Get the weekly digest")
    await over(user, control)
    await advance(700)
    expect(tipContent?.getAttribute("data-state")).toBe("open")
    await away(user)
    await advance(300)
    expect(tipContent?.getAttribute("data-state")).toBe("closed")
    await tab(user)
    expect(active()).toBe(control)
    expect(tipContent?.getAttribute("data-state")).toBe("open")
  })
})

describe("Touch", () => {
  it("a touch tap activates the trigger and never opens, and the focus after it does not open either", async () => {
    const { user } = fakeTime()
    const onClick = vi.fn()
    render(<Tip triggerProps={{ onClick }} />)
    await act(() => user.pointer([{ keys: "[TouchA]", target: trigger() }]))
    await advance(5000)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(isOpen()).toBe(false)
  })

  it("long press does not open it", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await act(() => user.pointer([{ keys: "[TouchA>]", target: trigger() }]))
    await advance(2000)
    await act(() => user.pointer([{ keys: "[/TouchA]", target: trigger() }]))
    await advance(2000)
    expect(isOpen()).toBe(false)
  })
})

describe("Touch (iOS) and scrolling", () => {
  it("Emulated mouse after touch: the pointer events iOS fires after a tap do not start hover intent", async () => {
    fakeTime()
    render(
      <RindProvider environment={{ platform: platforms.ios }}>
        <Tip />
      </RindProvider>,
    )
    const t = trigger()
    await act(async () => {
      t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }))
      t.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }))
      // what iOS sends right after: a "mouse" pointer for the same tap
      t.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }))
      t.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }))
    })
    await advance(5000)
    expect(isOpen()).toBe(false)
  })

  it.skipIf(isJsdom)(
    "Focus scrolls the trigger into view: the focus-opened tooltip stays open (radix#1944, react-spectrum#10333, zag#1589)",
    async () => {
      const user = userEvent.setup()
      render(
        <div style={{ height: 3000 }}>
          <button type="button">Before</button>
          <div style={{ height: 1500 }} />
          <Tip closeDelay={50} />
        </div>,
      )
      await tab(user) // Before
      await tab(user) // the trigger, far below the fold
      expect(active()).toBe(trigger())
      await vi.waitFor(() => expect(isOpen()).toBe(true))
      // drain frames (smooth scroll, scroll events, hover-intent re-check) instead of waiting
      await act(async () => {
        for (let i = 0; i < 12; i++) await new Promise((r) => requestAnimationFrame(() => r(null)))
      })
      expect(window.scrollY).toBeGreaterThan(0)
      expect(isOpen()).toBe(true)
      window.scrollTo(0, 0)
    },
  )

  it.skipIf(isJsdom)(
    "A container scrolls the hovered trigger away: the tooltip closes after its close delay (ariakit#4058, mui/base-ui#1447, reka-ui#2543)",
    async () => {
      const user = userEvent.setup()
      render(
        <div style={{ height: 160, overflow: "auto", marginTop: 120 }} data-testid="list">
          <div style={{ height: 40 }} />
          <Tip openDelay={0} closeDelay={50} />
          <div style={{ height: 800 }} />
        </div>,
      )
      const el = trigger()
      const r = el.getBoundingClientRect()
      await act(() =>
        user.pointer({
          target: el,
          coords: { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 },
        }),
      )
      await vi.waitFor(() => expect(isOpen()).toBe(true))
      await placed()
      screen.getByTestId("list").scrollTop = 300
      await vi.waitFor(() => expect(isOpen()).toBe(false), { timeout: 2000 })
    },
  )
})

describe("Inside Modal Layers", () => {
  function InDialog() {
    return (
      <>
        <button type="button">Outside</button>
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Positioner>
              <Dialog.Content aria-label="Edit">
                <Tip name="Info" text="More info" />
                <button type="button">Next</button>
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    )
  }

  it("Description inside a dialog: no inert ancestor, the description is exposed (react-spectrum#8915)", async () => {
    render(<InDialog />)
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    const content = contentOf("Info")
    expect(content.closest("[inert]")).toBeNull()
    expect(trigger("Info").closest("[inert]")).toBeNull()
    const tip = getTooltip(screen, { name: "Info" })
    expect(await tip.description()).toBe("More info")
    // while the page behind the dialog is inert
    expect(screen.getByText("Outside", { selector: "button" }).closest("[inert]")).not.toBeNull()
  })

  it("An open tooltip inside a dialog is not inert either", async () => {
    const { user } = fakeTime()
    render(<InDialog />)
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    await over(user, trigger("Info"))
    await advance(700)
    expect(isOpen("Info")).toBe(true)
    expect(contentOf("Info").closest("[inert]")).toBeNull()
  })

  it("Tab away from an open tooltip in a dialog moves to the next element and closes it (radix#3185)", async () => {
    const { user } = fakeTime()
    render(<InDialog />)
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    await act(async () => trigger("Info").blur())
    await tab(user)
    expect(active()).toBe(trigger("Info"))
    expect(isOpen("Info")).toBe(true)
    await tab(user)
    expect(active()).toBe(screen.getByRole("button", { name: "Next" }))
    expect(isOpen("Info")).toBe(false)
  })

  it("the tooltip layer is a child of the dialog layer that contains its trigger", async () => {
    const { user } = fakeTime()
    render(<InDialog />)
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    await over(user, trigger("Info"))
    await advance(700)
    const layers = getLayerStack(document).layers()
    const tooltip = layers.find((l) => l.id.includes("tooltip"))
    const dialog = layers.find((l) => !l.id.includes("tooltip"))
    expect(tooltip?.parentId).toBe(dialog?.id)
  })
})

describe("Composition With Other Triggers", () => {
  it("Menu button with a tooltip: the popover opens and gets focus, the tooltip closes on the press and stays closed after focus returns (bits-ui#2200, ariakit#3754)", async () => {
    const { user } = fakeTime()
    const log = changes()
    render(
      <Popover.Root>
        <Tooltip.Root onOpenChange={log}>
          <Popover.Trigger render={<Tooltip.Trigger />}>Menu</Popover.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Content>Open the menu</Tooltip.Content>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Menu items">
              <button type="button">Item</button>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    const button = screen.getByRole("button", { name: "Menu" })
    expect(button.getAttribute("aria-haspopup")).toBeTruthy()
    expect(button.getAttribute("aria-describedby")).toBeTruthy()
    await tab(user)
    expect(isOpen("Menu")).toBe(true)
    await key(user, "{Enter}")
    await vi.waitFor(() => expect(screen.getByRole("dialog").contains(active())).toBe(true))
    expect(log.pairs().at(-1)).toEqual([false, "trigger-press"])
    expect(button.getAttribute("aria-expanded")).toBe("true")
    await key(user, "{Escape}")
    await vi.waitFor(() => expect(active()).toBe(button))
    await advance(2000)
    expect(log.pairs()).toEqual([
      [true, "focus"],
      [false, "trigger-press"],
    ])
  })

  it("the tooltip never prevents default or stops propagation of the trigger's events", async () => {
    const { user } = fakeTime()
    const seen: Record<string, boolean> = {}
    const listeners = new AbortController()
    // Bubble-phase listeners on the document: they run only if nothing stopped propagation.
    for (const type of ["keydown", "click", "pointerdown", "focusin"]) {
      document.addEventListener(type, (e) => (seen[type] = e.defaultPrevented), {
        signal: listeners.signal,
      })
    }
    render(<Tip />)
    await tab(user)
    await key(user, "{Enter}")
    await act(() => user.click(trigger()))
    listeners.abort()
    expect(seen).toEqual({ keydown: false, click: false, pointerdown: false, focusin: false })
  })
})

describe("Announcements", () => {
  it("Open and close: nothing was announced", async () => {
    const { user } = fakeTime()
    const log = installAnnouncementLog()
    const before = log.length
    render(<Tip />)
    await over(user, trigger())
    await advance(700)
    await away(user)
    await advance(300)
    await tab(user)
    await key(user, "{Escape}")
    await advance(2000)
    expect(log.slice(before)).toEqual([])
    const tip = getTooltip(domEnv({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) }), {
      name: "Delete",
    })
    expect(await tip.announcements()).toEqual([])
  })
})

describe("Visibility And Presence", () => {
  it("closed content keeps data-state closed and is hidden, the same element as it reopens", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    const content = contentOf()
    await over(user, trigger())
    await advance(700)
    expect(content.hasAttribute("hidden")).toBe(false)
    expect(contentOf()).toBe(content)
    await away(user)
    await advance(300)
    await vi.waitFor(() => expect(content.hasAttribute("hidden")).toBe(true))
    expect(content.getAttribute("data-state")).toBe("closed")
    expect(content.closest('[data-part="positioner"]')?.hasAttribute("hidden")).toBe(true)
    await over(user, trigger())
    await advance(700)
    expect(contentOf()).toBe(content)
    expect(content.hasAttribute("hidden")).toBe(false)
  })

  it.skipIf(isJsdom)(
    "Exit animation then hidden: data-state closed without hidden for the animation (150 ms fade-out)",
    async () => {
      const style = document.createElement("style")
      style.id = "test-style"
      style.textContent = `
        @keyframes tip-out { from { opacity: 1 } to { opacity: 0 } }
        [data-part="content"][data-state="closed"] { animation: tip-out 150ms linear forwards }
      `
      document.head.append(style)
      const user = userEvent.setup()
      render(<Tip openDelay={0} closeDelay={0} />)
      const content = contentOf()
      await over(user, trigger())
      await vi.waitFor(() => expect(isOpen()).toBe(true))
      await away(user)
      await vi.waitFor(() => expect(isOpen()).toBe(false))
      expect(content.getAttribute("data-state")).toBe("closed")
      expect(content.hasAttribute("hidden")).toBe(false)
      await vi.waitFor(() => expect(content.hasAttribute("hidden")).toBe(true), { timeout: 2000 })
      await over(user, trigger())
      await vi.waitFor(() => expect(isOpen()).toBe(true))
      expect(contentOf()).toBe(content)
    },
  )
})

describe("Positioning", () => {
  it.skipIf(isJsdom)("opens on top of the trigger by default, never covering it", async () => {
    const user = userEvent.setup()
    render(
      <div style={{ paddingTop: 200 }}>
        <Tip openDelay={0} />
      </div>,
    )
    const tip = getTooltip(screen, { name: "Delete" })
    await tip.show()
    await vi.waitFor(async () => expect(await tip.isPlaced()).toBe(true))
    expect(await tip.side()).toBe("top")
    const t = trigger().getBoundingClientRect()
    const c = contentOf().getBoundingClientRect()
    expect(c.bottom).toBeLessThanOrEqual(t.top + 0.5)
    expect(t.top - c.bottom).toBeCloseTo(8, 0)
    void user
  })

  it.skipIf(isJsdom)("Trigger at the top edge: it flips below with data-side bottom", async () => {
    render(
      <div style={{ margin: -8 }}>
        <Tip openDelay={0} />
      </div>,
    )
    const tip = getTooltip(screen, { name: "Delete" })
    await tip.show()
    await vi.waitFor(async () => expect(await tip.isPlaced()).toBe(true))
    expect(await tip.side()).toBe("bottom")
    expect(contentOf().getAttribute("data-side")).toBe("bottom")
    const t = trigger().getBoundingClientRect()
    expect(contentOf().getBoundingClientRect().top).toBeGreaterThanOrEqual(t.bottom - 0.5)
  })

  it("consumer positioning overrides the side", async () => {
    const { user } = fakeTime()
    render(<Tip positioning={{ side: "bottom" }} />)
    await over(user, trigger())
    await advance(700)
    expect(contentOf().getAttribute("data-side")).toBe("bottom")
  })
})

describe("Data Attributes", () => {
  it("Trigger: data-state, data-hover, data-focus and data-focus-visible", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    const t = trigger()
    expect(t.getAttribute("data-state")).toBe("closed")
    expect(t.hasAttribute("data-hover")).toBe(false)
    await over(user, t)
    expect(t.hasAttribute("data-hover")).toBe(true)
    await advance(700)
    expect(t.getAttribute("data-state")).toBe("open")
    await away(user)
    expect(t.hasAttribute("data-hover")).toBe(false)
    await tab(user)
    expect(t.hasAttribute("data-focus")).toBe(true)
    expect(t.hasAttribute("data-focus-visible")).toBe(true)
    await act(async () => t.blur())
    expect(t.hasAttribute("data-focus")).toBe(false)
  })

  it("Positioner and Content: data-state, data-side, data-align, data-type", async () => {
    const { user } = fakeTime()
    render(<Tip />)
    await over(user, trigger())
    await advance(700)
    const positioner = document.querySelector('[data-part="positioner"]') as HTMLElement
    const content = contentOf()
    for (const el of [positioner, content]) {
      expect(el.getAttribute("data-state")).toBe("open")
      expect(el.getAttribute("data-side")).toBeTruthy()
      expect(el.getAttribute("data-align")).toBeTruthy()
    }
    expect(content.getAttribute("data-type")).toBe("description")
    expect(document.querySelector('[data-part="arrow"]')?.getAttribute("data-side")).toBeTruthy()
  })

  it("data-placing is present until the first placement", async () => {
    render(<Tip defaultOpen />)
    const content = contentOf()
    await vi.waitFor(() => expect(content.hasAttribute("data-placing")).toBe(false))
  })
})

describe("Contract driver", () => {
  it("Driver with fake timers: show() resolves once the delay was advanced and the tooltip is open", async () => {
    const { env } = fakeTime()
    render(<Tip name="Bold" text="Make bold" />)
    const tip = getTooltip(env(), { name: "Bold" })
    await tip.show()
    expect(await tip.isOpen()).toBe(true)
    expect(await tip.text()).toBe("Make bold")
    expect(await tip.description()).toBe("Make bold")
    expect(await tip.label()).toBe("Bold")
    expect(await tip.isInstant()).toBe(false)
    await tip.hide()
    expect(await tip.isOpen()).toBe(false)
  })

  it("keyboard show and Escape hide", async () => {
    const { env } = fakeTime()
    render(<Tip name="Bold" text="Make bold" />)
    const tip = getTooltip(env(), { name: "Bold" }).via("keyboard")
    await tip.show()
    expect(await tip.isOpen()).toBe(true)
    expect(active()).toBe(trigger("Bold"))
    await tip.pressEscape()
    expect(await tip.isOpen()).toBe(false)
  })

  it("hoverContent keeps it open, pressTrigger closes it", async () => {
    const { env } = fakeTime()
    render(<Tip name="Bold" text="Make bold" />)
    const tip = getTooltip(env(), { name: "Bold" })
    await tip.show()
    await placed("Bold")
    await tip.hoverContent()
    expect(await tip.isOpen()).toBe(true)
    await tip.pressTrigger()
    expect(await tip.isOpen()).toBe(false)
  })

  it("Touch replay: show with a touch pointer leaves it closed", async () => {
    const { env } = fakeTime()
    render(<Tip name="Bold" text="Make bold" />)
    const tip = getTooltip(env(), { name: "Bold" })
    await tip.part("trigger").hover({ pointerType: "touch" })
    await advance(5000)
    expect(await tip.isOpen()).toBe(false)
  })

  it("Virtual focus replay: stays closed and the description remains", async () => {
    const { env } = fakeTime()
    render(<Tip name="Bold" text="Make bold" />)
    const tip = getTooltip(env(), { name: "Bold" }).via("keyboard")
    await act(async () => trigger("Bold").focus())
    await advance(2000)
    expect(await tip.isOpen()).toBe(false)
    expect(await tip.description()).toBe("Make bold")
  })

  it("positioning queries", async () => {
    const { env } = fakeTime()
    render(<Tip name="Bold" text="Make bold" />)
    const tip = getTooltip(env(), { name: "Bold" })
    await tip.show()
    expect(["top", "bottom", "left", "right"]).toContain(await tip.side())
    expect(["start", "center", "end"]).toContain(await tip.align())
    expect(typeof (await tip.isAnchorHidden())).toBe("boolean")
  })

  it("a link trigger is located by role link", async () => {
    const { env } = fakeTime()
    render(
      <Tooltip.Root>
        <Tooltip.Trigger render={<a href="#docs" />}>Docs</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>Read the docs</Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    )
    const tip = getTooltip(env(), { name: "Docs", role: "link" })
    await tip.show()
    expect(await tip.text()).toBe("Read the docs")
  })
})

describe("Providers and StrictMode", () => {
  it("works under StrictMode and a RindProvider", async () => {
    const { user } = fakeTime()
    render(
      <StrictMode>
        <RindProvider>
          <Toolbar />
        </RindProvider>
      </StrictMode>,
    )
    await over(user, trigger("Bold"))
    await advance(700)
    expect(isOpen("Bold")).toBe(true)
    await key(user, "{Escape}")
    expect(isOpen("Bold")).toBe(false)
    expect(within(document.body).getAllByRole("button")).toHaveLength(3)
  })
})

describe("defaultOpen (review: rind-ui-e2)", () => {
  it.each([false, true])("is placed after mounting open (StrictMode: %s)", async (strict) => {
    const tip = (
      <Tooltip.Root defaultOpen>
        <Tooltip.Trigger>Bold</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>Make bold</Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    )
    render(strict ? <StrictMode>{tip}</StrictMode> : tip)
    await vi.waitFor(() => {
      const positioner = document.querySelector('[data-scope="tooltip"][data-part="positioner"]')
      expect(positioner?.hasAttribute("data-placing")).toBe(false)
    })
  })
})
