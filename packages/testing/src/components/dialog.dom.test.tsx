// Dialog scenarios (add-dialog tasks 3.3, 4.2, 5.1, 5.3): every implementable spec scenario
// and cited regression, in jsdom and in real browsers.
//
// Not covered here (the capability does not exist yet or the check is not DOM-observable):
// "Alert dialog inside a dialog" (no Alert Dialog), "Dialog opened from a popover inside a
// dialog" is covered with the layer fixture's "menu" kind; "Double click on close during
// exit" needs a real 400 ms animation (browser CSS), "Same test in Playwright" lives in
// the .pw tests, "Consumer wrapper drops the title wiring" in the model tests.
import { getLayerStack, layerId } from "@rind-ui/core"
import {
  Dialog,
  type DialogActions,
  type DialogRootProps,
  Heading,
  LayerProvider,
} from "@rind-ui/react"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, type ReactNode, type RefObject, StrictMode, useState } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { layerIdOf } from "../../fixtures/layer/layer.machine"
import { Layer } from "../../fixtures/layer/layer.react"
import { getDialog, installAnnouncementLog } from "../index"

const isJsdom = navigator.userAgent.includes("jsdom")

afterEach(() => vi.restoreAllMocks())

const inert = (el: Element | null) => el?.closest("[inert]") != null
const settle = () => act(async () => {})
const frames = (ms = 80) => act(() => new Promise<void>((r) => setTimeout(r, ms)))
const active = () => document.activeElement

interface FullProps extends Partial<DialogRootProps> {
  readonly title?: string | null
  readonly description?: string | null
  readonly inline?: boolean
  readonly noBackdrop?: boolean
  readonly label?: string
  readonly children?: ReactNode
}

/** Trigger plus a backdrop/positioner/content with a title, a field and a close trigger. */
function Full({
  title = "Edit profile",
  description = "Change your display name.",
  inline = false,
  noBackdrop = false,
  label = "Edit profile",
  children,
  ...root
}: FullProps) {
  const body = (
    <>
      {noBackdrop ? null : <Dialog.Backdrop />}
      <Dialog.Positioner style={{ position: "fixed", inset: 0 }}>
        <Dialog.Content>
          {title === null ? null : <Dialog.Title>{title}</Dialog.Title>}
          {description === null ? null : <Dialog.Description>{description}</Dialog.Description>}
          {children ?? (
            <label>
              Name <input />
            </label>
          )}
          <Dialog.CloseTrigger>Cancel</Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </>
  )
  return (
    <Dialog.Root {...root}>
      <Dialog.Trigger>{label}</Dialog.Trigger>
      {inline ? body : <Dialog.Portal>{body}</Dialog.Portal>}
    </Dialog.Root>
  )
}

/**
 * A click with the element's real coordinates: the press hit test (core/dom/press) needs
 * them in a browser, where user-event's default pointer sits at 0,0.
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

const trigger = (name = "Edit profile") => screen.getByRole("button", { name })
const dialogEl = (name?: string) =>
  name ? screen.getByRole("dialog", { name }) : screen.getByRole("dialog")
const queryDialog = () => screen.queryByRole("dialog")
const part = (name: string) => document.querySelector<HTMLElement>(`[data-part="${name}"]`)

/** Opens through the trigger and waits for focus to move in. */
async function openByClick(user: ReturnType<typeof userEvent.setup>, name = "Edit profile") {
  await press(user, trigger(name))
  await vi.waitFor(() => expect(queryDialog()?.contains(active())).toBe(true))
  await settle()
}

describe("Anatomy", () => {
  it("Minimal dialog: root and content with aria-label, opened programmatically", async () => {
    const actions: RefObject<DialogActions | null> = createRef()
    render(
      <Dialog.Root actionsRef={actions}>
        <Dialog.Content aria-label="Settings">
          <p>Body</p>
        </Dialog.Content>
      </Dialog.Root>,
    )
    expect(queryDialog()).toBeNull()
    act(() => actions.current?.open())
    await settle()
    const dialog = dialogEl("Settings")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    await vi.waitFor(() => expect(dialog.contains(active())).toBe(true))
  })

  it("Ark-shaped markup: opens, traps focus, closes on Escape and on a backdrop press", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Full />
        <button type="button">After</button>
      </>,
    )
    await openByClick(user)
    expect(dialogEl().contains(active())).toBe(true)
    await user.tab()
    await user.tab()
    await user.tab()
    expect(dialogEl().contains(active())).toBe(true)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(active()).toBe(trigger())
    await openByClick(user)
    const backdrop = part("backdrop")
    if (!backdrop) throw new Error("no backdrop")
    await press(user, backdrop)
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(active()).toBe(trigger())
  })
})

describe("Open state and reasons", () => {
  it("Escape on a controlled dialog whose parent refuses", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full open onOpenChange={onOpenChange} />)
    // The initial focus lands in a frame: read "before" only once it is inside (CI timing).
    await vi.waitFor(() => expect(queryDialog()?.contains(active())).toBe(true))
    const before = active()
    await user.keyboard("{Escape}")
    await settle()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    const [open, details] = onOpenChange.mock.calls[0] ?? []
    expect(open).toBe(false)
    expect(details.reason).toBe("ESCAPE_KEY")
    expect(queryDialog()).not.toBeNull()
    expect(active()).toBe(before)
  })

  it("Open then close in one task ends closed (zag#3324)", async () => {
    const actions: RefObject<DialogActions | null> = createRef()
    render(<Full actionsRef={actions} />)
    act(() => {
      actions.current?.open()
      actions.current?.close()
    })
    await frames()
    expect(queryDialog()).toBeNull()
  })

  it("Cancelled request: cancel() on a CLOSE_TRIGGER_PRESS keeps it open", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn((_open: boolean, details: { reason: string; cancel(): void }) => {
      if (details.reason === "CLOSE_TRIGGER_PRESS") details.cancel()
    })
    render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Cancel" }))
    await settle()
    expect(onOpenChange.mock.calls.map((c) => c[1].reason)).toContain("CLOSE_TRIGGER_PRESS")
    expect(queryDialog()).not.toBeNull()
  })
})

describe("Modal by default", () => {
  it("Page behind a modal dialog: inert, scroll locked, Tab wraps, no body pointer-events", async () => {
    const user = userEvent.setup()
    render(
      <div id="app">
        <p id="page">Page</p>
        <Full />
      </div>,
    )
    await openByClick(user)
    expect(inert(document.getElementById("app"))).toBe(true)
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(true)
    expect(document.body.style.pointerEvents).toBe("")
    const dialog = dialogEl()
    const tabbables = within(dialog)
      .getAllByRole("textbox")
      .concat(within(dialog).getAllByRole("button"))
    const first = tabbables[0]
    const last = tabbables[tabbables.length - 1]
    if (!first || !last) throw new Error("no tabbables")
    act(() => last.focus())
    await user.tab()
    expect(active()).toBe(first)
    await user.tab({ shift: true })
    expect(active()).toBe(last)
  })
})

describe("Non-modal dialogs", () => {
  it("Page stays usable: no backdrop, outside button activates, dialog stays open (zag#3401)", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <div id="app">
        <button type="button" onClick={onClick}>
          Page button
        </button>
        <Full modal={false} />
      </div>,
    )
    await openByClick(user)
    expect(part("backdrop")).toBeNull()
    expect(dialogEl().getAttribute("aria-modal")).toBeNull()
    expect(inert(document.getElementById("app"))).toBe(false)
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(false)
    await press(user, screen.getByRole("button", { name: "Page button" }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(queryDialog()).not.toBeNull()
  })

  it("Tabbing out stays open (radix#3811)", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Full modal={false} />
        <button type="button">After</button>
      </>,
    )
    await openByClick(user)
    act(() => screen.getByRole("button", { name: "Cancel" }).focus())
    await user.tab()
    await settle()
    expect(queryDialog()).not.toBeNull()
  })

  it("Trigger toggles with reason TRIGGER_PRESS, not an outside press", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full modal={false} onOpenChange={onOpenChange} />)
    await openByClick(user)
    await press(user, trigger())
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    const reasons = onOpenChange.mock.calls.map((c) => c[1].reason)
    expect(reasons).toEqual(["TRIGGER_PRESS", "TRIGGER_PRESS"])
  })
})

describe("Dismissal defaults", () => {
  it("Backdrop press closes with OUTSIDE_PRESS", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    const backdrop = part("backdrop")
    if (!backdrop) throw new Error("no backdrop")
    await press(user, backdrop)
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("OUTSIDE_PRESS")
  })

  it("Positioner press beside the content closes; inside the content it does not", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full noBackdrop onOpenChange={onOpenChange} />)
    await openByClick(user)
    await press(user, within(dialogEl()).getByText("Change your display name."))
    await settle()
    expect(queryDialog()).not.toBeNull()
    const positioner = part("positioner")
    if (!positioner) throw new Error("no positioner")
    await press(user, positioner)
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("OUTSIDE_PRESS")
  })

  it("Mounted open by the opening click stays open (ark#2744)", async () => {
    const user = userEvent.setup()
    function Host() {
      const [show, setShow] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setShow(true)}>
            Show
          </button>
          {show ? <Full open onOpenChange={() => {}} /> : null}
        </>
      )
    }
    render(<Host />)
    await press(user, screen.getByRole("button", { name: "Show" }))
    await frames()
    expect(queryDialog()).not.toBeNull()
  })

  it("Escape disabled: stays open and no layer beneath it closes", async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    render(
      <Dialog.Root onOpenChange={outer} defaultOpen>
        <Dialog.Content aria-label="Outer">
          <Dialog.Root closeOnEscape={false} defaultOpen>
            <Dialog.Content aria-label="Inner">
              <button type="button">Inside</button>
            </Dialog.Content>
          </Dialog.Root>
        </Dialog.Content>
      </Dialog.Root>,
    )
    await settle()
    await user.keyboard("{Escape}")
    await settle()
    expect(screen.getByRole("dialog", { name: "Inner" })).toBeTruthy()
    expect(screen.getByRole("dialog", { name: "Outer", hidden: true })).toBeTruthy()
    expect(outer).not.toHaveBeenCalled()
  })

  it("Text selection inside the content does not close it; a press on a field focuses it", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <Full onOpenChange={onOpenChange}>
        <p>Select this paragraph text</p>
        <input aria-label="Field" />
      </Full>,
    )
    await openByClick(user)
    const text = within(dialogEl()).getByText("Select this paragraph text")
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    text.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(false)
    text.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }))
    text.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    await settle()
    expect(queryDialog()).not.toBeNull()
    if (!isJsdom) {
      const range = document.createRange()
      range.selectNodeContents(text)
      const selection = getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      await user.pointer([
        { keys: "[MouseLeft>]", target: text },
        { target: text, offset: 6 },
        { keys: "[/MouseLeft]" },
      ])
      expect(getSelection()?.toString() ?? "").not.toBe("")
    }
    const field = within(dialogEl()).getByLabelText("Field")
    const fieldDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    field.dispatchEvent(fieldDown)
    expect(fieldDown.defaultPrevented).toBe(false)
    await press(user, field)
    expect(active()).toBe(field)
    expect(queryDialog()).not.toBeNull()
    expect(onOpenChange).toHaveBeenCalledTimes(1) // only the opening
  })
})

describe("Initial focus", () => {
  it("Form dialog: first field focused without scrolling the page", async () => {
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

  // Spec "Form dialog" (amended): the first field is focused when opened by keyboard; its
  // focus ring is the browser's :focus-visible (data-focus-visible is on dialog parts only).
  it("Form dialog: the first field is focused when opened by keyboard", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await user.tab()
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(active()?.tagName).toBe("INPUT"))
  })

  it("Long content: initialFocus title is focused with tabindex -1, removed after close", async () => {
    const user = userEvent.setup()
    render(<Full initialFocus="title" keepMounted />)
    await openByClick(user)
    const title = screen.getByRole("heading", { name: "Edit profile" })
    await vi.waitFor(() => expect(active()).toBe(title))
    expect(title.getAttribute("tabindex")).toBe("-1")
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(title.hasAttribute("tabindex")).toBe(false))
  })

  it.each(["pointer", "keyboard"] as const)(
    "React autoFocus inside wins over the first tabbable, opened by %s (radix#1615)",
    async (how) => {
      const user = userEvent.setup()
      render(
        <Full>
          <button type="button">First</button>
          {/* biome-ignore lint/a11y/noAutofocus: the scenario is React's autoFocus */}
          <input aria-label="Auto" autoFocus />
        </Full>,
      )
      if (how === "pointer") await press(user, trigger())
      else {
        await user.tab()
        await user.keyboard("{Enter}")
      }
      await vi.waitFor(() => expect(queryDialog()).not.toBeNull())
      await settle()
      expect(active()).toBe(screen.getByLabelText("Auto"))
    },
  )

  it("data-autofocus is focused on open without scrolling the page", async () => {
    const user = userEvent.setup()
    render(
      <>
        <div style={{ position: "fixed", top: 0 }}>
          <Full>
            <button type="button">First</button>
            <input aria-label="Target" data-autofocus />
          </Full>
        </div>
        <div style={{ height: 3000 }} />
      </>,
    )
    // WebKit (CI, slow) can undo a programmatic scroll on the next frame, with no dialog
    // involved; establish the precondition, scrolled and settled, before opening.
    if (!isJsdom) {
      await vi.waitFor(async () => {
        window.scrollTo(0, 500)
        await new Promise((r) => setTimeout(r, 150))
        expect(window.scrollY).toBe(500)
      })
    }
    const y = window.scrollY
    if (!isJsdom) expect(y).toBe(500)
    await openByClick(user)
    await vi.waitFor(() => expect(active()).toBe(screen.getByLabelText("Target")))
    // The scroll lock may hold the page at a different offset while open; closing restores it.
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    await vi.waitFor(() => expect(window.scrollY).toBe(y))
  })

  it("Opened by pointer: no data-focus-visible on the initial target", async () => {
    const user = userEvent.setup()
    render(<Full initialFocus="content" />)
    await openByClick(user)
    await vi.waitFor(() => expect(active()).toBe(dialogEl()))
    expect(dialogEl().hasAttribute("data-focus")).toBe(true)
    expect(dialogEl().hasAttribute("data-focus-visible")).toBe(false)
  })
})

describe("Final focus", () => {
  it("Two triggers: focus returns to the one that opened it", async () => {
    const user = userEvent.setup()
    render(
      <Dialog.Root>
        <Dialog.Trigger>Toolbar</Dialog.Trigger>
        <Dialog.Trigger>Row</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content aria-label="Shared">
              <input aria-label="Name" />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    await press(user, screen.getByRole("button", { name: "Row" }))
    await vi.waitFor(() => expect(queryDialog()).not.toBeNull())
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(active()).toBe(screen.getByRole("button", { name: "Row" }))
  })

  it("Closed by a backdrop press: trigger focused, without data-focus-visible (reka-ui#2649)", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    const backdrop = part("backdrop")
    if (!backdrop) throw new Error("no backdrop")
    await press(user, backdrop)
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(active()).toBe(trigger())
    expect(trigger().hasAttribute("data-focus-visible")).toBe(false)
  })

  it("Opened programmatically: focus returns to the previously focused button (base-ui#4169)", async () => {
    const user = userEvent.setup()
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open programmatically
          </button>
          <Full open={open} onOpenChange={setOpen} />
        </>
      )
    }
    render(<Host />)
    await press(user, screen.getByRole("button", { name: "Open programmatically" }))
    await vi.waitFor(() => expect(queryDialog()).not.toBeNull())
    await settle()
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(active()).toBe(screen.getByRole("button", { name: "Open programmatically" }))
  })

  it("finalFocus as a function receives the reason; false leaves focus alone", async () => {
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
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(active()).toBe(screen.getByRole("button", { name: "Elsewhere" }))
    expect(reasons).toContain("ESCAPE_KEY")
    cleanup()

    render(<Full finalFocus={false} />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    await settle()
    expect(active()).not.toBe(trigger())
  })

  it("Opened from a menu-like layer that unmounts: focus is never left on body", async () => {
    const user = userEvent.setup()
    function Host() {
      const [menu, setMenu] = useState(false)
      const [dialog, setDialog] = useState(false)
      return (
        <>
          <Layer.Root id="m" kind="menu" modal={false} open={menu} onOpenChange={setMenu}>
            <Layer.Trigger>Actions</Layer.Trigger>
            <Layer.Portal>
              <Layer.Positioner>
                <Layer.Content>
                  <button
                    type="button"
                    onClick={() => {
                      setDialog(true)
                      setMenu(false)
                    }}
                  >
                    Rename
                  </button>
                </Layer.Content>
              </Layer.Positioner>
            </Layer.Portal>
          </Layer.Root>
          <Full open={dialog} onOpenChange={setDialog} />
        </>
      )
    }
    render(<Host />)
    await press(user, screen.getByRole("button", { name: "Actions" }))
    await press(user, await screen.findByRole("button", { name: "Rename" }))
    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit profile" })).not.toBeNull(),
    )
    await settle()
    await user.keyboard("{Escape}")
    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit profile" })).toBeNull(),
    )
    await settle()
    expect(active()).not.toBe(document.body)
  })
})

describe("Keyboard interactions", () => {
  it("Keyboard round trip", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await user.tab()
    expect(active()).toBe(trigger())
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(active()?.tagName).toBe("INPUT"))
    const input = active()
    await user.tab()
    expect(active()).toBe(screen.getByRole("button", { name: "Cancel" }))
    await user.tab()
    expect(active()).toBe(input)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(active()).toBe(trigger())
    expect(trigger().hasAttribute("data-focus-visible")).toBe(true)
  })

  it("Enter submits the form inside and does not close the dialog", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <Full>
        <form onSubmit={onSubmit}>
          <input aria-label="Name" />
          <button type="submit">Save</button>
        </form>
      </Full>,
    )
    await openByClick(user)
    await vi.waitFor(() => expect(active()?.tagName).toBe("INPUT"))
    await user.keyboard("{Enter}")
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(queryDialog()).not.toBeNull()
  })
})

describe("Roles and ARIA attributes", () => {
  it("No description: no aria-describedby (radix#3007)", async () => {
    const user = userEvent.setup()
    render(<Full description={null} />)
    await openByClick(user)
    expect(dialogEl().hasAttribute("aria-describedby")).toBe(false)
    expect(dialogEl().hasAttribute("aria-labelledby")).toBe(true)
  })

  it("Title and description name and describe the dialog (base-ui#1325)", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    expect(
      screen.getByRole("dialog", {
        name: "Edit profile",
        description: "Change your display name.",
      }),
    ).toBeTruthy()
    const t = trigger()
    expect(t.getAttribute("aria-haspopup")).toBe("dialog")
    expect(t.getAttribute("aria-expanded")).toBe("true")
    expect(t.getAttribute("aria-controls")).toBe(dialogEl().id)
    expect(part("backdrop")?.getAttribute("aria-hidden")).toBe("true")
  })

  it("Lazy-mounted title: aria-labelledby points at the rendered title on every open (ark#4182)", async () => {
    const user = userEvent.setup()
    render(<Full />)
    for (let i = 0; i < 2; i++) {
      await openByClick(user)
      const title = screen.getByRole("heading", { name: "Edit profile" })
      expect(dialogEl().getAttribute("aria-labelledby")).toBe(title.id)
      await user.keyboard("{Escape}")
      await vi.waitFor(() => expect(queryDialog()).toBeNull())
    }
  })

  it("Consumer description merged with the description part", async () => {
    const user = userEvent.setup()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content aria-label="X" aria-describedby="hint">
          <p id="hint">Hint</p>
          <Dialog.Description>Desc</Dialog.Description>
        </Dialog.Content>
      </Dialog.Root>,
    )
    await settle()
    void user
    const ids = (dialogEl().getAttribute("aria-describedby") ?? "").split(" ")
    expect(ids[0]).toBe("hint")
    expect(ids).toContain(screen.getByText("Desc").id)
    expect(ids).toHaveLength(2)
  })

  it("Trigger inside a form does not submit it", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Full />
      </form>,
    )
    await openByClick(user)
    expect(trigger().getAttribute("type")).toBe("button")
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("Accessible name", () => {
  const nameWarnings = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter((c) => String(c[0]).includes("no accessible name"))

  it("Wrapper without a title: one warning, nothing thrown (radix#2986)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Full title={null} description={null} />)
    await openByClick(user)
    await frames(150)
    expect(nameWarnings(warn)).toHaveLength(1)
  })

  it("A title (or an aria-label) means no warning; a missing description neither (radix#3855)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Full description={null} />)
    await openByClick(user)
    await frames(150)
    expect(nameWarnings(warn)).toHaveLength(0)
    cleanup()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content aria-label="Named" />
      </Dialog.Root>,
    )
    await frames(150)
    expect(nameWarnings(warn)).toHaveLength(0)
  })

  it("Shadow root: named by the title, no warning (radix#3484)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const host = document.createElement("div")
    document.body.append(host)
    const shadow = host.attachShadow({ mode: "open" })
    const container = document.createElement("div")
    shadow.append(container)
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content>
          <Dialog.Title>In shadow</Dialog.Title>
        </Dialog.Content>
      </Dialog.Root>,
      { container },
    )
    await frames(150)
    const content = shadow.querySelector<HTMLElement>('[role="dialog"]')
    const title = shadow.querySelector<HTMLElement>('[data-part="title"]')
    expect(content?.getAttribute("aria-labelledby")).toBe(title?.id)
    expect(nameWarnings(warn)).toHaveLength(0)
    host.remove()
  })
})

describe("Close trigger name", () => {
  it("Icon-only close button is named by messages.close", async () => {
    render(
      <Dialog.Root defaultOpen messages={{ close: "Chiudi" }}>
        <Dialog.Content aria-label="X">
          <Dialog.CloseTrigger>
            <svg aria-hidden="true" width="8" height="8" />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Root>,
    )
    await settle()
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeTruthy()
  })

  it("A close trigger with text is named by its text", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("aria-label")).toBe(false)
  })
})

describe("Announcements", () => {
  it("Opening and closing record no announcement", async () => {
    const user = userEvent.setup()
    const log = installAnnouncementLog()
    render(<Full />)
    const before = log.length
    await openByClick(user)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(log.length).toBe(before)
  })
})

function Nested({
  childProps,
  parentActions,
}: {
  childProps?: Partial<DialogRootProps>
  parentActions?: RefObject<DialogActions | null>
}) {
  return (
    <Dialog.Root defaultOpen {...(parentActions ? { actionsRef: parentActions } : {})}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content aria-label="Parent">
            <Dialog.Root {...childProps}>
              <Dialog.Trigger>Open nested</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                  <Dialog.Content aria-label="Child">
                    <Dialog.CloseTrigger>Close child</Dialog.CloseTrigger>
                  </Dialog.Content>
                </Dialog.Positioner>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const named = (name: string) => screen.queryByRole("dialog", { name, hidden: true })

describe("Parent layer and nested dialogs", () => {
  it("Escape closes only the child; focus returns to Open nested", async () => {
    const user = userEvent.setup()
    render(<Nested />)
    await settle()
    await press(user, screen.getByRole("button", { name: "Open nested" }))
    await vi.waitFor(() => expect(named("Child")).not.toBeNull())
    await settle()
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(named("Child")).toBeNull())
    expect(named("Parent")).not.toBeNull()
    await vi.waitFor(() =>
      expect(active()).toBe(screen.getByRole("button", { name: "Open nested", hidden: true })),
    )
  })

  it("A child backdrop press closes only the child", async () => {
    const user = userEvent.setup()
    render(<Nested />)
    await settle()
    await press(user, screen.getByRole("button", { name: "Open nested" }))
    await vi.waitFor(() => expect(named("Child")).not.toBeNull())
    const backdrops = document.querySelectorAll<HTMLElement>('[data-part="backdrop"]')
    const childBackdrop = backdrops[backdrops.length - 1]
    if (!childBackdrop) throw new Error("no backdrop")
    await press(user, childBackdrop)
    await vi.waitFor(() => expect(named("Child")).toBeNull())
    expect(named("Parent")).not.toBeNull()
  })

  it.each(["mouse", "touch"] as const)(
    "Nested close button by %s leaves the parent open, focus on Open nested (radix#1858)",
    async (how) => {
      const user = userEvent.setup()
      render(<Nested />)
      await settle()
      await press(user, screen.getByRole("button", { name: "Open nested" }))
      await vi.waitFor(() => expect(named("Child")).not.toBeNull())
      await settle()
      const close = screen.getByRole("button", { name: "Close child" })
      await press(user, close, how === "mouse" ? "mouse" : "touch")
      await vi.waitFor(() => expect(named("Child")).toBeNull())
      expect(named("Parent")).not.toBeNull()
      await vi.waitFor(() =>
        expect(active()).toBe(screen.getByRole("button", { name: "Open nested", hidden: true })),
      )
    },
  )

  it("Closing the parent closes the child first with PARENT_DISMISSED", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const parent: RefObject<DialogActions | null> = createRef()
    render(<Nested childProps={{ onOpenChange }} parentActions={parent} />)
    await settle()
    await press(user, screen.getByRole("button", { name: "Open nested" }))
    await vi.waitFor(() => expect(named("Child")).not.toBeNull())
    await settle()
    onOpenChange.mockClear()
    act(() => parent.current?.close())
    await vi.waitFor(() => expect(named("Child")).toBeNull())
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("PARENT_DISMISSED")
  })

  it("Stacking metadata: data-has-nested, data-nested and --layer-index", async () => {
    const user = userEvent.setup()
    render(<Nested />)
    await settle()
    await press(user, screen.getByRole("button", { name: "Open nested" }))
    await vi.waitFor(() => expect(named("Child")).not.toBeNull())
    await settle()
    const parent = named("Parent")
    const child = named("Child")
    if (!parent || !child) throw new Error("missing")
    await vi.waitFor(() => expect(parent.hasAttribute("data-has-nested")).toBe(true))
    expect(parent.hasAttribute("data-nested")).toBe(false)
    expect(parent.style.getPropertyValue("--nested-layer-count")).toBe("1")
    expect(child.hasAttribute("data-nested")).toBe(true)
    const index = (el: HTMLElement) => Number(el.style.getPropertyValue("--layer-index"))
    expect(index(child)).toBe(index(parent) + 1)
  })

  it("Dialog opened from a drawer: child layer, Escape closes only it, PARENT_DISMISSED, separate families", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const stack = getLayerStack(document)
    const drawerContent = document.createElement("div")
    drawerContent.setAttribute("data-testid", "drawer")
    document.body.append(drawerContent)
    const drawer = stack.push({
      id: layerId("drawer-1"),
      kind: "drawer",
      family: "drawer",
      modal: false,
      elements: () => [drawerContent],
    })
    render(
      <LayerProvider layer={layerId("drawer-1")} kind="drawer">
        <Full onOpenChange={onOpenChange} />
      </LayerProvider>,
    )
    await openByClick(user)
    expect(stack.get(layerId("drawer-1"))?.meta().hasNested).toBe(false)
    expect(dialogEl().hasAttribute("data-nested")).toBe(false)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(stack.get(layerId("drawer-1"))).toBeDefined()
    await openByClick(user)
    onOpenChange.mockClear()
    act(() => drawer.release())
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("PARENT_DISMISSED")
    drawerContent.remove()
  })

  it("Dialog rendered under a menu-like layer survives it closing; nothing left over (radix#1836)", async () => {
    const user = userEvent.setup()
    const actions: RefObject<DialogActions | null> = createRef()
    function Host() {
      const [menu, setMenu] = useState(true)
      return (
        <div id="app">
          <button type="button" onClick={() => setMenu(false)}>
            Close menu
          </button>
          <Layer.Root id="m" kind="menu" modal={false} open={menu} onOpenChange={setMenu}>
            <Layer.Portal>
              <Layer.Positioner>
                <Layer.Content>
                  <p>Menu</p>
                </Layer.Content>
              </Layer.Positioner>
            </Layer.Portal>
          </Layer.Root>
          <LayerProvider layer={layerIdOf("m")} kind="menu">
            <Full actionsRef={actions} />
          </LayerProvider>
        </div>
      )
    }
    render(<Host />)
    await settle()
    act(() => actions.current?.open())
    await vi.waitFor(() => expect(named("Edit profile")).not.toBeNull())
    await settle()
    // The menu closes under the dialog (programmatically: the dialog is on top).
    act(() => getLayerStack(document).get(layerIdOf("m"))?.release())
    await settle()
    expect(named("Edit profile")).not.toBeNull()
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(named("Edit profile")).toBeNull())
    await settle()
    expect(inert(document.getElementById("app"))).toBe(false)
    expect(document.body.style.pointerEvents).toBe("")
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(false)
  })

  it("Dialog B opened from a popover inside dialog A: closing B leaves A open (zag#2933)", async () => {
    const user = userEvent.setup()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content aria-label="A">
          <Layer.Root id="pop" kind="menu" modal={false} defaultOpen>
            <Layer.Portal>
              <Layer.Positioner>
                <Layer.Content>
                  <LayerProvider layer={layerIdOf("pop")} kind="menu">
                    <Dialog.Root defaultOpen>
                      <Dialog.Portal>
                        <Dialog.Positioner>
                          <Dialog.Content aria-label="B">
                            <Dialog.CloseTrigger>Close B</Dialog.CloseTrigger>
                          </Dialog.Content>
                        </Dialog.Positioner>
                      </Dialog.Portal>
                    </Dialog.Root>
                  </LayerProvider>
                </Layer.Content>
              </Layer.Positioner>
            </Layer.Portal>
          </Layer.Root>
        </Dialog.Content>
      </Dialog.Root>,
    )
    await settle()
    await vi.waitFor(() => expect(named("B")).not.toBeNull())
    await press(user, screen.getByRole("button", { name: "Close B" }))
    await vi.waitFor(() => expect(named("B")).toBeNull())
    expect(named("A")).not.toBeNull()
  })
})

describe("Forms inside dialogs", () => {
  it("Close trigger as submit button runs the submit handler and closes with CLOSE_TRIGGER_PRESS (radix#1109)", async () => {
    const user = userEvent.setup()
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const connected: boolean[] = []
    const onOpenChange = vi.fn()
    render(
      <Full onOpenChange={onOpenChange}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            connected.push(e.currentTarget.isConnected)
          }}
        >
          <input aria-label="Name" />
          <Dialog.CloseTrigger type="submit">Save</Dialog.CloseTrigger>
        </form>
      </Full>,
    )
    await openByClick(user)
    await press(user, screen.getByRole("button", { name: "Save" }))
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    expect(connected).toEqual([true])
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("CLOSE_TRIGGER_PRESS")
    const logged = [...error.mock.calls, ...warn.mock.calls].map((c) => String(c[0]))
    expect(logged.filter((m) => m.includes("not connected"))).toEqual([])
  })
})

describe("Mounting", () => {
  it("Keep mounted while closed: hidden content, page not locked, Tab reaches the page (radix#998)", async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Before</button>
        <Full keepMounted />
        <button type="button">After</button>
      </>,
    )
    const content = screen.getByRole("dialog", { hidden: true })
    expect(content.hasAttribute("hidden")).toBe(true)
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(false)
    await user.tab()
    expect(active()).toBe(screen.getByRole("button", { name: "Before" }))
    await user.tab()
    expect(active()).toBe(trigger())
    await user.tab()
    expect(active()).toBe(screen.getByRole("button", { name: "After" }))
  })

  it("Exit animation by reason: closed content keeps data-close-reason (kebab case)", async () => {
    const user = userEvent.setup()
    render(<Full keepMounted />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryDialog()).toBeNull())
    const content = screen.getByRole("dialog", { hidden: true })
    expect(content.getAttribute("data-state")).toBe("closed")
    expect(content.getAttribute("data-close-reason")).toBe("escape-key")
    expect(trigger().getAttribute("data-close-reason")).toBe("escape-key")
  })
})

describe("Server rendering", () => {
  it("Default open, inline: hydrates silently, then the page is inert and focus is inside", async () => {
    const tree = (
      <StrictMode>
        <Dialog.Root defaultOpen id="ssr">
          <Dialog.Trigger>Edit</Dialog.Trigger>
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Edit profile</Dialog.Title>
              <input aria-label="Name" />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </StrictMode>
    )
    const html = renderToString(tree)
    expect(html).toContain('data-state="open"')
    expect(html).toContain('role="dialog"')
    const page = document.createElement("div")
    page.textContent = "Page"
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(page, container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    await frames(150)
    expect(container.contains(active())).toBe(true)
    expect(error.mock.calls.filter((c) => !String(c[0]).includes("not wrapped in act"))).toEqual([])
    expect(inert(page)).toBe(true)
    await act(async () => root?.unmount())
    container.remove()
    page.remove()
  })
})

describe("Title heading level", () => {
  it("Title defaults to h2 with data-level 2", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content>
          <Dialog.Title>T</Dialog.Title>
        </Dialog.Content>
      </Dialog.Root>,
    )
    await settle()
    const title = screen.getByRole("heading", { name: "T" })
    expect(title.tagName).toBe("H2")
    expect(title.getAttribute("data-level")).toBe("2")
  })

  it("A Heading inside the content is one level deeper than the title", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content aria-label="X">
          <Dialog.Title level={3}>T</Dialog.Title>
          <Heading>Inner</Heading>
        </Dialog.Content>
      </Dialog.Root>,
    )
    await settle()
    expect(screen.getByRole("heading", { name: "Inner" }).tagName).toBe("H4")
  })

  it("A substituted title keeps role heading and aria-level 2", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content>
          <Dialog.Title render={<div />}>T</Dialog.Title>
        </Dialog.Content>
      </Dialog.Root>,
    )
    await settle()
    const title = screen.getByRole("heading", { name: "T" })
    expect(title.tagName).toBe("DIV")
    expect(title.getAttribute("role")).toBe("heading")
    expect(title.getAttribute("aria-level")).toBe("2")
  })
})

describe("Driver", () => {
  it.each(["pointer", "keyboard", "touch", "virtual"] as const)(
    "Round trip in %s: open, pressEscape, closeReason escape-key",
    async (modality) => {
      render(<Full />)
      const base = getDialog(screen, { name: "Edit profile" })
      const d = base.via(modality as never)
      await d.open()
      expect(await d.isOpen()).toBe(true)
      expect(await d.hasFocus()).toBe(true)
      // Escape is a keyboard action in every modality.
      await base.via("keyboard").pressEscape()
      expect(await d.isOpen()).toBe(false)
      expect(await d.closeReason()).toBe("escape-key")
    },
  )
})

describe("portal host follows the trigger's theme (site session report)", () => {
  it("the portal host carries data-rind-theme, dir and lang from the first open", async () => {
    render(
      <div data-rind-theme="acme" dir="rtl" lang="ar">
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Title>T</Dialog.Title>
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Portal>
        </Dialog.Root>
      </div>,
    )
    await act(async () => {
      screen.getByRole("button", { name: "Open" }).click()
    })
    await act(async () => new Promise((r) => setTimeout(r, 50)))
    const host = document.querySelector("[data-rind-portal]")
    expect(host?.getAttribute("data-rind-theme")).toBe("acme")
    expect(host?.getAttribute("dir")).toBe("rtl")
    expect(host?.getAttribute("lang")).toBe("ar")
  })
})
