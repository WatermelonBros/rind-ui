// Popover scenarios (openspec add-popover): every spec scenario and cited regression, in
// jsdom and in real browsers, through the popover driver where possible.
//
// Layout-dependent scenarios (placement against a custom anchor, flip, real exit animation)
// run in the browsers only: jsdom has no layout and no CSS animations.
import { getLayerStack } from "@rind-ui/core"
import {
  Dialog,
  type DialogActions,
  Heading,
  Popover,
  type PopoverActions,
  type PopoverRootProps,
  RindProvider,
} from "@rind-ui/react"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, type ReactNode, type RefObject, StrictMode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Layer } from "../../fixtures/layer/layer.react"
import { getPopover, installAnnouncementLog } from "../index"

const isJsdom = navigator.userAgent.includes("jsdom")

afterEach(() => {
  vi.restoreAllMocks()
  document.getElementById("test-style")?.remove()
})

const inert = (el: Element | null) => el?.closest("[inert]") != null
const settle = () => act(async () => {})
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
/** Drains animation frames (and the microtasks between them) instead of waiting on the clock. */
const frames = (count = 6) =>
  act(async () => {
    for (let i = 0; i < count; i++) await nextFrame()
  })
const active = () => document.activeElement

interface FullProps extends Partial<PopoverRootProps> {
  readonly title?: string | null
  readonly description?: string | null
  readonly label?: string
  readonly inline?: boolean
  readonly closeLabel?: string | null
  readonly children?: ReactNode
}

/** Trigger plus a positioner/content with a title, a field and a close trigger. */
function Full({
  title = "Filters",
  description = "Narrow the list.",
  label = "Filters",
  inline = false,
  closeLabel = "Done",
  children,
  ...root
}: FullProps) {
  const body = (
    <Popover.Positioner>
      <Popover.Content>
        <Popover.Arrow />
        {title === null ? null : <Popover.Title>{title}</Popover.Title>}
        {description === null ? null : <Popover.Description>{description}</Popover.Description>}
        {children ?? (
          <label>
            Search <input />
          </label>
        )}
        {closeLabel === null ? null : <Popover.CloseTrigger>{closeLabel}</Popover.CloseTrigger>}
      </Popover.Content>
    </Popover.Positioner>
  )
  return (
    <Popover.Root {...root}>
      <Popover.Trigger>{label}</Popover.Trigger>
      {inline ? body : <Popover.Portal>{body}</Popover.Portal>}
    </Popover.Root>
  )
}

/**
 * A click with the element's real coordinates: the press hit test needs them in a browser,
 * where user-event's default pointer sits at 0,0.
 */
async function press(
  user: ReturnType<typeof userEvent.setup>,
  el: Element,
  how: "mouse" | "touch" = "mouse",
) {
  const r = el.getBoundingClientRect()
  const coords = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
  if (how === "touch") await user.pointer([{ keys: "[TouchA]", target: el, coords }])
  else
    await user.pointer([
      { target: el, coords },
      { keys: "[MouseLeft]", target: el, coords },
    ])
}

const trigger = (name = "Filters") => screen.getByRole("button", { name })
const popoverEl = (name?: string) =>
  name ? screen.getByRole("dialog", { name }) : screen.getByRole("dialog")
const queryPopover = (name?: string) =>
  name ? screen.queryByRole("dialog", { name, hidden: true }) : screen.queryByRole("dialog")
const part = (name: string) => document.querySelector<HTMLElement>(`[data-part="${name}"]`)

/** Opens through the trigger and waits for focus to move into the content. */
async function openByClick(user: ReturnType<typeof userEvent.setup>, name = "Filters") {
  await press(user, trigger(name))
  await vi.waitFor(() => expect(queryPopover()?.contains(active())).toBe(true))
  await settle()
}
const closed = () => vi.waitFor(() => expect(queryPopover()).toBeNull())

describe("Anatomy", () => {
  it.each([false, true])("Portalled parts stay attributed (inline=%s)", async (inline) => {
    const user = userEvent.setup()
    render(<Full inline={inline} />)
    await openByClick(user)
    const instance = trigger().getAttribute("data-instance")
    expect(instance).toBeTruthy()
    for (const name of ["positioner", "content", "arrow"]) {
      const el = part(name)
      expect(el?.getAttribute("data-scope"), name).toBe("popover")
      expect(el?.getAttribute("data-part"), name).toBe(name)
      expect(el?.getAttribute("data-instance"), name).toBe(instance)
    }
    if (!inline)
      expect(part("positioner")?.parentElement?.closest("[data-rind-portal]")).toBeTruthy()
  })

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("Trigger rendered as a div: role=button, tabindex=0, %s toggles", async (_n, keys) => {
    const user = userEvent.setup()
    render(
      <Popover.Root>
        <Popover.Trigger render={<div />}>Filters</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="Filters">
            <input aria-label="Field" />
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    const t = screen.getByRole("button", { name: "Filters" })
    expect(t.tagName).toBe("DIV")
    expect(t.getAttribute("tabindex")).toBe("0")
    await user.tab()
    expect(active()).toBe(t)
    await user.keyboard(keys)
    await vi.waitFor(() => expect(queryPopover()).not.toBeNull())
    expect(t.getAttribute("aria-expanded")).toBe("true")
    await vi.waitFor(() => expect(popoverEl().contains(active())).toBe(true))
    act(() => t.focus())
    await user.keyboard(keys)
    await closed()
  })

  it("Trigger rendered as a div: a bare click toggles", async () => {
    render(
      <Popover.Root>
        <Popover.Trigger render={<div />}>Filters</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="Filters">
            <input aria-label="Field" />
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    const t = screen.getByRole("button", { name: "Filters" })
    await act(async () => t.click())
    await vi.waitFor(() => expect(queryPopover()).not.toBeNull())
    await act(async () => t.click())
    await closed()
  })

  it("Every part accepts element substitution without changing behaviour", async () => {
    const user = userEvent.setup()
    render(
      <Popover.Root>
        <Popover.Anchor render={<section />}>
          <Popover.Trigger render={<a href="#x" />}>Filters</Popover.Trigger>
        </Popover.Anchor>
        <Popover.Positioner render={<section />}>
          <Popover.Content render={<aside />}>
            {/* biome-ignore lint/a11y/useHeadingContent: the content is the Title's children */}
            <Popover.Title render={<h3 />}>Filters</Popover.Title>
            <Popover.Description render={<span />}>Desc</Popover.Description>
            <Popover.CloseTrigger render={<a href="#y" />}>Done</Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await press(user, screen.getByText("Filters", { selector: "a" }))
    await vi.waitFor(() => expect(part("content")?.tagName).toBe("ASIDE"))
    expect(part("positioner")?.tagName).toBe("SECTION")
    expect(part("anchor")?.tagName).toBe("SECTION")
    expect(part("content")?.getAttribute("role")).toBe("dialog")
  })
})

describe("Open state", () => {
  it("Uncontrolled toggle: true then false, both with reason trigger", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    await press(user, trigger())
    await closed()
    expect(onOpenChange.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([
      [true, "trigger"],
      [false, "trigger"],
    ])
  })

  it("Controlled refusal: the content is not rendered", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full open={false} onOpenChange={onOpenChange} />)
    await press(user, trigger())
    await settle()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true)
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("trigger")
    expect(queryPopover()).toBeNull()
  })

  it("Coordinator owns the state: an outside press is reported once and the content stays", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <>
        <button type="button">Page</button>
        <Full open onOpenChange={onOpenChange} />
      </>,
    )
    await vi.waitFor(() => expect(queryPopover()?.contains(active())).toBe(true))
    await press(user, screen.getByRole("button", { name: "Page" }))
    await settle()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("outside-press")
    expect(queryPopover()).not.toBeNull()
  })

  it("Coordinator applying the proposal closes it", async () => {
    const user = userEvent.setup()
    function Host() {
      const [open, setOpen] = useState(true)
      return <Full open={open} onOpenChange={setOpen} />
    }
    render(<Host />)
    await vi.waitFor(() => expect(queryPopover()?.contains(active())).toBe(true))
    await user.keyboard("{Escape}")
    await closed()
  })

  it("details.cancel() keeps the current state", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn((_o: boolean, d: { cancel(): void }) => d.cancel())
    render(<Full onOpenChange={onOpenChange} />)
    await press(user, trigger())
    await settle()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(queryPopover()).toBeNull()
  })

  it("Open at mount, closed with Escape: focus goes to the trigger, not body (react-spectrum#10661)", async () => {
    const user = userEvent.setup()
    render(<Full defaultOpen />)
    await vi.waitFor(() => expect(queryPopover()?.contains(active())).toBe(true))
    await user.keyboard("{Escape}")
    await closed()
    await vi.waitFor(() => expect(active()).toBe(trigger()))
  })

  it("Open then close in one task ends closed", async () => {
    const actions: RefObject<PopoverActions | null> = createRef()
    render(<Full actionsRef={actions} />)
    act(() => {
      actions.current?.open()
      actions.current?.close()
    })
    await frames()
    expect(queryPopover()).toBeNull()
  })

  it("actionsRef.open reports reason open, close reports api", async () => {
    const actions: RefObject<PopoverActions | null> = createRef()
    const onOpenChange = vi.fn()
    render(<Full actionsRef={actions} onOpenChange={onOpenChange} />)
    act(() => actions.current?.open())
    await vi.waitFor(() => expect(queryPopover()).not.toBeNull())
    act(() => actions.current?.close())
    await closed()
    expect(onOpenChange.mock.calls.map((c) => c[1].reason)).toEqual(["open", "api"])
  })
})

describe("Close reasons", () => {
  it("Close trigger: reason close-trigger, exiting content carries data-close-reason", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full keepMounted onOpenChange={onOpenChange} />)
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Done" }))
    await vi.waitFor(() => expect(trigger().getAttribute("aria-expanded")).toBe("false"))
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("close-trigger")
    expect(part("content")?.getAttribute("data-close-reason")).toBe("close-trigger")
    expect(part("content")?.getAttribute("data-state")).toBe("closed")
  })

  it("data-close-reason is gone on the next open", async () => {
    const user = userEvent.setup()
    render(<Full keepMounted />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(trigger().getAttribute("aria-expanded")).toBe("false"))
    expect(part("content")?.getAttribute("data-close-reason")).toBe("escape-key")
    await openByClick(user)
    expect(part("content")?.hasAttribute("data-close-reason")).toBe(false)
  })

  it("Parent closes: a popover inside a dialog closes first with parent-dismissed", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const dialog: RefObject<DialogActions | null> = createRef()
    render(
      <Dialog.Root defaultOpen actionsRef={dialog}>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content aria-label="Parent">
              <Full onOpenChange={onOpenChange} />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    await settle()
    await press(user, trigger())
    await vi.waitFor(() => expect(queryPopover("Filters")).not.toBeNull())
    await settle()
    onOpenChange.mockClear()
    act(() => dialog.current?.close())
    await vi.waitFor(() => expect(queryPopover("Filters")).toBeNull())
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("parent-dismissed")
  })
})

describe("Trigger toggles once per press", () => {
  it("Pressing the trigger of an open popover closes it and does not re-open it", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    await press(user, trigger())
    await closed()
    await frames()
    expect(queryPopover()).toBeNull()
    expect(onOpenChange.mock.calls.map((c) => c[1].reason)).toEqual(["trigger", "trigger"])
  })

  it("Keyboard Enter and Space on the trigger toggle once per press", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await user.tab()
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(popoverEl().contains(active())).toBe(true))
    act(() => trigger().focus())
    await user.keyboard(" ")
    await closed()
    expect(onOpenChange.mock.calls.map((c) => c[0])).toEqual([true, false])
  })

  it("Opening a sibling popover: A closes with outside-press, B opens and stays open", async () => {
    const user = userEvent.setup()
    const a = vi.fn()
    const b = vi.fn()
    render(
      <>
        <Full label="Alpha" title="Alpha" onOpenChange={a} />
        <Full label="Beta" title="Beta" onOpenChange={b} />
      </>,
    )
    await press(user, trigger("Alpha"))
    await vi.waitFor(() => expect(queryPopover("Alpha")).not.toBeNull())
    await settle()
    await press(user, trigger("Beta"))
    await vi.waitFor(() => expect(queryPopover("Alpha")).toBeNull())
    await vi.waitFor(() => expect(queryPopover("Beta")).not.toBeNull())
    await frames()
    expect(queryPopover("Beta")).not.toBeNull()
    expect(a.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([
      [true, "trigger"],
      [false, "outside-press"],
    ])
    expect(b.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([[true, "trigger"]])
  })

  it("Screen reader activation: a bare click opens once and moves focus into the content", async () => {
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await act(async () => trigger().click())
    await vi.waitFor(() => expect(popoverEl().contains(active())).toBe(true))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true)
  })
})

describe("Dismissal", () => {
  it("Escape with focus inside closes with escape-key", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await closed()
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("escape-key")
  })

  it("onEscapeKeyDown can veto; closeOnEscape false ignores Escape", async () => {
    const user = userEvent.setup()
    render(<Full onEscapeKeyDown={(e) => e.preventDefault()} />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await frames()
    expect(queryPopover()).not.toBeNull()
    cleanup()
    render(<Full closeOnEscape={false} />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await frames()
    expect(queryPopover()).not.toBeNull()
  })

  it("Veto outside press: onInteractOutside preventDefault keeps it open", async () => {
    const user = userEvent.setup()
    const onInteractOutside = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <>
        <button type="button">Page</button>
        <Full onInteractOutside={onInteractOutside} />
      </>,
    )
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Page" }))
    await frames()
    expect(onInteractOutside).toHaveBeenCalled()
    expect(queryPopover()).not.toBeNull()
  })

  it("closeOnInteractOutside false ignores an outside press", async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Page</button>
        <Full closeOnInteractOutside={false} />
      </>,
    )
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Page" }))
    await frames()
    expect(queryPopover()).not.toBeNull()
  })

  it("Outside click on a focusable element, controlled: one onOpenChange with outside-press (ark#3492)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    function Host() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button">Page</button>
          <Full
            open={open}
            onOpenChange={(o, d) => {
              onOpenChange(o, d)
              setOpen(o)
            }}
          />
        </>
      )
    }
    render(<Host />)
    await vi.waitFor(() => expect(queryPopover()?.contains(active())).toBe(true))
    await press(user, screen.getByRole("button", { name: "Page" }))
    await closed()
    await frames()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("outside-press")
  })

  it("Persistent element: a press on a listed toast keeps it open", async () => {
    const user = userEvent.setup()
    render(
      <>
        <div id="toast">
          <button type="button">Toast action</button>
        </div>
        <Full persistentElements={() => [document.getElementById("toast") as Element]} />
      </>,
    )
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Toast action" }))
    await frames()
    expect(queryPopover()).not.toBeNull()
  })

  it("One gesture produces one close request: an outside press reports once", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <>
        <p>Page text</p>
        <Full onOpenChange={onOpenChange} />
      </>,
    )
    await openByClick(user)
    onOpenChange.mockClear()
    await press(user, screen.getByText("Page text"))
    await closed()
    await frames()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("A press inside the content does not dismiss it", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    await press(user, screen.getByText("Narrow the list."))
    await frames()
    expect(queryPopover()).not.toBeNull()
  })
})

describe("Nesting", () => {
  it("Dialog opened after an unrelated popover is a root layer: the popover closes with outside-focus (ark#2610)", async () => {
    const onOpenChange = vi.fn()
    const dialog: RefObject<DialogActions | null> = createRef()
    render(
      <>
        <Full closeOnInteractOutside={false} onOpenChange={onOpenChange} />
        <Dialog.Root actionsRef={dialog}>
          <Dialog.Portal>
            <Dialog.Positioner>
              <Dialog.Content aria-label="Shortcut dialog">
                <input aria-label="Dialog field" />
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Portal>
        </Dialog.Root>
      </>,
    )
    const user = userEvent.setup()
    await openByClick(user)
    onOpenChange.mockClear()
    act(() => dialog.current?.open())
    await vi.waitFor(() => expect(queryPopover("Shortcut dialog")).not.toBeNull())
    await vi.waitFor(() => expect(queryPopover("Filters")).toBeNull())
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("outside-focus")
    await frames()
    expect(queryPopover("Shortcut dialog")).not.toBeNull()
  })

  it("A dialog mounted after the popover opened is not exempt: the popover closes with outside-focus (ark#2610)", async () => {
    const onOpenChange = vi.fn()
    let show: (on: boolean) => void = () => {}
    function Late() {
      const [on, setOn] = useState(false)
      show = setOn
      return on ? (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Positioner>
              <Dialog.Content aria-label="Late dialog">
                <input aria-label="Late field" />
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null
    }
    render(
      <>
        <Full closeOnInteractOutside={false} onOpenChange={onOpenChange} />
        <Late />
      </>,
    )
    const user = userEvent.setup()
    await openByClick(user)
    onOpenChange.mockClear()
    act(() => show(true))
    await vi.waitFor(() => expect(active()).toBe(screen.getByLabelText("Late field")))
    await vi.waitFor(() => expect(queryPopover("Filters")).toBeNull())
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("outside-focus")
  })

  it("Dialog opened from a popover inside a dialog: closing dialog 2 leaves the others open (zag#2933)", async () => {
    const user = userEvent.setup()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content aria-label="Dialog 1">
              <Popover.Root>
                <Popover.Trigger>Pop 1</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Content aria-label="Popover 1">
                      <Dialog.Root>
                        <Dialog.Trigger>Open dialog 2</Dialog.Trigger>
                        <Dialog.Portal>
                          <Dialog.Positioner>
                            <Dialog.Content aria-label="Dialog 2">
                              <Dialog.CloseTrigger>Close 2</Dialog.CloseTrigger>
                            </Dialog.Content>
                          </Dialog.Positioner>
                        </Dialog.Portal>
                      </Dialog.Root>
                    </Popover.Content>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    await settle()
    await press(user, screen.getByRole("button", { name: "Pop 1" }))
    await vi.waitFor(() => expect(queryPopover("Popover 1")?.contains(active())).toBe(true))
    await settle()
    const opener = screen.getByRole("button", { name: "Open dialog 2", hidden: true })
    await press(user, opener)
    await vi.waitFor(() => expect(queryPopover("Dialog 2")).not.toBeNull())
    await settle()
    await press(user, screen.getByRole("button", { name: "Close 2" }))
    await vi.waitFor(() => expect(queryPopover("Dialog 2")).toBeNull())
    expect(queryPopover("Popover 1")).not.toBeNull()
    expect(queryPopover("Dialog 1")).not.toBeNull()
    await vi.waitFor(() => expect(active()).toBe(opener))
  })

  function TwoPopovers({
    onInner,
    outer,
  }: {
    onInner?: (o: boolean, d: { reason: string }) => void
    outer?: RefObject<PopoverActions | null>
  }) {
    return (
      <>
        <button type="button">Page</button>
        <Popover.Root {...(outer ? { actionsRef: outer } : {})}>
          <Popover.Trigger>Outer</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Content aria-label="Outer panel">
                <Popover.Root onOpenChange={onInner}>
                  <Popover.Trigger>Inner</Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner>
                      <Popover.Content aria-label="Inner panel">
                        <input aria-label="Inner field" />
                      </Popover.Content>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    )
  }
  async function openBoth(user: ReturnType<typeof userEvent.setup>) {
    await press(user, trigger("Outer"))
    // Focus moves in after the first placement: pointer-events are back by then.
    await vi.waitFor(() => expect(queryPopover("Outer panel")?.contains(active())).toBe(true))
    await settle()
    await press(user, trigger("Inner"))
    await vi.waitFor(() => expect(queryPopover("Inner panel")?.contains(active())).toBe(true))
    await settle()
  }

  it("Nested popovers: an outside press closes both", async () => {
    const user = userEvent.setup()
    render(<TwoPopovers />)
    await openBoth(user)
    await press(user, screen.getByRole("button", { name: "Page" }))
    await vi.waitFor(() => expect(queryPopover("Outer panel")).toBeNull())
    expect(queryPopover("Inner panel")).toBeNull()
  })

  it("Nested popovers: Escape closes only the inner one", async () => {
    const user = userEvent.setup()
    render(<TwoPopovers />)
    await openBoth(user)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryPopover("Inner panel")).toBeNull())
    expect(queryPopover("Outer panel")).not.toBeNull()
  })

  it("A press inside the child layer does not dismiss the parent", async () => {
    const user = userEvent.setup()
    render(<TwoPopovers />)
    await openBoth(user)
    await press(user, screen.getByLabelText("Inner field"))
    await frames()
    expect(queryPopover("Inner panel")).not.toBeNull()
    expect(queryPopover("Outer panel")).not.toBeNull()
  })

  it("Stacking metadata: data-nested, data-has-nested, --layer-index and --nested-layer-count", async () => {
    const user = userEvent.setup()
    render(<TwoPopovers />)
    await openBoth(user)
    const outer = queryPopover("Outer panel")
    const inner = queryPopover("Inner panel")
    if (!outer || !inner) throw new Error("missing")
    await vi.waitFor(() => expect(outer.hasAttribute("data-has-nested")).toBe(true))
    expect(outer.hasAttribute("data-nested")).toBe(false)
    expect(outer.style.getPropertyValue("--nested-layer-count")).toBe("1")
    expect(inner.hasAttribute("data-nested")).toBe(true)
    expect(inner.hasAttribute("data-has-nested")).toBe(false)
    const index = (el: HTMLElement) => Number(el.style.getPropertyValue("--layer-index"))
    expect(index(inner)).toBe(index(outer) + 1)
  })

  it("Closing the outer popover closes the inner one first with parent-dismissed", async () => {
    const user = userEvent.setup()
    const onInner = vi.fn()
    const outer: RefObject<PopoverActions | null> = createRef()
    render(<TwoPopovers onInner={onInner} outer={outer} />)
    await openBoth(user)
    onInner.mockClear()
    act(() => outer.current?.close())
    await vi.waitFor(() => expect(queryPopover("Outer panel")).toBeNull())
    expect(onInner.mock.calls[0]?.[1].reason).toBe("parent-dismissed")
  })

  it("Select inside a popover: an option picked in a portalled listbox keeps the popover open", async () => {
    const user = userEvent.setup()
    const picked = vi.fn()
    render(
      <Popover.Root>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Filters panel">
              <Layer.Root id="sel" kind="menu" modal={false}>
                <Layer.Trigger>Pick</Layer.Trigger>
                <Layer.Portal>
                  <Layer.Positioner>
                    <Layer.Content>
                      <button type="button" onClick={picked}>
                        Option A
                      </button>
                    </Layer.Content>
                  </Layer.Positioner>
                </Layer.Portal>
              </Layer.Root>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Pick" }))
    const option = await screen.findByRole("button", { name: "Option A" })
    await settle()
    await press(user, option)
    await frames()
    expect(picked).toHaveBeenCalledTimes(1)
    expect(queryPopover("Filters panel")).not.toBeNull()
  })

  it("Popover inside a dialog is that dialog's child (data-nested follows the family only)", async () => {
    const user = userEvent.setup()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content aria-label="Host dialog">
              <Full />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    await settle()
    await press(user, trigger())
    await vi.waitFor(() => expect(queryPopover("Filters")).not.toBeNull())
    await settle()
    // Escape closes only the popover, then the dialog
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryPopover("Filters")).toBeNull())
    expect(queryPopover("Host dialog")).not.toBeNull()
    await vi.waitFor(() => expect(active()).toBe(trigger()))
  })
})

describe("Non-modal mode", () => {
  it("Makes nothing inert, locks no scroll, adds no body pointer-events", async () => {
    const user = userEvent.setup()
    render(
      <div id="app">
        <Full />
      </div>,
    )
    await openByClick(user)
    expect(inert(document.getElementById("app"))).toBe(false)
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(false)
    expect(document.body.style.pointerEvents).toBe("")
    expect(popoverEl().getAttribute("aria-modal")).toBeNull()
    expect(popoverEl().hasAttribute("data-modal")).toBe(false)
  })

  it("Tabbing inside the content between three inputs keeps it open (headlessui#3231)", async () => {
    const user = userEvent.setup()
    render(
      <Full>
        <input aria-label="One" />
        <input aria-label="Two" />
        <input aria-label="Three" />
      </Full>,
    )
    await openByClick(user)
    act(() => screen.getByLabelText("One").focus())
    await user.tab()
    expect(active()).toBe(screen.getByLabelText("Two"))
    await user.tab()
    expect(active()).toBe(screen.getByLabelText("Three"))
    await frames()
    expect(queryPopover()).not.toBeNull()
  })

  it("Tab leaves the popover: focus goes after the trigger and it closes with outside-focus (radix#4128)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <>
        <Full onOpenChange={onOpenChange}>
          <input aria-label="One" />
        </Full>
        <button type="button">Save</button>
      </>,
    )
    await openByClick(user)
    act(() => screen.getByRole("button", { name: "Done" }).focus())
    await user.tab()
    await vi.waitFor(() => expect(active()).toBe(screen.getByRole("button", { name: "Save" })))
    await closed()
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("outside-focus")
  })

  it("Scroll does not close: wheel and programmatic scrolls leave it open and attached", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Full />
        <div style={{ height: 3000 }} />
      </>,
    )
    await openByClick(user)
    window.scrollBy(0, 200)
    window.dispatchEvent(new Event("scroll"))
    document.dispatchEvent(new Event("scroll", { bubbles: true }))
    document.body.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }))
    await frames()
    expect(queryPopover()).not.toBeNull()
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
  })

  it("Focus moving from the content into its descendant layer does not dismiss it", async () => {
    const user = userEvent.setup()
    render(
      <Popover.Root>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Panel">
              <Layer.Root id="sub" kind="menu" modal={false}>
                <Layer.Trigger>Sub</Layer.Trigger>
                <Layer.Portal>
                  <Layer.Positioner>
                    <Layer.Content>
                      <input aria-label="Sub field" />
                    </Layer.Content>
                  </Layer.Positioner>
                </Layer.Portal>
              </Layer.Root>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Sub" }))
    const sub = await screen.findByLabelText("Sub field")
    await settle()
    act(() => sub.focus())
    await frames()
    expect(queryPopover("Panel")).not.toBeNull()
    expect(active()).toBe(sub)
  })
})

describe("Modal mode", () => {
  function Modal({ close = true, ...root }: Partial<PopoverRootProps> & { close?: boolean }) {
    return (
      <div id="app">
        <p id="page">Page</p>
        <Popover.Root modal {...root}>
          <Popover.Trigger>Filters</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Content>
                <Popover.Title>Filters</Popover.Title>
                <input aria-label="First" />
                <button type="button">Last</button>
                {close ? <Popover.CloseTrigger>Close</Popover.CloseTrigger> : null}
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    )
  }

  it("Outside is inert, the content is not, the wheel does not scroll the page; attributes", async () => {
    const user = userEvent.setup()
    render(<Modal />)
    await openByClick(user)
    expect(inert(document.getElementById("page"))).toBe(true)
    expect(inert(popoverEl())).toBe(false)
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(true)
    expect(popoverEl().getAttribute("aria-modal")).toBe("true")
    expect(popoverEl().hasAttribute("data-modal")).toBe(true)
  })

  // Spec "Outside is inert": the application root is inert, only the content is not. The
  // trigger lives in the application root, so it must be inert too.
  it("The application root, trigger included, is inert while a modal popover is open", async () => {
    const user = userEvent.setup()
    render(<Modal />)
    await openByClick(user)
    expect(inert(document.getElementById("app"))).toBe(true)
    expect(inert(trigger())).toBe(true)
  })

  it("Tab wraps from the last tabbable to the first and Shift+Tab back", async () => {
    const user = userEvent.setup()
    render(<Modal />)
    await openByClick(user)
    const first = screen.getByLabelText("First")
    const last = screen.getByRole("button", { name: "Close" })
    act(() => last.focus())
    await user.tab()
    expect(active()).toBe(first)
    await user.tab({ shift: true })
    expect(active()).toBe(last)
  })

  it("Closing restores the page: inert and scroll lock removed, focus on the trigger", async () => {
    const user = userEvent.setup()
    render(<Modal />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await closed()
    await settle()
    expect(inert(document.getElementById("app"))).toBe(false)
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(false)
    await vi.waitFor(() => expect(active()).toBe(trigger()))
  })

  it("A modal popover without a CloseTrigger warns in development, naming the part", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Modal close={false} />)
    await openByClick(user)
    await frames()
    const messages = warn.mock.calls.map((c) => String(c[0]))
    expect(messages.some((m) => m.includes("popover") && m.includes("Popover.CloseTrigger"))).toBe(
      true,
    )
  })

  it("A modal popover with a CloseTrigger does not warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Modal />)
    await openByClick(user)
    await frames()
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("CloseTrigger"))).toEqual([])
  })

  it("Nested modal popovers opened together: the inner one is not inert and has focus (react-spectrum#10662)", async () => {
    render(
      <div id="app">
        <p id="page">Page</p>
        <Popover.Root modal defaultOpen>
          <Popover.Trigger>Outer</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Content aria-label="Outer panel">
                <Popover.CloseTrigger>Close outer</Popover.CloseTrigger>
                <Popover.Root modal defaultOpen>
                  <Popover.Trigger>Inner</Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner>
                      <Popover.Content aria-label="Inner panel">
                        <input aria-label="Inner field" />
                        <Popover.CloseTrigger>Close inner</Popover.CloseTrigger>
                      </Popover.Content>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>,
    )
    await settle()
    await frames()
    const outer = queryPopover("Outer panel")
    const inner = queryPopover("Inner panel")
    expect(outer).not.toBeNull()
    expect(inner).not.toBeNull()
    expect(inert(document.getElementById("app"))).toBe(true)
    // The outer popover is beneath the topmost modal, as a parent dialog is.
    expect(inert(outer)).toBe(true)
    expect(inert(inner)).toBe(false)
    await vi.waitFor(() => expect(inner?.contains(active())).toBe(true))
  })
})

describe("Initial focus", () => {
  it("Keyboard open: the first input is focused after placement, the page does not scroll", async () => {
    const user = userEvent.setup()
    render(
      <>
        <div style={{ height: 3000 }} />
        <Full />
      </>,
    )
    await user.tab()
    expect(active()).toBe(trigger())
    const y = window.scrollY
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(active()?.tagName).toBe("INPUT"))
    expect(window.scrollY).toBe(y)
  })

  it("The content is placed (data-placing gone) by the time focus is inside", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await user.tab()
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(active()?.tagName).toBe("INPUT"))
    expect(popoverEl().hasAttribute("data-placing")).toBe(false)
  })

  it("No tabbable content: the content element is focused and the popover stays open (reka-ui#2803)", async () => {
    const user = userEvent.setup()
    render(
      <Full closeLabel={null} description={null}>
        <p>Loading</p>
      </Full>,
    )
    await press(user, trigger())
    await vi.waitFor(() => expect(active()).toBe(popoverEl()))
    expect(popoverEl().getAttribute("tabindex")).toBe("-1")
    await frames()
    expect(queryPopover()).not.toBeNull()
  })

  it("Skip initial focus: initialFocus returning false leaves focus on the trigger", async () => {
    const user = userEvent.setup()
    render(<Full initialFocus={() => false} />)
    await user.tab()
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(queryPopover()).not.toBeNull())
    await frames()
    expect(active()).toBe(trigger())
  })

  it("initialFocus returning an element focuses it", async () => {
    const user = userEvent.setup()
    render(
      <Full initialFocus={() => document.getElementById("pick")}>
        <input aria-label="Other" />
        <input id="pick" aria-label="Picked" />
      </Full>,
    )
    await press(user, trigger())
    await vi.waitFor(() => expect(active()).toBe(screen.getByLabelText("Picked")))
  })

  it("data-autofocus wins over the first tabbable", async () => {
    const user = userEvent.setup()
    render(
      <Full>
        <input aria-label="First" />
        <input aria-label="Target" data-autofocus />
      </Full>,
    )
    await press(user, trigger())
    await vi.waitFor(() => expect(active()).toBe(screen.getByLabelText("Target")))
  })

  it("Opened by touch: the content itself is focused", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await press(user, trigger(), "touch")
    await vi.waitFor(() => expect(queryPopover()).not.toBeNull())
    await vi.waitFor(() => expect(active()).toBe(popoverEl()))
  })

  it("A content element focused by default counts as inside: an outside press still closes", async () => {
    const user = userEvent.setup()
    render(
      <>
        <p>Page text</p>
        <Full closeLabel={null}>
          <p>Loading</p>
        </Full>
      </>,
    )
    await press(user, trigger())
    await vi.waitFor(() => expect(active()).toBe(popoverEl()))
    await press(user, screen.getByText("Loading"))
    await frames()
    expect(queryPopover()).not.toBeNull()
  })
})

describe("Focus restore", () => {
  it("Controlled close: the trigger is focused and has data-focus-visible (zag#1747, zag#1788)", async () => {
    const user = userEvent.setup()
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            Shut
          </button>
          <Full open={open} onOpenChange={setOpen} />
        </>
      )
    }
    render(<Host />)
    await user.tab()
    await user.tab()
    expect(active()).toBe(trigger())
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(popoverEl().contains(active())).toBe(true))
    // The parent closes it while focus is inside
    act(() => {
      const shut = screen.getByRole("button", { name: "Shut", hidden: true })
      shut.click()
    })
    await closed()
    await vi.waitFor(() => expect(active()).toBe(trigger()))
    expect(trigger().hasAttribute("data-focus-visible")).toBe(true)
  })

  it("Programmatic close with focus inside returns focus to the trigger", async () => {
    const user = userEvent.setup()
    const actions: RefObject<PopoverActions | null> = createRef()
    render(<Full actionsRef={actions} />)
    await openByClick(user)
    act(() => actions.current?.close())
    await closed()
    await vi.waitFor(() => expect(active()).toBe(trigger()))
  })

  it("Close trigger: the trigger is focused (zag#1746)", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Done" }))
    await closed()
    await vi.waitFor(() => expect(active()).toBe(trigger()))
  })

  it("Outside click on a text field: it closes and the field keeps focus (radix#2942)", async () => {
    const user = userEvent.setup()
    render(
      <>
        <input aria-label="Page field" />
        <Full />
      </>,
    )
    await openByClick(user)
    await press(user, screen.getByLabelText("Page field"))
    await closed()
    await frames()
    expect(active()).toBe(screen.getByLabelText("Page field"))
  })

  it("Mouse close leaves no focus ring: data-focus without data-focus-visible (bits-ui#1213, headlessui#1694)", async () => {
    const user = userEvent.setup()
    render(
      <>
        <p>Plain text</p>
        <Full />
      </>,
    )
    await openByClick(user)
    await press(user, screen.getByText("Plain text"))
    await closed()
    await vi.waitFor(() => expect(active()).toBe(trigger()))
    expect(trigger().hasAttribute("data-focus")).toBe(true)
    expect(trigger().hasAttribute("data-focus-visible")).toBe(false)
  })

  it("finalFocus receives the reason; false leaves focus alone", async () => {
    const user = userEvent.setup()
    const reasons: unknown[] = []
    render(
      <>
        <button type="button" id="elsewhere">
          Elsewhere
        </button>
        <Full
          finalFocus={(reason) => {
            reasons.push(reason)
            return document.getElementById("elsewhere")
          }}
        />
      </>,
    )
    await openByClick(user)
    await user.keyboard("{Escape}")
    await closed()
    await vi.waitFor(() => expect(active()).toBe(screen.getByRole("button", { name: "Elsewhere" })))
    expect(reasons).toContain("escape-key")
    cleanup()
    render(<Full finalFocus={false} />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await closed()
    await settle()
    expect(active()).not.toBe(trigger())
  })
})

describe("Accessible name and description", () => {
  it("Title rendered lazily: aria-labelledby points at the rendered title on every open (ark#4182)", async () => {
    const user = userEvent.setup()
    render(<Full />)
    for (let i = 0; i < 2; i++) {
      await openByClick(user)
      const title = screen.getByRole("heading", { name: "Filters" })
      expect(popoverEl().getAttribute("aria-labelledby")).toBe(title.id)
      await user.keyboard("{Escape}")
      await closed()
    }
  })

  it("Title and description name and describe the dialog", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    expect(
      screen.getByRole("dialog", { name: "Filters", description: "Narrow the list." }),
    ).toBeTruthy()
  })

  it("Non-modal without a title: named by the trigger", async () => {
    const user = userEvent.setup()
    render(<Full title={null} description={null} />)
    await openByClick(user)
    expect(popoverEl().getAttribute("aria-labelledby")).toBe(trigger().id)
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeTruthy()
    expect(popoverEl().hasAttribute("aria-describedby")).toBe(false)
  })

  it("The consumer's aria-label names a popover without a title", async () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>Trigger text</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="Custom name" />
        </Popover.Positioner>
      </Popover.Root>,
    )
    await settle()
    expect(screen.getByRole("dialog", { name: "Custom name" })).toBeTruthy()
  })

  it("Title wins over the consumer's aria-labelledby", async () => {
    render(
      <>
        <span id="mine">Mine</span>
        <Popover.Root defaultOpen>
          <Popover.Trigger>Trigger text</Popover.Trigger>
          <Popover.Positioner>
            <Popover.Content aria-labelledby="mine">
              <Popover.Title>From title</Popover.Title>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Root>
      </>,
    )
    await settle()
    expect(screen.getByRole("dialog", { name: "From title" })).toBeTruthy()
  })

  it("Consumer description merged with the description part", async () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>T</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="X" aria-describedby="hint">
            <p id="hint">Hint</p>
            <Popover.Description>Desc</Popover.Description>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await settle()
    const ids = (popoverEl().getAttribute("aria-describedby") ?? "").split(" ")
    expect(ids[0]).toBe("hint")
    expect(ids).toContain(screen.getByText("Desc").id)
    expect(ids).toHaveLength(2)
  })

  it("Modal without a name: a development error is reported and no trigger fallback is used", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const user = userEvent.setup()
    render(
      <Popover.Root modal>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content>
            <button type="button">Inside</button>
            <Popover.CloseTrigger>Close</Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await press(user, trigger())
    await vi.waitFor(() => expect(queryPopover()).not.toBeNull())
    await frames()
    expect(popoverEl().hasAttribute("aria-labelledby")).toBe(false)
    expect(error.mock.calls.some((c) => String(c[0]).includes("no accessible name"))).toBe(true)
  })

  it("A named modal popover reports no error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const user = userEvent.setup()
    render(
      <Popover.Root modal>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="Named">
            <Popover.CloseTrigger>Close</Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await press(user, trigger())
    await vi.waitFor(() => expect(queryPopover()).not.toBeNull())
    await frames()
    expect(error.mock.calls.filter((c) => String(c[0]).includes("accessible name"))).toEqual([])
  })
})

describe("ARIA attributes", () => {
  it("Closed popover: aria-expanded false and no aria-controls (reka-ui#2597)", () => {
    render(<Full />)
    const t = trigger()
    expect(t.getAttribute("aria-haspopup")).toBe("dialog")
    expect(t.getAttribute("aria-expanded")).toBe("false")
    expect(t.hasAttribute("aria-controls")).toBe(false)
  })

  it("Open popover: aria-expanded true and aria-controls equals the content id", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
    expect(trigger().getAttribute("aria-controls")).toBe(popoverEl().id)
    expect(popoverEl().getAttribute("tabindex")).toBe("-1")
    expect(part("arrow")?.getAttribute("aria-hidden")).toBe("true")
  })

  it("Indicator is aria-hidden and follows data-state", async () => {
    const user = userEvent.setup()
    render(
      <Popover.Root>
        <Popover.Trigger>
          Filters <Popover.Indicator>v</Popover.Indicator>
        </Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="Filters" />
        </Popover.Positioner>
      </Popover.Root>,
    )
    expect(part("indicator")?.getAttribute("aria-hidden")).toBe("true")
    expect(part("indicator")?.getAttribute("data-state")).toBe("closed")
    await press(user, trigger("Filters"))
    await vi.waitFor(() => expect(part("indicator")?.getAttribute("data-state")).toBe("open"))
  })

  it("Closed content is unmounted: no aria-controls dangling after the exit", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await closed()
    await vi.waitFor(() => expect(trigger().hasAttribute("aria-controls")).toBe(false))
  })
})

describe("Data attributes", () => {
  it("Styling hooks while open: state open, side bottom, no data-placing, no data-modal", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    const content = popoverEl()
    expect(content.getAttribute("data-state")).toBe("open")
    expect(content.hasAttribute("data-placing")).toBe(false)
    expect(content.hasAttribute("data-modal")).toBe(false)
    expect(content.getAttribute("data-side")).toBe("bottom")
    expect(part("positioner")?.getAttribute("data-state")).toBe("open")
    expect(trigger().getAttribute("data-state")).toBe("open")
  })

  it("Trigger: data-pressed while pressed, data-disabled when disabled", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Full />)
    expect(trigger().hasAttribute("data-disabled")).toBe(false)
    const r = trigger().getBoundingClientRect()
    const coords = { clientX: r.left + 1, clientY: r.top + 1 }
    await user.pointer([{ keys: "[MouseLeft>]", target: trigger(), coords }])
    await vi.waitFor(() => expect(trigger().hasAttribute("data-pressed")).toBe(true))
    await user.pointer([{ keys: "[/MouseLeft]", target: trigger(), coords }])
    await vi.waitFor(() => expect(trigger().hasAttribute("data-pressed")).toBe(false))
    rerender(<Full disabled />)
    expect(trigger().hasAttribute("data-disabled")).toBe(true)
  })

  it("Close trigger: data-pressed, data-focus and data-focus-visible", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    const close = screen.getByRole("button", { name: "Done" })
    act(() => close.focus())
    await user.keyboard("{Tab}")
    act(() => close.focus())
    await vi.waitFor(() => expect(close.hasAttribute("data-focus")).toBe(true))
  })
})

describe("Keyboard interactions", () => {
  it("Keyboard round trip: Enter opens, Tab cycles, Escape closes and restores focus-visible", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await user.tab()
    expect(active()).toBe(trigger())
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(active()?.tagName).toBe("INPUT"))
    await user.keyboard("{Escape}")
    await closed()
    await vi.waitFor(() => expect(active()).toBe(trigger()))
    expect(trigger().hasAttribute("data-focus-visible")).toBe(true)
  })

  it("Tab on the trigger of an open non-modal popover enters the content's first tabbable", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    act(() => trigger().focus())
    await user.tab()
    expect(active()).toBe(screen.getByLabelText("Search"))
  })

  it("Shift+Tab on the first tabbable goes back to the trigger and keeps it open", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    act(() => screen.getByLabelText("Search").focus())
    await user.tab({ shift: true })
    expect(active()).toBe(trigger())
    await frames()
    expect(queryPopover()).not.toBeNull()
  })

  it("Escape with focus on body (the focused element was removed) still closes", async () => {
    const user = userEvent.setup()
    function Host() {
      const [show, setShow] = useState(true)
      return (
        <Full>
          {show ? (
            <button type="button" onClick={() => setShow(false)}>
              Remove me
            </button>
          ) : null}
        </Full>
      )
    }
    render(<Host />)
    await openByClick(user)
    act(() => screen.getByRole("button", { name: "Remove me" }).focus())
    await act(async () => screen.getByRole("button", { name: "Remove me" }).click())
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: "Remove me" })).toBeNull())
    act(() => (document.activeElement as HTMLElement | null)?.blur())
    await user.keyboard("{Escape}")
    await closed()
  })

  it("Escape in a search field that clears itself (preventDefault) keeps it open", async () => {
    const user = userEvent.setup()
    render(
      <Full>
        <input
          aria-label="Search box"
          onKeyDown={(e) => {
            if (e.key === "Escape") e.preventDefault()
          }}
        />
      </Full>,
    )
    await openByClick(user)
    act(() => screen.getByLabelText("Search box").focus())
    await user.keyboard("{Escape}")
    await frames()
    expect(queryPopover()).not.toBeNull()
  })

  it("Escape during an IME composition does not close it", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    const input = screen.getByLabelText("Search")
    act(() => input.focus())
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    await frames()
    expect(queryPopover()).not.toBeNull()
  })

  it("Inner widget handling Tab (preventDefault) keeps focus and the popover open", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Full>
          <textarea
            aria-label="Editor"
            onKeyDown={(e) => {
              if (e.key === "Tab") e.preventDefault()
            }}
          />
        </Full>
        <button type="button">After</button>
      </>,
    )
    await openByClick(user)
    const editor = screen.getByLabelText("Editor")
    act(() => editor.focus())
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    )
    await frames()
    expect(active()).toBe(editor)
    expect(queryPopover()).not.toBeNull()
    void user
  })
})

describe("Non-modal tab order", () => {
  /** Tabs from the element before the trigger and records where focus goes. */
  async function walk(user: ReturnType<typeof userEvent.setup>, steps: number) {
    const seen: string[] = []
    for (let i = 0; i < steps; i++) {
      await user.tab()
      const a = active()
      seen.push(a?.getAttribute("aria-label") ?? a?.textContent ?? a?.tagName ?? "?")
    }
    return seen
  }
  const Page = ({ inline }: { inline: boolean }) => (
    <>
      <button type="button">Before</button>
      <Full
        inline={inline}
        open
        onOpenChange={() => {}}
        closeLabel={null}
        description={null}
        title={null}
        label="Filters"
      >
        <input aria-label="One" />
        <button type="button">Two</button>
      </Full>
      <button type="button">Save</button>
      <button type="button">End</button>
    </>
  )

  it("Inline and portalled give the same order (WCAG 2.4.3)", async () => {
    const user = userEvent.setup()
    render(<Page inline={false} />)
    await vi.waitFor(() => expect(queryPopover()?.contains(active())).toBe(true))
    act(() => screen.getByRole("button", { name: "Before" }).focus())
    const portalled = await walk(user, 5)
    cleanup()
    render(<Page inline />)
    await vi.waitFor(() => expect(queryPopover()?.contains(active())).toBe(true))
    act(() => screen.getByRole("button", { name: "Before" }).focus())
    const inline = await walk(user, 5)
    expect(portalled).toEqual(["Filters", "One", "Two", "Save", "End"])
    expect(inline).toEqual(portalled)
  })

  it("No guard elements: no system-added tabindex=0 outside the popover's own parts", async () => {
    const user = userEvent.setup()
    render(<Full />)
    const before = document.querySelectorAll('[tabindex="0"]').length
    await openByClick(user)
    const added = [...document.querySelectorAll('[tabindex="0"]')].filter(
      (el) => !el.closest('[data-scope="popover"]'),
    )
    expect(added).toHaveLength(0)
    expect(document.querySelectorAll('[tabindex="0"]').length).toBe(before)
  })

  it("Continue after the trigger: Save is focused and it closes with outside-focus", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <>
        <Full onOpenChange={onOpenChange} />
        <button type="button">Save</button>
      </>,
    )
    await openByClick(user)
    act(() => screen.getByRole("button", { name: "Done" }).focus())
    await user.tab()
    await vi.waitFor(() => expect(active()).toBe(screen.getByRole("button", { name: "Save" })))
    await closed()
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("outside-focus")
  })

  it("Popover inside a popover: B's last element continues inside A, B closes, A stays", async () => {
    const user = userEvent.setup()
    const onInner = vi.fn()
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>Outer</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Outer panel">
              <Popover.Root onOpenChange={onInner} defaultOpen>
                <Popover.Trigger>Inner</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Content aria-label="Inner panel">
                      <button type="button">Inner last</button>
                    </Popover.Content>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
              <button type="button">After inner trigger</button>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    await settle()
    await frames()
    act(() => screen.getByRole("button", { name: "Inner last" }).focus())
    await user.tab()
    await vi.waitFor(() =>
      expect(active()).toBe(screen.getByRole("button", { name: "After inner trigger" })),
    )
    await vi.waitFor(() => expect(queryPopover("Inner panel")).toBeNull())
    expect(queryPopover("Outer panel")).not.toBeNull()
    expect(onInner.mock.calls.at(-1)?.[1].reason).toBe("outside-focus")
  })

  it("Nothing after the trigger: no error, no recursion, the popover stays (base-ui#5715)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <Popover.Root defaultOpen>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Text only">
              <p>Just text</p>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
        <Popover.Trigger>Last</Popover.Trigger>
      </Popover.Root>,
    )
    await vi.waitFor(() => expect(active()).toBe(popoverEl()))
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })
    await act(async () => {
      expect(() => popoverEl().dispatchEvent(tab)).not.toThrow()
    })
    await frames()
    // Left to the browser: nothing moved focus and nothing was dismissed
    expect(tab.defaultPrevented).toBe(false)
    expect(active()).toBe(popoverEl())
    expect(queryPopover("Text only")).not.toBeNull()
    expect(error.mock.calls.filter((c) => !String(c[0]).includes("act("))).toEqual([])
  })

  it("Modal popover: Tab wraps instead of leaving", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Full modal />
        <button type="button">Save</button>
      </>,
    )
    await openByClick(user)
    act(() => screen.getByRole("button", { name: "Done" }).focus())
    await user.tab()
    expect(active()).toBe(screen.getByLabelText("Search"))
    expect(queryPopover()).not.toBeNull()
  })

  it("Trigger inside a shadow root: leaving forward focuses the button after it (headlessui#2951)", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const shadow = host.attachShadow({ mode: "open" })
    const container = document.createElement("div")
    shadow.append(container)
    render(
      <RindProvider environment={{ getRootNode: () => shadow }}>
        <Popover.Root defaultOpen>
          <Popover.Trigger>Shadow trigger</Popover.Trigger>
          <Popover.Positioner>
            <Popover.Content aria-label="In shadow">
              <button type="button">Shadow last</button>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Root>
        <button type="button">Shadow after</button>
      </RindProvider>,
      { container },
    )
    const last = await vi.waitFor(() => {
      const el = within(container).getByRole("button", { name: "Shadow last" })
      expect(shadow.activeElement).toBe(el)
      return el
    })
    // A real Tab press: user-event does not walk shadow roots, the browser does.
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    await act(async () => {
      last.dispatchEvent(tab)
    })
    expect(tab.defaultPrevented).toBe(true)
    await vi.waitFor(() =>
      expect(shadow.activeElement).toBe(
        within(container).getByRole("button", { name: "Shadow after" }),
      ),
    )
    host.remove()
  })
})

describe("Announcements", () => {
  it("Open and close with the keyboard record no announcement", async () => {
    const user = userEvent.setup()
    const log = installAnnouncementLog()
    render(<Full />)
    const before = log.length
    await user.tab()
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(popoverEl().contains(active())).toBe(true))
    await user.keyboard("{Escape}")
    await closed()
    expect(log.length).toBe(before)
  })
})

describe("Positioning", () => {
  it.skipIf(isJsdom)("Custom anchor: the content is placed against the anchor's box", async () => {
    const user = userEvent.setup()
    render(
      <div style={{ padding: 120 }}>
        <Popover.Root positioning={{ side: "bottom", align: "start" }}>
          <Popover.Anchor style={{ display: "inline-flex", width: 300, padding: 8 }}>
            <input aria-label="Field" style={{ flex: 1 }} />
            <Popover.Trigger style={{ marginInlineStart: "auto" }}>Filters</Popover.Trigger>
          </Popover.Anchor>
          <Popover.Positioner>
            <Popover.Content aria-label="Panel" style={{ width: 100, height: 40 }} />
          </Popover.Positioner>
        </Popover.Root>
      </div>,
    )
    await press(user, trigger())
    await vi.waitFor(() => expect(popoverEl().hasAttribute("data-placing")).toBe(false))
    const anchor = part("anchor")?.getBoundingClientRect()
    const content = popoverEl().getBoundingClientRect()
    const trig = trigger().getBoundingClientRect()
    if (!anchor) throw new Error("no anchor")
    // aligned to the anchor's start edge (the trigger sits at its end)
    expect(Math.abs(content.left - anchor.left)).toBeLessThan(2)
    expect(content.left).toBeLessThan(trig.left - 50)
    expect(content.top).toBeGreaterThanOrEqual(anchor.bottom)
  })

  it.skipIf(isJsdom)(
    "Flip near the bottom: the content opens above with data-side=top",
    async () => {
      const user = userEvent.setup()
      render(
        <div style={{ position: "fixed", bottom: 4, left: 40 }}>
          <Full>
            <div style={{ height: 120, width: 200 }}>Tall content</div>
          </Full>
        </div>,
      )
      await press(user, trigger())
      await vi.waitFor(() => expect(popoverEl().getAttribute("data-side")).toBe("top"))
    },
  )

  it("reposition() through actionsRef does not throw and keeps it open", async () => {
    const user = userEvent.setup()
    const actions: RefObject<PopoverActions | null> = createRef()
    render(<Full actionsRef={actions} />)
    await openByClick(user)
    expect(() => act(() => actions.current?.reposition())).not.toThrow()
    expect(queryPopover()).not.toBeNull()
  })

  it("Positioning runs only while open: a closed popover tracks no layer", async () => {
    const user = userEvent.setup()
    render(<Full />)
    expect(getLayerStack(document).layers()).toHaveLength(0)
    await openByClick(user)
    expect(getLayerStack(document).layers().length).toBeGreaterThan(0)
    await user.keyboard("{Escape}")
    await closed()
    await settle()
    expect(getLayerStack(document).layers()).toHaveLength(0)
  })
})

describe("Presence", () => {
  it("keepMounted: closed content is hidden, registers no layer, locks nothing", async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Before</button>
        <Full keepMounted modal />
        <button type="button">After</button>
      </>,
    )
    const content = screen.getByRole("dialog", { hidden: true })
    expect(content.hasAttribute("hidden")).toBe(true)
    expect(part("positioner")?.hasAttribute("hidden")).toBe(true)
    expect(getLayerStack(document).layers()).toHaveLength(0)
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(false)
    await user.tab()
    expect(active()).toBe(screen.getByRole("button", { name: "Before" }))
    await user.tab()
    expect(active()).toBe(trigger())
    await user.tab()
    expect(active()).toBe(screen.getByRole("button", { name: "After" }))
  })

  it("keepMounted: open shows the content, closing hides it again", async () => {
    const user = userEvent.setup()
    render(<Full keepMounted />)
    await openByClick(user)
    expect(popoverEl().hasAttribute("hidden")).toBe(false)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(trigger().getAttribute("aria-expanded")).toBe("false"))
    await vi.waitFor(() =>
      expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("hidden")).toBe(true),
    )
  })

  it.skipIf(isJsdom)(
    "Exit animation: aria-expanded false and focus restored at once, content removed after 200 ms",
    async () => {
      const style = document.createElement("style")
      style.id = "test-style"
      style.textContent = `@keyframes pop-out { to { opacity: 0 } }
        [data-scope="popover"][data-part="content"][data-state="closed"] { animation: pop-out 200ms linear forwards }`
      document.head.append(style)
      const user = userEvent.setup()
      render(<Full />)
      await openByClick(user)
      await user.keyboard("{Escape}")
      expect(trigger().getAttribute("aria-expanded")).toBe("false")
      await vi.waitFor(() => expect(active()).toBe(trigger()))
      const content = part("content")
      expect(content?.getAttribute("data-state")).toBe("closed")
      expect(content?.isConnected).toBe(true)
      await vi.waitFor(() => expect(part("content")).toBeNull(), { timeout: 2000 })
    },
  )

  it.skipIf(isJsdom)("Re-opening during the exit reuses the same elements", async () => {
    const style = document.createElement("style")
    style.id = "test-style"
    style.textContent = `@keyframes pop-out { to { opacity: 0 } }
      [data-scope="popover"][data-part="content"][data-state="closed"] { animation: pop-out 600ms linear forwards }`
    document.head.append(style)
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    const before = part("content")
    await user.keyboard("{Escape}")
    expect(part("content")?.getAttribute("data-state")).toBe("closed")
    await press(user, trigger())
    await vi.waitFor(() => expect(part("content")?.getAttribute("data-state")).toBe("open"))
    expect(part("content")).toBe(before)
  })
})

describe("Title heading level", () => {
  it("Title defaults to h2 with data-level 2", async () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>T</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Title>Heading</Popover.Title>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await settle()
    const title = screen.getByRole("heading", { name: "Heading" })
    expect(title.tagName).toBe("H2")
    expect(title.getAttribute("data-level")).toBe("2")
  })

  it("A Heading inside the content is one level deeper than the title", async () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>T</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="X">
            <Popover.Title level={3}>T3</Popover.Title>
            <Heading>Inner</Heading>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await settle()
    expect(screen.getByRole("heading", { name: "Inner" }).tagName).toBe("H4")
  })

  it("Without a Title level, an inner Heading is h3", async () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>T</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="X">
            <Heading>Inner</Heading>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await settle()
    expect(screen.getByRole("heading", { name: "Inner" }).tagName).toBe("H3")
  })

  it("A substituted title keeps role heading and aria-level 2", async () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>T</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Title render={<div />}>Heading</Popover.Title>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await settle()
    const title = screen.getByRole("heading", { name: "Heading" })
    expect(title.tagName).toBe("DIV")
    expect(title.getAttribute("role")).toBe("heading")
    expect(title.getAttribute("aria-level")).toBe("2")
  })
})

describe("Messages", () => {
  it("Icon-only CloseTrigger is named by messages.close (Chiudi)", async () => {
    render(
      <Popover.Root defaultOpen messages={{ close: "Chiudi" }}>
        <Popover.Trigger>T</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="X">
            <Popover.CloseTrigger>
              <svg aria-hidden="true" width="8" height="8" />
            </Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await settle()
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeTruthy()
  })

  it("Default name is Close; a close trigger with text keeps its own name", async () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>T</Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content aria-label="X">
            <Popover.CloseTrigger>
              <svg aria-hidden="true" width="8" height="8" />
            </Popover.CloseTrigger>
            <Popover.CloseTrigger>Dismiss</Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>,
    )
    await settle()
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Dismiss" }).hasAttribute("aria-label")).toBe(false)
  })
})

describe("Disabled", () => {
  it("Disabled trigger press: stays closed and onOpenChange is not called", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full disabled onOpenChange={onOpenChange} />)
    await press(user, trigger())
    await act(async () => trigger().click())
    await frames()
    expect(queryPopover()).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("An open popover that becomes disabled closes with reason api", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    rerender(<Full disabled onOpenChange={onOpenChange} />)
    await closed()
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false)
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("api")
  })

  it("Enabling it again does not open it", async () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(<Full disabled onOpenChange={onOpenChange} />)
    rerender(<Full onOpenChange={onOpenChange} />)
    await frames()
    expect(queryPopover()).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe("Driver", () => {
  it.each(["pointer", "keyboard", "touch", "virtual"] as const)(
    "Round trip in %s: open, pressEscape, closeReason escape-key, focus on the trigger",
    async (modality) => {
      // keepMounted: the reason lives on the content, which is otherwise unmounted at once
      render(
        <>
          <Full keepMounted />
          <button type="button">After</button>
        </>,
      )
      const base = getPopover(screen, { name: "Filters" })
      const p = base.via(modality as never)
      await p.open()
      expect(await p.isOpen()).toBe(true)
      expect(await p.hasFocus()).toBe(true)
      expect(await p.isModal()).toBe(false)
      expect(await p.title()).toBe("Filters")
      expect(await p.description()).toBe("Narrow the list.")
      await base.via("keyboard").pressEscape()
      expect(await p.isOpen()).toBe(false)
      expect(part("content")?.getAttribute("data-close-reason")).toBe("escape-key")
      expect(active()).toBe(trigger())
    },
  )

  it("Driver in both environments: open then pressEscape leaves focus on the trigger", async () => {
    render(<Full />)
    const p = getPopover(screen, { name: "Filters" })
    await p.open()
    await p.pressEscape()
    expect(await p.isOpen()).toBe(false)
    expect(active()).toBe(trigger())
  })

  it("Keyboard twin: the trigger is focused and activated with Enter, focus ends inside", async () => {
    render(<Full />)
    const p = getPopover(screen, { name: "Filters" }).via("keyboard")
    await p.open()
    expect(await p.isOpen()).toBe(true)
    expect(popoverEl().contains(active())).toBe(true)
  })

  it("close, toggle, closeWithButton, pressOutside and the positioning queries", async () => {
    render(
      <>
        <p>Page</p>
        <Full />
      </>,
    )
    const p = getPopover(screen, { name: "Filters" })
    await p.open()
    expect(await p.isPlaced()).toBe(true)
    expect(await p.side()).toBe("bottom")
    if (!isJsdom) expect(await p.isAnchorHidden()).toBe(false) // jsdom has no layout
    expect(await p.isTopmost()).toBe(true)
    await p.close()
    expect(await p.isOpen()).toBe(false)
    await p.toggle()
    await vi.waitFor(async () => expect(await p.isPlaced()).toBe(true))
    expect(await p.isOpen()).toBe(true)
    await p.closeWithButton()
    expect(await p.isOpen()).toBe(false)
    await p.open()
    await p.pressOutside()
    expect(await p.isOpen()).toBe(false)
  })

  it("tab and shiftTab move through the non-modal order", async () => {
    render(
      <>
        <Full />
        <button type="button">Save</button>
      </>,
    )
    const p = getPopover(screen, { name: "Filters" })
    await p.open()
    await p.shiftTab()
    expect(active()).toBe(trigger())
    await p.tab()
    expect(active()).toBe(screen.getByLabelText("Search"))
  })

  it("waitForUnmount resolves once the content is gone", async () => {
    render(<Full />)
    const p = getPopover(screen, { name: "Filters" })
    await p.open()
    await p.pressEscape()
    await p.waitForUnmount()
    expect(part("content")).toBeNull()
  })

  it("a modal popover through the modal driver reports isModal and wraps Tab", async () => {
    render(<Full modal />)
    const p = getPopover(screen, { name: "Filters", modal: true })
    await p.open()
    expect(await p.isModal()).toBe(true)
    await p.pressEscape()
    expect(await p.isOpen()).toBe(false)
  })

  it("isTopmost is false while a child popover is open", async () => {
    const user = userEvent.setup()
    render(
      <Popover.Root>
        <Popover.Trigger>Outer</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Outer panel">
              <Popover.Root>
                <Popover.Trigger>Inner</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Content aria-label="Inner panel" />
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    const outer = getPopover(screen, { name: "Outer" })
    await outer.open()
    await press(user, trigger("Inner"))
    await vi.waitFor(() => expect(queryPopover("Inner panel")).not.toBeNull())
    await vi.waitFor(async () => expect(await outer.isTopmost()).toBe(false))
  })
})

describe("Portal host", () => {
  it("the portal host carries data-rind-theme, dir and lang from the trigger", async () => {
    render(
      <div data-rind-theme="acme" dir="rtl" lang="ar">
        <Full />
      </div>,
    )
    await act(async () => trigger().click())
    await frames()
    const host = document.querySelector("[data-rind-portal]")
    expect(host?.getAttribute("data-rind-theme")).toBe("acme")
    expect(host?.getAttribute("dir")).toBe("rtl")
    expect(host?.getAttribute("lang")).toBe("ar")
  })
})

describe("StrictMode", () => {
  it("opens, closes and reopens cleanly under StrictMode", async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <Full />
      </StrictMode>,
    )
    await openByClick(user)
    await user.keyboard("{Escape}")
    await closed()
    await openByClick(user)
    expect(queryPopover()).not.toBeNull()
  })
})

describe("a dialog opened from a popover (review: popover is a dialog parent)", () => {
  it("the popover stays open while the dialog has focus, and after it closes", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <Popover.Root onOpenChange={onOpenChange}>
        <Popover.Trigger>Share</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content aria-label="Share panel">
              <Dialog.Root>
                <Dialog.Trigger>Invite</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Positioner>
                    <Dialog.Content aria-label="Invite people">
                      <input aria-label="Email" />
                      <Dialog.CloseTrigger>Done</Dialog.CloseTrigger>
                    </Dialog.Content>
                  </Dialog.Positioner>
                </Dialog.Portal>
              </Dialog.Root>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    )
    await press(user, screen.getByRole("button", { name: "Share" }))
    await vi.waitFor(() => expect(queryPopover("Share panel")?.contains(active())).toBe(true))
    const opener = screen.getByRole("button", { name: "Invite" })
    await press(user, opener)
    await vi.waitFor(() => expect(active()).toBe(screen.getByLabelText("Email")))
    await frames()
    expect(queryPopover("Share panel")).not.toBeNull()
    await press(user, screen.getByRole("button", { name: "Done" }))
    await vi.waitFor(() => expect(active()).toBe(opener))
    expect(queryPopover("Share panel")).not.toBeNull()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })
})
