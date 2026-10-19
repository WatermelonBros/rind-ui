// Clipboard through its driver (spec clipboard): anatomy and IDREFs, copy states with the fake
// clipboard, the write in the click's task, the stable name, announcements, the Input's
// selection and copies, disabled, messages, server HTML.
import {
  Clipboard,
  type ClipboardRootProps,
  RindProvider,
  type RindProviderProps,
} from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeClipboard, getClipboard, recordingAnnouncer } from "../index"

afterEach(() => vi.restoreAllMocks())

function Field(props: Partial<ClipboardRootProps> & { readonly label?: string }) {
  const { label = "API key", ...root } = props
  return (
    <Clipboard.Root value="sk-123" {...root}>
      <Clipboard.Label>{label}</Clipboard.Label>
      <Clipboard.Control>
        <Clipboard.Input />
        <Clipboard.Trigger>
          <Clipboard.Indicator copied="✓" failed="×">
            ⧉
          </Clipboard.Indicator>
        </Clipboard.Trigger>
      </Clipboard.Control>
      <Clipboard.ValueText />
    </Clipboard.Root>
  )
}

function setup(node: React.ReactNode, env: RindProviderProps["environment"] = {}) {
  const rec = recordingAnnouncer()
  const clipboard = fakeClipboard()
  render(
    <RindProvider announcer={rec.announcer} environment={{ clipboard, ...env }}>
      {node}
      <button type="button">After</button>
    </RindProvider>,
  )
  return { log: rec.log, clipboard }
}

/** Every IDREF in the document resolves. */
const danglingRefs = () => {
  const out: string[] = []
  for (const el of document.querySelectorAll("[aria-labelledby], [aria-describedby], [for]")) {
    for (const attr of ["aria-labelledby", "aria-describedby", "for"]) {
      for (const id of (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) out.push(`${attr}=${id}`)
      }
    }
  }
  return out
}

describe("clipboard anatomy", () => {
  it("a bare copy button: one button named Copy, type=button, no dangling IDREF", () => {
    setup(
      <Clipboard.Root value="abc">
        <Clipboard.Trigger />
      </Clipboard.Root>,
    )
    const buttons = screen.getAllByRole("button", { name: "Copy" })
    expect(buttons).toHaveLength(1)
    expect(buttons[0]?.getAttribute("type")).toBe("button")
    expect(danglingRefs()).toEqual([])
  })

  it("field and button: a read-only textbox named by the Label, the button Copy API key", () => {
    setup(<Field />)
    const input = screen.getByRole("textbox", { name: "API key" }) as HTMLInputElement
    expect(input.value).toBe("sk-123")
    expect(input.readOnly).toBe(true)
    expect(screen.getByRole("button", { name: "Copy API key" })).toBeTruthy()
    expect(document.querySelector('[data-part="indicator"]')?.getAttribute("aria-hidden")).toBe(
      "true",
    )
    expect(document.querySelector('[data-part="value-text"]')?.textContent).toBe("sk-123")
    expect(danglingRefs()).toEqual([])
  })

  it("inside a form: pressing the Trigger does not submit (Zag 0.77.1)", async () => {
    const submit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    setup(
      <form onSubmit={submit}>
        <Field />
      </form>,
    )
    await getClipboard(screen, { label: "API key" }).copy()
    expect(submit).not.toHaveBeenCalled()
  })
})

describe("clipboard copy", () => {
  it("copies the value, announces once, the name never changes (driver)", async () => {
    const { log, clipboard } = setup(<Field label="Invite link" />)
    const d = getClipboard(screen, { label: "Invite link" })
    expect(await d.triggerName()).toBe("Copy Invite link")
    await d.copy()
    await d.settleCopy()
    expect(await d.copyState()).toBe("copied")
    expect(await d.triggerName()).toBe("Copy Invite link")
    expect(clipboard.copied).toEqual(["sk-123"])
    expect(log.map((a) => [a.message, a.priority])).toEqual([["Copied", "polite"]])
    for (const part of ["root", "control", "input", "trigger", "indicator", "value-text"]) {
      expect(
        document
          .querySelector(`[data-scope="clipboard"][data-part="${part}"]`)
          ?.getAttribute("data-state"),
        part,
      ).toBe("copied")
    }
    expect(document.querySelector('[data-part="indicator"]')?.textContent).toBe("✓")
  })

  it("a rejected write is error on every part and Copy failed, never Copied", async () => {
    const onCopy = vi.fn()
    const { log, clipboard } = setup(<Field onCopy={onCopy} />)
    clipboard.set("reject")
    const d = getClipboard(screen)
    await d.copy()
    await d.settleCopy()
    expect(await d.copyState()).toBe("error")
    expect(log.map((a) => a.message)).toEqual(["Copy failed"])
    expect(onCopy).toHaveBeenCalledWith(expect.objectContaining({ ok: false, source: "trigger" }))
    for (const el of document.querySelectorAll('[data-scope="clipboard"]')) {
      expect(el.getAttribute("data-state")).toBe("error")
    }
    expect(document.querySelector('[data-part="indicator"]')?.textContent).toBe("×")
  })

  it("no clipboard at all is error (Mantine#3271)", async () => {
    const { log, clipboard } = setup(<Field />)
    clipboard.set("absent")
    const d = getClipboard(screen)
    await d.copy()
    await d.settleCopy()
    expect(await d.copyState()).toBe("error")
    expect(log.map((a) => a.message)).toEqual(["Copy failed"])
  })

  it("writeText is called before the click returns (the click's task)", () => {
    let called = false
    setup(<Field />, {
      clipboard: {
        writeText: () => {
          called = true
          return Promise.resolve()
        },
      },
    })
    const trigger = screen.getByRole("button", { name: "Copy API key" })
    // No await between the click and the check: nothing deferred ran.
    act(() => trigger.click())
    expect(called).toBe(true)
  })

  it("an assistive-technology press (a bare click) copies", async () => {
    const { clipboard } = setup(<Field />)
    await act(async () => {
      screen
        .getByRole("button", { name: "Copy API key" })
        .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 }))
    })
    expect(clipboard.log).toEqual(["sk-123"])
  })

  it("each press is heard and focus stays on the Trigger", async () => {
    const { log } = setup(<Field />)
    const user = userEvent.setup()
    const trigger = screen.getByRole("button", { name: "Copy API key" })
    await user.click(trigger)
    await getClipboard(screen).settleCopy()
    await user.click(trigger)
    await getClipboard(screen).settleCopy()
    expect(log.map((a) => a.message)).toEqual(["Copied", "Copied"])
    expect(document.activeElement).toBe(trigger)
  })

  it("two instances keep both announcements (different keys)", async () => {
    const { log } = setup(
      <>
        <Field label="One" />
        <Field label="Two" />
      </>,
    )
    await act(async () => {
      screen.getByRole("button", { name: "Copy One" }).click()
      screen.getByRole("button", { name: "Copy Two" }).click()
    })
    expect(new Set(log.map((a) => a.key)).size).toBe(2)
  })

  it("the value is read at press time (Chakra#6923)", async () => {
    const clipboard = fakeClipboard()
    const view = render(
      <RindProvider environment={{ clipboard }}>
        <Field value="a" />
      </RindProvider>,
    )
    view.rerender(
      <RindProvider environment={{ clipboard }}>
        <Field value="b" />
      </RindProvider>,
    )
    await act(async () => screen.getByRole("button", { name: "Copy API key" }).click())
    expect(clipboard.log).toEqual(["b"])
  })

  it("consumer aria-label wins", () => {
    setup(
      <Clipboard.Root value="t">
        <Clipboard.Label>Token</Clipboard.Label>
        <Clipboard.Trigger aria-label="Copy token" />
      </Clipboard.Root>,
    )
    expect(screen.getByRole("button", { name: "Copy token" })).toBeTruthy()
  })

  it("feedback ends after copyFeedbackDuration (fake time)", async () => {
    vi.useFakeTimers() // fake-time: the feedback delay runs on the faked window timers
    try {
      setup(<Field copyFeedbackDuration={500} />)
      const d = getClipboard(screen)
      await act(async () => screen.getByRole("button", { name: "Copy API key" }).click())
      expect(await d.copyState()).toBe("copied")
      await act(async () => {
        vi.advanceTimersByTime(499)
      })
      expect(await d.copyState()).toBe("copied")
      await act(async () => {
        vi.advanceTimersByTime(1)
      })
      expect(await d.copyState()).toBe("idle")
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("clipboard input", () => {
  it("Tab selects the whole value", async () => {
    setup(<Field />)
    const user = userEvent.setup()
    await user.tab()
    const input = screen.getByRole("textbox", { name: "API key" }) as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)).toBe("sk-123")
    expect(input.hasAttribute("data-focus-visible")).toBe(true)
  })

  it("the press that focuses the Input selects the whole value", async () => {
    setup(<Field />)
    const user = userEvent.setup()
    const input = screen.getByRole("textbox", { name: "API key" }) as HTMLInputElement
    await user.click(input)
    expect(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)).toBe("sk-123")
  })

  it("a whole-value copy is copied, announced, source input (driver)", async () => {
    const onCopy = vi.fn()
    const { log, clipboard } = setup(<Field onCopy={onCopy} />)
    const d = getClipboard(screen, { label: "API key" })
    await d.copyFromInput()
    expect(await d.copyState()).toBe("copied")
    expect(log.map((a) => a.message)).toEqual(["Copied"])
    expect(onCopy).toHaveBeenCalledWith({ ok: true, source: "input" })
    expect(clipboard.log).toEqual([])
  })

  it("a partial copy changes nothing (Zag INPUT.COPY)", async () => {
    const { log } = setup(<Field />)
    const d = getClipboard(screen)
    await d.copyPartOfInput(3)
    const input = screen.getByRole("textbox", { name: "API key" }) as HTMLInputElement
    expect(input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)).toBe("sk-")
    expect(await d.copyState()).toBe("idle")
    expect(log).toEqual([])
  })
})

describe("clipboard disabled and messages", () => {
  it("disabled: no write, the Input disabled, data-disabled on every part", async () => {
    const { clipboard } = setup(<Field disabled />)
    const trigger = screen.getByRole("button", { name: "Copy API key" }) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
    await act(async () => trigger.click())
    expect(clipboard.log).toEqual([])
    expect(await getClipboard(screen).copyState()).toBe("idle")
    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true)
    for (const el of document.querySelectorAll('[data-scope="clipboard"]')) {
      expect(el.hasAttribute("data-disabled")).toBe(true)
    }
    expect(await getClipboard(screen).isDisabled()).toBe(true)
  })

  it("the Indicator renders the provider's icon for the state (copy, then check)", async () => {
    const clipboard = fakeClipboard()
    render(
      <RindProvider
        environment={{ clipboard }}
        icons={{ copy: () => <i>copy-icon</i>, check: () => <i>check-icon</i> }}
      >
        <Clipboard.Root value="v">
          <Clipboard.Trigger>
            <Clipboard.Indicator />
          </Clipboard.Trigger>
        </Clipboard.Root>
      </RindProvider>,
    )
    const indicator = () => document.querySelector('[data-part="indicator"]')?.textContent
    expect(indicator()).toBe("copy-icon")
    const d = getClipboard(screen)
    await d.copy()
    await d.settleCopy()
    expect(indicator()).toBe("check-icon")
  })

  it("Italian messages and locale", async () => {
    const { log } = setup(
      <Clipboard.Root
        value="x"
        locale="it"
        messages={{ copy: "Copia", copied: "Copiato", copyFailed: "Copia non riuscita" }}
      >
        <Clipboard.Trigger />
      </Clipboard.Root>,
    )
    expect(screen.getByRole("button", { name: "Copia" })).toBeTruthy()
    const d = getClipboard(screen)
    await d.copy()
    await d.settleCopy()
    expect(log.map((a) => [a.message, a.lang])).toEqual([["Copiato", "it"]])
  })

  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider environment={{ clipboard: fakeClipboard() }}>
          <Field />
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector("input")?.getAttribute("value")).toBe("sk-123")
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
