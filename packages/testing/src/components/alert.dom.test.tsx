// Alert through its driver (add-alert 3.2, 4.2): announcements on appearance and text change
// only, nothing at dismissal, focus never on body after a dismissal from inside, the close
// button's name, the labelled icon, the region recipe and the live-role warning.
import { Alert, type AlertRootProps, Button } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getAlert } from "../index"

afterEach(() => vi.restoreAllMocks())

/** A driver created before the alert mounts, its log started (announcements are read lazily). */
async function driver(title: string) {
  const a = getAlert(screen, { title })
  expect(await a.announcements()).toEqual([])
  return a
}

function SaveError(props: AlertRootProps) {
  return (
    <Alert.Root announce="assertive" {...props}>
      <Alert.Title>Couldn't save</Alert.Title>
      <Alert.Description>Disk full</Alert.Description>
      <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
    </Alert.Root>
  )
}

describe("Alert announcements", () => {
  it("driver round trip: one assertive announcement, dismiss, focus not on body", async () => {
    const a = await driver("Couldn't save")
    render(
      <div>
        <SaveError />
        <button type="button">Retry</button>
      </div>,
    )
    expect(await a.announcements()).toEqual([
      expect.objectContaining({ message: "Couldn't save. Disk full.", priority: "assertive" }),
    ])
    expect(await a.title()).toBe("Couldn't save")
    expect(await a.description()).toBe("Disk full")
    await a.dismiss()
    expect(await a.isOpen()).toBe(false)
    expect(document.activeElement).not.toBe(document.body)
    expect(await a.announcements()).toHaveLength(1)
  })

  it("polite by default; off is silent", async () => {
    const a = await driver("Connection lost")
    const { unmount } = render(
      <Alert.Root>
        <Alert.Title>Connection lost</Alert.Title>
      </Alert.Root>,
    )
    expect(await a.announcements()).toEqual([
      expect.objectContaining({ message: "Connection lost.", priority: "polite" }),
    ])
    unmount()
    const b = await driver("This project is archived")
    render(
      <Alert.Root announce="off" data-tone="danger">
        <Alert.Title>This project is archived</Alert.Title>
      </Alert.Root>,
    )
    expect(await b.isOpen()).toBe(true)
    expect(await b.announcements()).toEqual([])
  })

  it("Strict Mode mounts announce once", async () => {
    const a = await driver("Saved")
    render(
      <StrictMode>
        <Alert.Root>
          <Alert.Title>Saved</Alert.Title>
        </Alert.Root>
      </StrictMode>,
    )
    expect(await a.announcements()).toHaveLength(1)
  })

  it("a text change while shown announces the new text (Status text updates)", async () => {
    const a = await driver("Reconnecting…")
    const { rerender } = render(
      <Alert.Root>
        <Alert.Title>Reconnecting…</Alert.Title>
      </Alert.Root>,
    )
    expect(await a.announcements()).toHaveLength(1)
    rerender(
      <Alert.Root>
        <Alert.Title>Connected</Alert.Title>
      </Alert.Root>,
    )
    const spoken = await a.announcements()
    expect(spoken.at(-1)?.message).toBe("Connected.")
  })

  it("reordered alerts without a text change announce nothing (ariakit#7235)", async () => {
    const items = ["One", "Two"]
    const List = ({ order }: { order: readonly string[] }) => (
      <div>
        {order.map((t) => (
          <Alert.Root key={t}>
            <Alert.Title>{t}</Alert.Title>
          </Alert.Root>
        ))}
      </div>
    )
    const a = await driver("One")
    const { rerender } = render(<List order={items} />)
    const before = (await a.announcements()).length
    rerender(<List order={[...items].reverse()} />)
    rerender(<List order={items} />)
    expect(await a.announcements()).toHaveLength(before)
  })

  it("shown again through open announces once", async () => {
    const a = await driver("Saved")
    const tree = (open: boolean) => (
      <Alert.Root open={open}>
        <Alert.Title>Saved</Alert.Title>
      </Alert.Root>
    )
    const { rerender } = render(tree(false))
    expect(await a.announcements()).toEqual([])
    rerender(tree(true))
    expect(await a.announcements()).toHaveLength(1)
  })

  it("the close button is not spoken; a labelled icon is", async () => {
    const a = await driver("Couldn't save")
    render(
      <Alert.Root announce="assertive">
        <Alert.Icon label="Error">!</Alert.Icon>
        <Alert.Title>Couldn't save</Alert.Title>
        <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
      </Alert.Root>,
    )
    expect((await a.announcements()).map((x) => x.message)).toEqual(["Error. Couldn't save."])
    expect(screen.getByRole("img", { name: "Error" })).toBeTruthy()
  })

  it("the consumer announcement wins and carries the locale", async () => {
    const a = await driver("3 errors")
    render(
      <Alert.Root announcement="3 errors in the form. Fix them and submit again.">
        <Alert.Title>3 errors</Alert.Title>
      </Alert.Root>,
    )
    expect((await a.announcements()).map((x) => x.message)).toEqual([
      "3 errors in the form. Fix them and submit again.",
    ])
  })
})

describe("Alert focus", () => {
  it("appearance does not steal focus", async () => {
    const Form = () => {
      const [error, setError] = useState(false)
      return (
        <div>
          <input aria-label="Name" onChange={() => setError(true)} />
          {error && (
            <Alert.Root announce="assertive">
              <Alert.Title>Invalid</Alert.Title>
            </Alert.Root>
          )}
        </div>
      )
    }
    const user = userEvent.setup()
    render(<Form />)
    const input = screen.getByRole("textbox", { name: "Name" })
    await user.type(input, "x")
    expect(await getAlert(screen, { title: "Invalid" }).isOpen()).toBe(true)
    expect(document.activeElement).toBe(input)
  })

  it("a keyboard dismiss moves focus to the next control with data-focus-visible", async () => {
    render(
      <div>
        <SaveError />
        <Button>Retry</Button>
      </div>,
    )
    const a = getAlert(screen, { title: "Couldn't save" }, { modality: "keyboard" })
    await a.dismiss()
    const retry = screen.getByRole("button", { name: "Retry" })
    expect(document.activeElement).toBe(retry)
    expect(retry.hasAttribute("data-focus-visible")).toBe(true)
  })

  it("a consumer that unmounts on close keeps focus off body", async () => {
    const onOpenChange = vi.fn()
    const Page = () => {
      const [show, setShow] = useState(true)
      return (
        <div>
          {show && (
            <SaveError
              open
              onOpenChange={(open, d) => {
                onOpenChange(open, d.reason)
                setShow(false)
              }}
            />
          )}
          <button type="button">Next</button>
        </div>
      )
    }
    render(<Page />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false, "close-trigger")
    expect(screen.queryByText("Couldn't save")).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }))
  })

  it("the previous tab stop when nothing follows; finalFocus wins; false stays", async () => {
    const first = render(
      <div>
        <button type="button">Before</button>
        <SaveError />
      </div>,
    )
    await getAlert(screen, { title: "Couldn't save" }, { modality: "keyboard" }).dismiss()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Before" }))
    first.unmount()
    let target: HTMLElement | null = null
    render(
      <div>
        <SaveError finalFocus={() => target} />
        <button type="button">Next</button>
        <button
          type="button"
          ref={(el) => {
            target = el
          }}
        >
          Chosen
        </button>
      </div>,
    )
    await getAlert(screen, { title: "Couldn't save" }, { modality: "keyboard" }).dismiss()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Chosen" }))
  })

  it("closed programmatically with focus elsewhere: focus stays", async () => {
    const tree = (open: boolean) => (
      <div>
        <input aria-label="Field" />
        <SaveError open={open} />
      </div>
    )
    const { rerender } = render(tree(true))
    const field = screen.getByRole("textbox", { name: "Field" })
    field.focus()
    rerender(tree(false))
    expect(await getAlert(screen, { title: "Couldn't save" }).isOpen()).toBe(false)
    expect(document.activeElement).toBe(field)
  })
})

describe("Alert parts", () => {
  it("no part has a role or live attribute; nothing is focusable but the trigger", () => {
    render(<SaveError />)
    const root = screen.getByText("Couldn't save").closest('[data-part="root"]') as HTMLElement
    for (const el of [root, ...root.querySelectorAll("*")]) {
      expect(el.getAttribute("role")).toBeNull()
      expect(el.getAttribute("aria-live")).toBeNull()
    }
    expect(root.getAttribute("data-state")).toBe("open")
  })

  it("an icon-only CloseTrigger is named by messages.dismiss", () => {
    render(
      <Alert.Root messages={{ dismiss: "Chiudi" }}>
        <Alert.Title>Salvato</Alert.Title>
        <Alert.CloseTrigger>
          <svg aria-hidden="true" width="12" height="12" />
        </Alert.CloseTrigger>
      </Alert.Root>,
    )
    const button = screen.getByRole("button", { name: "Chiudi" })
    expect(button.getAttribute("type")).toBe("button")
  })

  it("region recipe: named by the Title's id", () => {
    render(
      <Alert.Root id="m" role="region" aria-labelledby="alert-m-title">
        <Alert.Title>Maintenance tonight</Alert.Title>
      </Alert.Root>,
    )
    expect(screen.getByRole("region", { name: "Maintenance tonight" })).toBeTruthy()
  })

  it("warns for a consumer live role and forwards it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await act(async () => {
      render(
        <Alert.Root role="alert">
          <Alert.Title>Oops</Alert.Title>
        </Alert.Root>,
      )
    })
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(warn.mock.calls.some((c) => /announce prop/.test(String(c[0])))).toBe(true)
  })

  it("fails listing every match when two alerts are in the container", async () => {
    render(
      <div>
        <Alert.Root announce="off">A</Alert.Root>
        <Alert.Root announce="off">B</Alert.Root>
      </div>,
    )
    await expect(getAlert(screen).isOpen()).rejects.toThrow(/2 elements match/)
  })
})
