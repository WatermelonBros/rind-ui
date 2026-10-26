// Pin Input through its driver: runs unchanged in jsdom and in real browsers.
import { domEnvironment } from "@rind-ui/core"
import { Field, PinInput, type PinInputRootProps } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getPinInput } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const pin = (name = "Verification code") => getPinInput(screen, { name }, { platform })
const input = () =>
  document.querySelector('[data-scope="pin-input"][data-part="input"]') as HTMLInputElement
const slot = (i: number) =>
  document.querySelector(`[data-part="slot"][data-index="${i}"]`) as HTMLElement

function Code({
  slots,
  label = "Verification code",
  ...props
}: Partial<PinInputRootProps> & { readonly slots?: number; readonly label?: string }) {
  const length = props.length ?? 6
  return (
    <PinInput.Root length={length} {...props}>
      <PinInput.Label>{label}</PinInput.Label>
      {/* The theme's layout, inline: slots side by side (presses map by geometry). */}
      <PinInput.Control style={{ display: "flex", gap: 4, width: 6 * 44 }}>
        <PinInput.Input />
        {Array.from({ length: slots ?? length }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions
          <PinInput.Slot key={i} index={i} style={{ width: 40, height: 40 }} />
        ))}
      </PinInput.Control>
    </PinInput.Root>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("PinInput", () => {
  it("a case-insensitive pattern: a complete code passes the native pattern too", async () => {
    render(<Code length={4} pattern={/[a-f0-9]/i} />)
    await pin().type("AB12")
    expect(input().value).toBe("AB12")
    expect(input().validity.patternMismatch).toBe(false)
  })

  it("One textbox: named, slots hidden, one tab stop", () => {
    render(<Code />)
    expect(screen.getAllByRole("textbox")).toHaveLength(1)
    expect(input().getAttribute("autocomplete")).toBe("one-time-code")
    expect(input().getAttribute("inputmode")).toBe("numeric")
    expect(input().maxLength).toBe(6)
    for (let i = 0; i < 6; i++) expect(slot(i).getAttribute("aria-hidden")).toBe("true")
  })

  it("Slot count mismatch warns with both numbers", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Code slots={5} />)
    expect(warn.mock.calls.some((c) => /6.*5/.test(String(c[0])))).toBe(true)
  })

  it("typing fills the slots in order; a letter is refused (bits-ui#826)", async () => {
    const onValueInvalid = vi.fn()
    render(<Code onValueInvalid={onValueInvalid} />)
    await pin().type("12")
    expect(await pin().value()).toBe("12")
    expect(await pin().slots()).toEqual(["1", "2", "", "", "", ""])
    await pin().type("&")
    expect(await pin().value()).toBe("12")
    expect(onValueInvalid).toHaveBeenCalledWith("&")
  })

  it("Active slot: filled slots, the caret slot active", async () => {
    render(<Code />)
    await pin().type("12")
    expect(slot(0).hasAttribute("data-filled")).toBe(true)
    expect(slot(2).hasAttribute("data-active")).toBe(true)
    expect(slot(2).hasAttribute("data-caret")).toBe(true)
    expect(document.querySelectorAll("[data-active]")).toHaveLength(1)
  })

  it("Paste with a separator (input-otp#53) and longer than length (radix#3550)", async () => {
    render(<Code />)
    await pin().paste("123-456")
    expect(await pin().value()).toBe("123456")
    await pin().fill("12345678")
    expect(await pin().value()).toBe("123456")
    expect(await pin().isComplete()).toBe(true)
  })

  it("Full paste replaces and completes again (zag#470, base-ui#4679)", async () => {
    const onValueComplete = vi.fn()
    render(<Code defaultValue="111111" onValueComplete={onValueComplete} />)
    await pin().paste("222222")
    expect(await pin().value()).toBe("222222")
    expect(onValueComplete).toHaveBeenCalledWith("222222")
  })

  it("Password manager fills by script (input-otp#152)", async () => {
    const onValueChange = vi.fn()
    render(<Code onValueChange={onValueChange} />)
    await pin().autofill("246810")
    expect(onValueChange).toHaveBeenCalledWith("246810", { reason: "AUTOFILL" })
    expect(await pin().slots()).toEqual(["2", "4", "6", "8", "1", "0"])
  })

  it("Uppercase codes (base-ui#4608)", async () => {
    render(<Code validationType="alphanumeric" sanitize={(t) => t.toUpperCase()} />)
    await pin().type("a")
    expect(await pin().value()).toBe("A")
    expect(input().getAttribute("inputmode")).toBe("text")
  })

  it("Controlled clear (ark#3573)", async () => {
    function Controlled() {
      const [v, setV] = useState<string | undefined>("123")
      return (
        <>
          <Code value={v} onValueChange={setV} />
          <button type="button" onClick={() => setV(undefined)}>
            Clear
          </button>
        </>
      )
    }
    render(<Controlled />)
    expect(input().value).toBe("123")
    act(() => screen.getByRole("button", { name: "Clear" }).click())
    expect(input().value).toBe("")
    expect(document.querySelectorAll("[data-filled]")).toHaveLength(0)
  })

  it("Masked: password type, mask characters", async () => {
    render(<Code length={4} mask defaultValue="42" />)
    expect(input().type).toBe("password")
    expect(slot(0).hasAttribute("data-masked")).toBe(true)
    expect(slot(0).textContent).toBe("•")
  })

  it("Right-to-left page keeps the code left to right", () => {
    render(
      <div dir="rtl">
        <Code defaultValue="12" />
      </div>,
    )
    expect(input().getAttribute("dir")).toBe("ltr")
    expect(document.querySelector('[data-part="root"]')?.getAttribute("dir")).toBe("ltr")
    expect(slot(0).textContent).toBe("1")
  })

  it("Read-only autofill is refused and re-synced (base-ui#4805)", async () => {
    render(<Code readOnly defaultValue="12" />)
    await pin().autofill("999999")
    expect(await pin().value()).toBe("12")
  })

  it("Disabled through the Field (radix#3545)", () => {
    render(
      <Field.Root disabled>
        <Field.Label>Verification code</Field.Label>
        <PinInput.Root length={4}>
          <PinInput.Control>
            <PinInput.Input />
            {[0, 1, 2, 3].map((i) => (
              <PinInput.Slot key={i} index={i} />
            ))}
          </PinInput.Control>
        </PinInput.Root>
      </Field.Root>,
    )
    expect(input().disabled).toBe(true)
    for (let i = 0; i < 4; i++) expect(slot(i).hasAttribute("data-disabled")).toBe(true)
  })

  it("Delete to start empties every slot (zag#2722)", async () => {
    render(<Code defaultValue="1234" />)
    await pin().clear()
    expect(await pin().value()).toBe("")
    expect(document.querySelectorAll("[data-filled]")).toHaveLength(0)
  })

  it("Incomplete code on submit: blocked, the Field shows the pattern message", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Field.Root required>
          <Field.Label>Verification code</Field.Label>
          <PinInput.Root length={6}>
            <PinInput.Control>
              <PinInput.Input />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <PinInput.Slot key={i} index={i} />
              ))}
            </PinInput.Control>
          </PinInput.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Send</button>
      </form>,
    )
    await pin().type("123")
    expect(input().getAttribute("pattern")).toBe("(?:[0-9]){6}")
    expect(input().checkValidity()).toBe(false)
    expect(input().validity.patternMismatch).toBe(true)
    act(() => screen.getByRole("button", { name: "Send" }).click())
    expect(onSubmit).not.toHaveBeenCalled()
    const error = document.querySelector('[data-part="error-message"]')
    await waitFor(() => expect(error?.textContent).toBe(input().validationMessage))
    expect(error?.textContent).not.toBe("")
  })

  it("autoSubmit submits once the full code is rendered", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Code autoSubmit />
      </form>,
    )
    await pin().paste("123456")
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })

  it("a form reset restores the default", async () => {
    render(
      <form>
        <Code defaultValue="12" />
        <button type="reset">Reset</button>
      </form>,
    )
    await pin().via("keyboard").type("3")
    expect(await pin().value()).toBe("123")
    await pin().reset()
    await waitFor(async () => expect(await pin().value()).toBe("12"))
  })

  it.skipIf(inJsdom)("Press a filled slot (input-otp#31): replaces it", async () => {
    render(<Code defaultValue="12345" />)
    await pin().pressSlot(1)
    await pin().via("keyboard").type("9")
    expect(await pin().value()).toBe("19345")
    expect(await pin().activeSlot()).toBe(2)
  })

  it.skipIf(inJsdom)("a press past the value lands at its end (zag#2999)", async () => {
    render(<Code defaultValue="12" />)
    await pin().pressSlot(4)
    expect(await pin().activeSlot()).toBe(2)
  })
})
