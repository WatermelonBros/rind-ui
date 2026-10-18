// Alert Dialog scenarios (add-alert-dialog tasks 3.2, 5.1, A.1): every implementable spec
// scenario and cited regression, in jsdom and in real browsers.
//
// Not covered here: the model run lives in alert-dialog.model.dom.test.tsx, server rendering
// in alert-dialog-hydrate.dom.test.tsx, the reading order in alert-dialog.reading-order.dom.test.tsx,
// "Shared fix" (reka-ui#2702) is structural: alertDialogMachine is built by buildDialogMachine.
import {
  AlertDialog,
  type AlertDialogRootProps,
  Dialog,
  type DialogActions,
  Heading,
} from "@rind-ui/react"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, type ReactNode, type RefObject, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { allowRindWarning, getAlertDialog } from "../index"

afterEach(() => vi.restoreAllMocks())

const inert = (el: Element | null) => el?.closest("[inert]") != null
const settle = () => act(async () => {})
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
/** Drains animation frames (and the microtasks between them) instead of waiting on the clock. */
const frames = (count = 6) =>
  act(async () => {
    for (let i = 0; i < count; i++) await nextFrame()
  })
const active = () => document.activeElement

interface FullProps extends Partial<AlertDialogRootProps> {
  readonly title?: string | null
  readonly description?: string | null
  readonly cancel?: boolean
  readonly label?: string
  readonly children?: ReactNode
}

/** Trigger plus a backdrop/positioner/content with a title, a description, Cancel and Delete. */
function Full({
  title = "Delete project?",
  description = "This cannot be undone.",
  cancel = true,
  label = "Delete project?",
  children,
  ...root
}: FullProps) {
  return (
    <AlertDialog.Root {...root}>
      <AlertDialog.Trigger>{label}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop />
        <AlertDialog.Positioner style={{ position: "fixed", inset: 0 }}>
          <AlertDialog.Content>
            {title === null ? null : <AlertDialog.Title>{title}</AlertDialog.Title>}
            {description === null ? null : (
              <AlertDialog.Description>{description}</AlertDialog.Description>
            )}
            {children ?? (
              <>
                {cancel ? <AlertDialog.Cancel>Cancel</AlertDialog.Cancel> : null}
                <AlertDialog.Action>Delete</AlertDialog.Action>
              </>
            )}
          </AlertDialog.Content>
        </AlertDialog.Positioner>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

/**
 * A click with the element's real coordinates: the press hit test (core/dom/press) needs
 * them in a browser, where user-event's default pointer sits at 0,0.
 */
async function press(user: ReturnType<typeof userEvent.setup>, el: Element) {
  const r = el.getBoundingClientRect()
  const coords = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
  await user.pointer([
    { target: el, coords },
    { keys: "[MouseLeft]", target: el, coords },
  ])
}

const trigger = (name = "Delete project?") => screen.getByRole("button", { name })
const alertEl = (name?: string) =>
  name ? screen.getByRole("alertdialog", { name }) : screen.getByRole("alertdialog")
const queryAlert = () => screen.queryByRole("alertdialog")
const part = (name: string) => document.querySelector<HTMLElement>(`[data-part="${name}"]`)
const button = (name: string) => screen.getByRole("button", { name })

async function openByClick(user: ReturnType<typeof userEvent.setup>, name = "Delete project?") {
  await press(user, trigger(name))
  await vi.waitFor(() => expect(queryAlert()?.contains(active())).toBe(true))
  await settle()
}

describe("Anatomy", () => {
  it("Delete confirmation: named by the title, described, Cancel focused", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    const dialog = alertEl("Delete project?")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    const describedBy = dialog.getAttribute("aria-describedby")
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(
      "This cannot be undone.",
    )
    await vi.waitFor(() => expect(active()).toBe(button("Cancel")))
    expect(button("Cancel").getAttribute("type")).toBe("button")
    expect(button("Delete").getAttribute("type")).toBe("button")
    for (const p of ["backdrop", "positioner", "content", "title", "description", "cancel"])
      expect(part(p)?.getAttribute("data-scope"), p).toBe("alert-dialog")
  })

  it("Any number of actions", async () => {
    const user = userEvent.setup()
    render(
      <Full>
        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action>Archive</AlertDialog.Action>
        <AlertDialog.Action>Delete</AlertDialog.Action>
      </Full>,
    )
    await openByClick(user)
    expect(screen.getAllByRole("button", { name: /Archive|Delete$/ })).toHaveLength(2)
  })
})

describe("Always modal", () => {
  it("Page behind: inert, scroll locked, Tab stays inside, alertdialog with aria-modal", async () => {
    const user = userEvent.setup()
    render(
      <div id="app">
        <p id="page">Page</p>
        <Full />
      </div>,
    )
    await openByClick(user)
    const dialog = alertEl()
    expect(dialog.getAttribute("role")).toBe("alertdialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(dialog.hasAttribute("data-modal")).toBe(true)
    expect(part("positioner")?.hasAttribute("data-modal")).toBe(true)
    expect(inert(document.getElementById("app"))).toBe(true)
    expect(document.documentElement.hasAttribute("data-rind-scroll-locked")).toBe(true)
    const buttons = within(dialog).getAllByRole("button")
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (!first || !last) throw new Error("no buttons")
    act(() => last.focus())
    await user.tab()
    expect(active()).toBe(first)
    await user.tab({ shift: true })
    expect(active()).toBe(last)
  })
})

describe("Dismissal", () => {
  it("Backdrop and positioner presses stay open, call no onOpenChange, close nothing beneath (radix#1738)", async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    const inner = vi.fn()
    render(
      <Dialog.Root defaultOpen onOpenChange={outer}>
        <Dialog.Content aria-label="Edit">
          <Full onOpenChange={inner} />
        </Dialog.Content>
      </Dialog.Root>,
    )
    await settle()
    await press(user, button("Delete project?"))
    await vi.waitFor(() => expect(queryAlert()?.contains(active())).toBe(true))
    await settle()
    inner.mockClear()
    for (const name of ["backdrop", "positioner"]) {
      const surface = part(name)
      if (!surface) throw new Error(`no ${name}`)
      await press(user, surface)
      await settle()
    }
    expect(queryAlert()).not.toBeNull()
    expect(inner).not.toHaveBeenCalled()
    expect(outer).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "Edit", hidden: true })).toBeTruthy()
  })

  it("Escape closes with ESCAPE_KEY and focus returns to the trigger (base-ui#1688)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("escape-key")
    expect(active()).toBe(trigger())
  })

  it("closeOnEscape false: Escape does nothing", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full closeOnEscape={false} onOpenChange={onOpenChange} />)
    await openByClick(user)
    onOpenChange.mockClear()
    await user.keyboard("{Escape}")
    await settle()
    expect(queryAlert()).not.toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("Escape vetoed after a programmatic open without user activation (radix#2227)", async () => {
    const user = userEvent.setup()
    const actions: RefObject<DialogActions | null> = createRef()
    const onOpenChange = vi.fn()
    const onEscapeKeyDown = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <Full
        actionsRef={actions}
        onOpenChange={onOpenChange}
        onEscapeKeyDown={onEscapeKeyDown as never}
      />,
    )
    act(() => actions.current?.open())
    await vi.waitFor(() => expect(queryAlert()?.contains(active())).toBe(true))
    onOpenChange.mockClear()
    await user.keyboard("{Escape}")
    await settle()
    expect(onEscapeKeyDown).toHaveBeenCalledTimes(1)
    expect(queryAlert()).not.toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe("Cancel and action", () => {
  it("Cancel closes with CANCEL_PRESS and focus returns to the trigger", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    await press(user, button("Cancel"))
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("cancel")
    expect(active()).toBe(trigger())
  })

  it("Action closes with ACTION_PRESS", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full onOpenChange={onOpenChange} />)
    await openByClick(user)
    await press(user, button("Delete"))
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("action")
  })

  it("Async confirm: cancel(), disables itself, stays open and inert, closes through the API (radix#1747)", async () => {
    const user = userEvent.setup()
    const actions: RefObject<DialogActions | null> = createRef()
    let resolve: () => void = () => {}
    function Async() {
      const [pending, setPending] = useState(false)
      return (
        <div id="app">
          <AlertDialog.Root
            actionsRef={actions}
            onOpenChange={(open, details) => {
              if (open || details.reason !== "action") return
              details.cancel()
              setPending(true)
              new Promise<void>((r) => {
                resolve = r
              }).then(() => {
                setPending(false)
                actions.current?.close()
              })
            }}
          >
            <AlertDialog.Trigger>Delete project?</AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop />
              <AlertDialog.Positioner style={{ position: "fixed", inset: 0 }}>
                <AlertDialog.Content>
                  <AlertDialog.Title>Delete project?</AlertDialog.Title>
                  <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
                  <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                  <AlertDialog.Action disabled={pending}>
                    {pending ? "Deleting" : "Delete"}
                  </AlertDialog.Action>
                </AlertDialog.Content>
              </AlertDialog.Positioner>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      )
    }
    render(<Async />)
    await openByClick(user)
    await press(user, button("Delete"))
    await vi.waitFor(() => expect(button("Deleting").hasAttribute("disabled")).toBe(true))
    await frames()
    expect(queryAlert()).not.toBeNull()
    expect(inert(document.getElementById("app"))).toBe(true)
    expect(button("Cancel").hasAttribute("disabled")).toBe(false)
    await act(async () => resolve())
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    await vi.waitFor(() => expect(active()).toBe(trigger()))
    expect(inert(document.getElementById("app"))).toBe(false)
  })

  it("Action submits a form: submit runs with the form connected, then ACTION_PRESS closes (radix#1779)", async () => {
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
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action type="submit">Delete</AlertDialog.Action>
        </form>
      </Full>,
    )
    await openByClick(user)
    await press(user, button("Delete"))
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    expect(connected).toEqual([true])
    expect(onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("action")
    const logged = [...error.mock.calls, ...warn.mock.calls].map((c) => String(c[0]))
    expect(logged.filter((m) => m.includes("not connected"))).toEqual([])
  })

  it("Controlled cancel: the parent applies onOpenChange(false) with reason cancel (react-spectrum#8139)", async () => {
    const user = userEvent.setup()
    const reasons: string[] = []
    function Controlled() {
      const [open, setOpen] = useState(false)
      return (
        <Full
          open={open}
          onOpenChange={(next, details) => {
            reasons.push(details.reason)
            setOpen(next)
          }}
        />
      )
    }
    render(<Controlled />)
    await openByClick(user)
    await press(user, button("Cancel"))
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    expect(reasons).toEqual(["trigger", "cancel"])
  })

  it("Controlled, parent refuses: Cancel leaves it open", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<Full open onOpenChange={onOpenChange} />)
    await vi.waitFor(() => expect(queryAlert()?.contains(active())).toBe(true))
    await press(user, button("Cancel"))
    await settle()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe("cancel")
    expect(queryAlert()).not.toBeNull()
  })

  it("A disabled action does not close it", async () => {
    const user = userEvent.setup()
    render(
      <Full>
        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action disabled>Delete</AlertDialog.Action>
      </Full>,
    )
    await openByClick(user)
    await press(user, button("Delete"))
    await settle()
    expect(queryAlert()).not.toBeNull()
  })
})

describe("Initial focus", () => {
  it("Opened by keyboard: Cancel is focused with data-focus-visible (radix#1615, bits-ui#1695)", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await user.tab()
    expect(active()).toBe(trigger())
    await user.keyboard("{Enter}")
    await vi.waitFor(() => expect(active()).toBe(button("Cancel")))
    expect(button("Cancel").hasAttribute("data-focus")).toBe(true)
    expect(button("Cancel").hasAttribute("data-focus-visible")).toBe(true)
  })

  it("Opened by pointer: Cancel is focused without data-focus-visible", async () => {
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    await vi.waitFor(() => expect(active()).toBe(button("Cancel")))
    expect(button("Cancel").hasAttribute("data-focus-visible")).toBe(false)
  })

  it("Content replaced before initial focus: the new Cancel is focused (bits-ui#2136)", async () => {
    const actions: RefObject<DialogActions | null> = createRef()
    let setVersion: (v: number) => void = () => {}
    function Replaced() {
      const [version, set] = useState(0)
      setVersion = set
      return (
        <AlertDialog.Root actionsRef={actions}>
          <AlertDialog.Trigger>Delete project?</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Positioner>
              <AlertDialog.Content key={version}>
                <AlertDialog.Title>Delete project?</AlertDialog.Title>
                <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
                <AlertDialog.Cancel data-version={version}>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action>Delete</AlertDialog.Action>
              </AlertDialog.Content>
            </AlertDialog.Positioner>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      )
    }
    render(<Replaced />)
    // Open, then replace the content before the frame in which initial focus runs.
    act(() => actions.current?.open())
    act(() => setVersion(1))
    await vi.waitFor(() => expect(active()?.getAttribute("data-version")).toBe("1"))
    expect(active()).toBe(button("Cancel"))
    expect(document.querySelectorAll('[data-part="cancel"]')).toHaveLength(1)
  })

  it("No cancel part: the content is focused", async () => {
    const user = userEvent.setup()
    render(
      <Full cancel={false}>
        <AlertDialog.Action>OK</AlertDialog.Action>
      </Full>,
    )
    await openByClick(user)
    await vi.waitFor(() => expect(active()).toBe(alertEl()))
  })

  it("a function initialFocus picks the target", async () => {
    const user = userEvent.setup()
    render(
      <Full initialFocus={() => document.querySelector<HTMLElement>('[data-part="action"]')} />,
    )
    await press(user, trigger())
    await vi.waitFor(() => expect(active()).toBe(button("Delete")))
  })
})

describe("Naming and description", () => {
  const warnings = (spy: { mock: { calls: unknown[][] } }, text: string) =>
    spy.mock.calls.filter((c) => String(c[0]).includes(text))

  it("Missing description: one warning, no aria-describedby (react-spectrum#9916)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Full description={null} />)
    await openByClick(user)
    await frames()
    expect(warnings(warn, "no description")).toHaveLength(1)
    expect(warnings(warn, "no accessible name")).toHaveLength(0)
    expect(alertEl().hasAttribute("aria-describedby")).toBe(false)
  })

  it("Missing title: one warning, nothing thrown", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Full title={null} />)
    await openByClick(user)
    await frames()
    expect(warnings(warn, "no accessible name")).toHaveLength(1)
    expect(warnings(warn, "no description")).toHaveLength(0)
  })

  it("A title and a description: no warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Full />)
    await openByClick(user)
    await frames()
    expect(warn).not.toHaveBeenCalled()
  })

  it("A consumer aria-describedby counts as a description", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <>
        <p id="hint">Hint</p>
        <AlertDialog.Root defaultOpen>
          <AlertDialog.Content aria-label="Sure?" aria-describedby="hint">
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </>,
    )
    await frames()
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("Nested alert dialogs", () => {
  function Nested() {
    return (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content aria-label="Edit">
              <AlertDialog.Root>
                <AlertDialog.Trigger>Discard</AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Backdrop />
                  <AlertDialog.Positioner>
                    <AlertDialog.Content>
                      <AlertDialog.Title>Discard changes?</AlertDialog.Title>
                      <AlertDialog.Description>Edits will be lost.</AlertDialog.Description>
                      <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
                      <AlertDialog.Action>Discard</AlertDialog.Action>
                    </AlertDialog.Content>
                  </AlertDialog.Positioner>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }
  const edit = () => screen.queryByRole("dialog", { name: "Edit", hidden: true })

  it("Cancel closes only the alert; the dialog is data-has-nested until then; focus returns to its trigger (radix#1858, base-ui#1165)", async () => {
    const user = userEvent.setup()
    render(<Nested />)
    await settle()
    const opener = screen.getByRole("button", { name: "Discard" })
    await press(user, opener)
    await vi.waitFor(() => expect(queryAlert()?.contains(active())).toBe(true))
    await settle()
    await vi.waitFor(() => expect(edit()?.hasAttribute("data-has-nested")).toBe(true))
    await vi.waitFor(() => expect(active()).toBe(button("Keep editing")))
    await press(user, button("Keep editing"))
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    expect(edit()).not.toBeNull()
    expect(edit()?.hasAttribute("data-has-nested")).toBe(false)
    await vi.waitFor(() => expect(active()).toBe(screen.getByRole("button", { name: "Discard" })))
  })

  it("Escape closes only the alert", async () => {
    const user = userEvent.setup()
    render(<Nested />)
    await settle()
    await press(user, screen.getByRole("button", { name: "Discard" }))
    await vi.waitFor(() => expect(queryAlert()?.contains(active())).toBe(true))
    await settle()
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    expect(edit()).not.toBeNull()
  })

  it("A Dialog opened from an alert dialog is its child", async () => {
    const user = userEvent.setup()
    render(
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Content aria-label="Sure?" aria-describedby="x">
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <Dialog.Root>
            <Dialog.Trigger>More</Dialog.Trigger>
            <Dialog.Content aria-label="Details">
              <Dialog.CloseTrigger>Close details</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Root>
        </AlertDialog.Content>
      </AlertDialog.Root>,
    )
    await settle()
    await press(user, screen.getByRole("button", { name: "More" }))
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Details" })).not.toBeNull())
    await settle()
    expect(
      screen
        .getByRole("alertdialog", { name: "Sure?", hidden: true })
        .hasAttribute("data-has-nested"),
    ).toBe(true)
    await user.keyboard("{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Details" })).toBeNull())
    expect(screen.getByRole("alertdialog", { name: "Sure?" })).toBeTruthy()
  })
})

describe("Data attributes", () => {
  it("Close reason styling: the closing content keeps data-state closed and data-close-reason", async () => {
    const user = userEvent.setup()
    render(<Full keepMounted />)
    await openByClick(user)
    await press(user, button("Delete"))
    await vi.waitFor(() => expect(queryAlert()).toBeNull())
    const content = screen.getByRole("alertdialog", { hidden: true })
    expect(content.getAttribute("data-state")).toBe("closed")
    expect(content.getAttribute("data-close-reason")).toBe("action")
    expect(trigger().getAttribute("data-close-reason")).toBe("action")
  })
})

describe("Title heading level", () => {
  it("Title defaults to h2 with data-level 2", async () => {
    // a title-only fixture: the description check logs in some engines
    allowRindWarning(/alert-dialog: .* has no description/)
    render(
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Content>
          <AlertDialog.Title>T</AlertDialog.Title>
        </AlertDialog.Content>
      </AlertDialog.Root>,
    )
    await settle()
    const title = screen.getByRole("heading", { name: "T" })
    expect(title.tagName).toBe("H2")
    expect(title.getAttribute("data-level")).toBe("2")
  })

  it("A Heading inside the content is one level deeper than the title", async () => {
    // a title-only fixture: the description check logs in some engines
    allowRindWarning(/alert-dialog: .* has no description/)
    render(
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Content aria-label="X">
          <AlertDialog.Title level={3}>T</AlertDialog.Title>
          <Heading>Inner</Heading>
        </AlertDialog.Content>
      </AlertDialog.Root>,
    )
    await settle()
    expect(screen.getByRole("heading", { name: "Inner" }).tagName).toBe("H4")
  })

  it("A substituted title keeps role heading and aria-level 2", async () => {
    render(
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Content>
          <AlertDialog.Title render={<div />}>T</AlertDialog.Title>
        </AlertDialog.Content>
      </AlertDialog.Root>,
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
    "Round trip in %s: open, confirm Delete, closeReason action",
    async (modality) => {
      render(<Full />)
      const a = getAlertDialog(screen, { name: "Delete project?" }).via(modality as never)
      await a.open()
      expect(await a.isOpen()).toBe(true)
      expect(await a.isModal()).toBe(true)
      expect(await a.hasFocus()).toBe(true)
      await a.confirm("Delete")
      expect(await a.isOpen()).toBe(false)
      expect(await a.closeReason()).toBe("action")
    },
  )

  it.each(["pointer", "keyboard", "touch", "virtual"] as const)(
    "Cancel in %s: closeReason cancel",
    async (modality) => {
      render(<Full />)
      const a = getAlertDialog(screen, { name: "Delete project?" }).via(modality as never)
      await a.open()
      await a.cancel()
      expect(await a.isOpen()).toBe(false)
      expect(await a.closeReason()).toBe("cancel")
    },
  )

  it("pressOutside completes with the dialog still open; Escape closes it", async () => {
    render(<Full />)
    const a = getAlertDialog(screen, { name: "Delete project?" })
    await a.open()
    await a.pressOutside()
    expect(await a.isOpen()).toBe(true)
    await a.pressEscape()
    expect(await a.isOpen()).toBe(false)
    expect(await a.closeReason()).toBe("escape-key")
    cleanup()
  })

  it("confirm() with a single action needs no name", async () => {
    render(
      <Full>
        <AlertDialog.Action>OK</AlertDialog.Action>
      </Full>,
    )
    const a = getAlertDialog(screen, { name: "Delete project?" })
    await a.open()
    await a.confirm()
    expect(await a.isOpen()).toBe(false)
  })
})

describe("review fixes (add-alert-dialog r1)", () => {
  it("a disabled Cancel at open: focus goes to the content, inside the dialog", async () => {
    const actions: RefObject<DialogActions | null> = createRef()
    render(
      <AlertDialog.Root actionsRef={actions}>
        <AlertDialog.Trigger>Delete project?</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Positioner>
            <AlertDialog.Content>
              <AlertDialog.Title>Delete project?</AlertDialog.Title>
              <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
              <AlertDialog.Cancel disabled>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action>Delete</AlertDialog.Action>
            </AlertDialog.Content>
          </AlertDialog.Positioner>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    )
    act(() => actions.current?.open())
    await frames()
    const content = screen.getByRole("alertdialog")
    expect(active()).toBe(content)
  })
})
