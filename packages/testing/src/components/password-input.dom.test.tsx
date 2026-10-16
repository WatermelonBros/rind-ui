// Password Input through its driver: runs unchanged in jsdom and in real browsers.
import { domEnvironment, PENDING_ANNOUNCEMENTS } from "@rind-ui/core"
import { Field, PasswordInput } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getPasswordInput, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const pw = (name = "Password") => getPasswordInput(screen, { name }, { platform })
const input = () => screen.getByLabelText("Password") as HTMLInputElement
const trigger = () => screen.getByRole("button", { name: "Show password" })

/** Keyed announcements are debounced: wait (a condition, not a delay) until none is pending. */
const settled = () =>
  waitFor(() =>
    expect((Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) as number | undefined) ?? 0).toBe(0),
  )

function Login(props: Parameters<typeof PasswordInput.Root>[0]) {
  return (
    <PasswordInput.Root {...props}>
      <PasswordInput.Label>Password</PasswordInput.Label>
      <PasswordInput.Input />
      <PasswordInput.VisibilityTrigger>
        <PasswordInput.Indicator />
      </PasswordInput.VisibilityTrigger>
    </PasswordInput.Root>
  )
}

function InForm(props: {
  readonly onSubmit?: (e: SubmitEvent) => void
  readonly onReset?: (e: Event) => void
  readonly root?: Parameters<typeof PasswordInput.Root>[0]
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        props.onSubmit?.(e.nativeEvent as SubmitEvent)
      }}
      onReset={(e) => props.onReset?.(e.nativeEvent)}
    >
      <Login name="password" {...props.root} />
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
    </form>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("PasswordInput", () => {
  it("Named input: type password, trigger named Show password", async () => {
    render(<Login />)
    expect(input().type).toBe("password")
    expect(await pw().toggleName()).toBe("Show password")
    expect(trigger().getAttribute("aria-pressed")).toBe("false")
    expect(trigger().getAttribute("aria-controls")).toBe(input().id)
    expect(trigger().tabIndex).toBe(0)
  })

  it("Keyboard toggle: Space reveals, same name, focus stays on the trigger", async () => {
    render(<Login />)
    await pw().via("keyboard").toggleVisibility()
    expect(await pw().isVisible()).toBe(true)
    expect(await pw().inputType()).toBe("text")
    expect(await pw().toggleName()).toBe("Show password")
    expect(document.activeElement).toBe(trigger())
  })

  it("Driver toggles (pointer)", async () => {
    render(<Login />)
    await pw().toggleVisibility()
    expect(await pw().isVisible()).toBe(true)
    expect(await pw().inputType()).toBe("text")
  })

  it("Screen reader activation: a bare click toggles once", async () => {
    render(<Login />)
    act(() => trigger().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })))
    expect(input().type).toBe("text")
  })

  it("Caret kept: a mouse press keeps focus and the selection", async () => {
    render(<Login />)
    await pw().type("hunter2")
    act(() => input().setSelectionRange(4, 4))
    await pw().toggleVisibility()
    expect(input().type).toBe("text")
    expect(document.activeElement).toBe(input())
    expect([input().selectionStart, input().selectionEnd]).toEqual([4, 4])
  })

  it("Spellcheck stays off when revealed", async () => {
    render(<Login />)
    await pw().toggleVisibility()
    const el = input()
    expect(el.getAttribute("spellcheck")).toBe("false")
    expect(el.getAttribute("autocorrect")).toBe("off")
    expect(el.getAttribute("autocapitalize")).toBe("none")
    expect(el.getAttribute("autocomplete")).toBe("current-password")
  })

  it("autoComplete is a default: new-password passes through", () => {
    render(
      <PasswordInput.Root>
        <PasswordInput.Label>Password</PasswordInput.Label>
        <PasswordInput.Input autoComplete="new-password" />
      </PasswordInput.Root>,
    )
    expect(input().getAttribute("autocomplete")).toBe("new-password")
  })

  it("Hidden after submit (GOV.UK): password before form data, onVisibleChange SUBMIT", async () => {
    const onVisibleChange = vi.fn()
    let typeAtSubmit = ""
    render(
      <InForm
        root={{ defaultVisible: true, onVisibleChange }}
        onSubmit={() => {
          typeAtSubmit = input().type
        }}
      />,
    )
    expect(input().type).toBe("text")
    await pw().submitForm()
    expect(typeAtSubmit).toBe("password")
    expect(onVisibleChange).toHaveBeenCalledWith(false, { reason: "SUBMIT" })
    await waitFor(() => expect(input().type).toBe("password"))
  })

  it("Controlled reset (radix#4157)", async () => {
    const onVisibleChange = vi.fn()
    function Controlled() {
      const [visible, setVisible] = useState(true)
      return (
        <InForm
          root={{
            visible,
            onVisibleChange: (v, d) => {
              onVisibleChange(v, d)
              setVisible(v)
            },
          }}
        />
      )
    }
    render(<Controlled />)
    expect(input().type).toBe("text")
    await pw().resetForm()
    await waitFor(() => expect(onVisibleChange).toHaveBeenCalledWith(false, { reason: "RESET" }))
    await waitFor(() => expect(input().type).toBe("password"))
  })

  it("Prevented reset keeps visibility", async () => {
    render(<InForm root={{ defaultVisible: true }} onReset={(e) => e.preventDefault()} />)
    await pw().resetForm()
    // The reset is read once dispatch ends: wait for the scheduler's turn, then assert.
    await act(() => Promise.resolve())
    await waitFor(() => expect(input().type).toBe("text"))
    expect(await pw().isVisible()).toBe(true)
  })

  it("Pointer toggle with focus in the input announces once; keyboard is silent", async () => {
    installAnnouncementLog().length = 0
    render(<Login />)
    await pw().type("a")
    await pw().toggleVisibility()
    await waitFor(
      () =>
        expect(installAnnouncementLog().map((a) => [a.message, a.priority])).toEqual([
          ["Password shown", "polite"],
        ]),
      { timeout: 4000 },
    )
    installAnnouncementLog().length = 0
    await settled()
    await pw().via("keyboard").toggleVisibility()
    // Keyed announcements count as pending the moment they are made: none was.
    expect(Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) ?? 0).toBe(0)
    expect(installAnnouncementLog()).toEqual([])
  })

  it("Localised trigger keeps its name in both states", async () => {
    render(<Login messages={{ toggleLabel: "Mostra password" }} />)
    const t = screen.getByRole("button", { name: "Mostra password" })
    act(() => t.click())
    expect(screen.getByRole("button", { name: "Mostra password" })).toBe(t)
    expect(t.getAttribute("aria-pressed")).toBe("true")
  })

  it("Field state reaches the parts (ark#3930)", () => {
    const parts = ["input", "visibility-trigger", "indicator"]
    const el = (part: string) =>
      document.querySelector(`[data-scope="password-input"][data-part="${part}"]`)
    const { unmount } = render(
      <Field.Root invalid>
        <Field.Label>Password</Field.Label>
        <PasswordInput.Root>
          <PasswordInput.Input />
          <PasswordInput.VisibilityTrigger />
          <PasswordInput.Indicator />
        </PasswordInput.Root>
      </Field.Root>,
    )
    expect(input().getAttribute("aria-invalid")).toBe("true")
    for (const part of parts) expect(el(part)?.hasAttribute("data-invalid"), part).toBe(true)
    unmount()
    // A disabled Field displays no error (Field: "never while disabled").
    render(
      <Field.Root disabled invalid>
        <Field.Label>Password</Field.Label>
        <PasswordInput.Root>
          <PasswordInput.Input />
          <PasswordInput.VisibilityTrigger />
          <PasswordInput.Indicator />
        </PasswordInput.Root>
      </Field.Root>,
    )
    expect(input().disabled).toBe(true)
    const t = screen.getByRole("button", { name: "Show password", hidden: true })
    expect((t as HTMLButtonElement).disabled).toBe(true)
    for (const part of parts) expect(el(part)?.hasAttribute("data-disabled"), part).toBe(true)
  })

  it("Disabled refuses a toggle; read-only allows it", async () => {
    const { unmount } = render(<Login disabled />)
    act(() => trigger().click())
    expect(input().type).toBe("password")
    unmount()
    render(<Login readOnly />)
    act(() => trigger().click())
    expect(input().type).toBe("text")
  })

  it("Indicator state", async () => {
    render(<Login />)
    await pw().toggleVisibility()
    const ind = document.querySelector('[data-part="indicator"]')
    expect(ind?.getAttribute("data-state")).toBe("visible")
    expect(ind?.getAttribute("aria-hidden")).toBe("true")
  })

  it("Edge's reveal control is hidden while a trigger is mounted", () => {
    render(<Login />)
    expect(input().hasAttribute("data-custom-reveal")).toBe(true)
    expect(document.head.querySelector('style[data-rind-style="password-input-reveal"]')).not.toBe(
      null,
    )
  })

  it("Development warning when the consumer's name follows the state", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    function Broken() {
      const [visible, setVisible] = useState(false)
      return (
        <PasswordInput.Root visible={visible} onVisibleChange={setVisible}>
          <PasswordInput.Label>Password</PasswordInput.Label>
          <PasswordInput.Input />
          <PasswordInput.VisibilityTrigger
            aria-label={visible ? "Hide password" : "Show password"}
          />
        </PasswordInput.Root>
      )
    }
    render(<Broken />)
    act(() => screen.getByRole("button").click())
    await waitFor(() =>
      expect(warn.mock.calls.some((c) => String(c[0]).includes("name changed"))).toBe(true),
    )
  })

  it.skipIf(inJsdom)("touch leaves focus where it was", async () => {
    render(<Login />)
    await pw().via("touch").toggleVisibility()
    expect(input().type).toBe("text")
    expect(document.activeElement).toBe(document.body)
  })
})
