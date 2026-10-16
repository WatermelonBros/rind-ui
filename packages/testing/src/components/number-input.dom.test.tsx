// biome-ignore-all lint/a11y: fixtures deliberately label arbitrary elements
// Spec scenarios (add-number-input tasks 5.2, 6.2, 7.1-7.3) through the driver where it can;
// press-and-hold with fake timers and dispatched pointer events (no layout needed).
import {
  createNumberParser,
  domEnvironment,
  numberInputInvariants,
  numberInputMessages,
  platforms,
} from "@rind-ui/core"
import { Field, NumberInput, type NumberInputRootProps, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { domEnv, getNumberInput, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const browserIt = it.skipIf(inJsdom)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  installAnnouncementLog().length = 0
})

type QProps = NumberInputRootProps & { readonly label?: string }
function Q({ label = "Quantity", ...props }: QProps) {
  return (
    <NumberInput.Root {...props}>
      <NumberInput.Label>{label}</NumberInput.Label>
      <NumberInput.Control>
        <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
        <NumberInput.Input />
        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
      </NumberInput.Control>
    </NumberInput.Root>
  )
}
const drv = (name = "Quantity") => getNumberInput(screen, { name }, { platform })
const input = () => screen.getByRole("spinbutton") as HTMLInputElement
const inc = () => screen.getByRole("button", { name: /^Increase/ })
const dec = () => screen.getByRole("button", { name: /^Decrease/ })
const hidden = () =>
  document.querySelector<HTMLInputElement>(
    '[data-scope="number-input"][data-part="hidden-input"]',
  ) as HTMLInputElement

/** A press on a trigger by dispatched pointer events (press-interactions; no layout needed). */
const pointer = (el: Element, type: string, pointerType = "mouse") =>
  act(() => {
    fireEvent(
      el,
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        pointerId: 7,
        pointerType,
        isPrimary: true,
        // A real contact: a 1×1, zero-pressure pointer is assistive technology's (Chromium).
        width: 20,
        height: 20,
        pressure: type === "pointerup" ? 0 : 0.5,
      }),
    )
  })
const keydown = (el: Element, init: KeyboardEventInit) => {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

describe("Anatomy, names and messages", () => {
  it("Standalone with steppers", () => {
    render(<Q />)
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Increase Quantity" }).tabIndex).toBe(-1)
    expect(screen.getByRole("button", { name: "Decrease Quantity" })).toBeTruthy()
    expect(input().getAttribute("type")).toBe("text")
    expect(input().hasAttribute("name")).toBe(false)
  })

  it("Italian triggers", () => {
    render(<Q label="Quantità" messages={{ increment: "Aumenta" }} />)
    expect(screen.getByRole("button", { name: "Aumenta Quantità" })).toBeTruthy()
  })

  it("No invented bounds; Empty", () => {
    render(<Q />)
    expect(input().hasAttribute("aria-valuemin")).toBe(false)
    expect(input().hasAttribute("aria-valuemax")).toBe(false)
    expect(input().hasAttribute("aria-valuenow")).toBe(false)
    expect(input().getAttribute("aria-valuetext")).toBe("Empty")
  })

  it("an invalid formatOptions renders a plain decimal field instead of crashing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Q defaultValue={14} formatOptions={{ style: "unit", unit: "pixel" }} />)
    expect(input().value).toBe("14")
  })

  it("the iOS quirk renders a plain textbox", () => {
    render(
      <RindProvider environment={{ platform: platforms.ios }}>
        <Q defaultValue={3} />
      </RindProvider>,
    )
    expect(screen.queryByRole("spinbutton")).toBeNull()
    expect(screen.getByRole("textbox", { name: "Quantity" })).toBeTruthy()
  })
})

describe("Typing, commit and controlled values", () => {
  it("Blur without change commits nothing (react-spectrum#9444)", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(<Q defaultValue={4} onValueChange={onValueChange} onValueCommit={onValueCommit} />)
    const user = userEvent.setup()
    await user.click(input())
    await user.tab()
    expect(onValueChange).not.toHaveBeenCalled()
    expect(onValueCommit).not.toHaveBeenCalled()
  })

  it("Caret stays while editing (zag#2712)", async () => {
    render(<Q defaultValue={1234} />)
    const el = input()
    expect(el.value).toBe("1,234")
    const user = userEvent.setup()
    await user.click(el)
    // Between "3" and "4" of "1,234".
    el.setSelectionRange(4, 4)
    await user.keyboard("5")
    expect(el.value).toBe("1,2354")
    expect(el.selectionStart).toBe(5)
  })

  it("letters are rejected before they apply", async () => {
    render(<Q defaultValue={12} />)
    const user = userEvent.setup()
    await user.click(input())
    await user.keyboard("a")
    expect(input().value).toBe("12")
  })

  it("Units can be deleted (react-spectrum#2806)", async () => {
    render(<Q defaultValue={5} formatOptions={{ style: "unit", unit: "milliliter" }} />)
    const el = input()
    expect(el.value).toBe("5 mL")
    const user = userEvent.setup()
    await user.click(el)
    await user.keyboard("{End}{Backspace}{Backspace}{Backspace}")
    expect(el.value).toBe("5")
  })

  it("Garbage restores (react-spectrum#3862)", async () => {
    render(<Q defaultValue={10} />)
    const user = userEvent.setup()
    await user.tripleClick(input())
    await user.keyboard(",")
    await user.tab()
    expect(input().value).toBe("10")
    expect(await drv().value()).toBe(10)
  })

  it("Snap on commit", async () => {
    render(<Q min={0} max={100} step={5} />)
    await drv().fill("103")
    expect(await drv().value()).toBe(100)
    expect(input().value).toBe("100")
  })

  it("Parent clamps (zag#3444)", async () => {
    function Capped() {
      const [v, setV] = useState<number | null>(null)
      return <Q value={v} onValueChange={(n) => setV(n === null ? null : Math.min(n, 10))} />
    }
    render(<Capped />)
    await drv().fill("100")
    expect(input().value).toBe("10")
    expect(input().getAttribute("aria-valuenow")).toBe("10")
  })

  it("Parent refuses a step", async () => {
    const onValueCommit = vi.fn()
    render(<Q value={5} onValueCommit={onValueCommit} />)
    await drv().via("keyboard").step("increase")
    expect(input().value).toBe("5")
    expect(onValueCommit).not.toHaveBeenCalled()
  })

  it("Explicit rounding commits the shown text", async () => {
    render(<Q formatOptions={{ maximumFractionDigits: 2 }} />)
    await drv().fill("1.239")
    expect(await drv().value()).toBe(1.24)
    expect(input().value).toBe("1.24")
  })

  it("Inline options object (react-spectrum#1893): typing survives a re-render", async () => {
    function Ticking() {
      const [, setN] = useState(0)
      return (
        <Q formatOptions={{ style: "percent" }} onInputValueChange={() => setN((n) => n + 1)} />
      )
    }
    render(<Ticking />)
    const user = userEvent.setup()
    await user.click(input())
    await user.keyboard("12")
    expect(input().value).toBe("12")
  })
})

describe("Keys and steps", () => {
  it("Decimal steps (kobalte#451)", async () => {
    render(<Q defaultValue={40} step={0.1} />)
    await drv().via("keyboard").step("increase")
    await drv().via("keyboard").step("increase")
    expect(await drv().value()).toBe(40.2)
  })

  it("Off-grid value (reka-ui#2758)", async () => {
    render(<Q defaultValue={18.98} step={1} />)
    await drv().via("keyboard").step("increase")
    expect(await drv().value()).toBe(19)
  })

  it("Step from edited text (ark#1838)", async () => {
    render(<Q locale="fr-FR" formatOptions={{ style: "currency", currency: "EUR" }} />)
    const user = userEvent.setup()
    await user.click(input())
    await user.keyboard("10,50")
    await user.click(inc())
    expect(await drv().value()).toBe(11)
    expect(input().value).toBe(
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(11),
    )
  })

  it("Empty field with a minimum", async () => {
    render(<Q min={18} max={120} />)
    await drv().via("keyboard").step("decrease")
    expect(await drv().value()).toBe(18)
  })

  it("Home without a minimum leaves the caret to the browser", async () => {
    render(<Q defaultValue={42} />)
    act(() => input().focus())
    expect(keydown(input(), { key: "Home" }).defaultPrevented).toBe(false)
    expect(await drv().value()).toBe(42)
  })

  it("Value attributes after a key (cause G): same task, no blur or focus", () => {
    const eur = { style: "currency", currency: "EUR" } as const
    render(<Q defaultValue={9} locale="de-DE" formatOptions={eur} />)
    const el = input()
    act(() => el.focus())
    const seen: string[] = []
    el.addEventListener("focus", () => seen.push("focus"))
    el.addEventListener("blur", () => seen.push("blur"))
    keydown(el, { key: "ArrowUp" })
    expect(el.getAttribute("aria-valuenow")).toBe("10")
    expect(el.getAttribute("aria-valuetext")).toBe(new Intl.NumberFormat("de-DE", eur).format(10))
    expect(seen).toEqual([])
  })

  it("Held key does not flood (react-spectrum#4157)", async () => {
    render(<Q defaultValue={0} />)
    const el = input()
    act(() => el.focus())
    for (let i = 0; i < 20; i++) keydown(el, { key: "ArrowUp", repeat: i > 0 })
    expect(el.getAttribute("aria-valuenow")).toBe("20")
    await new Promise((r) => setTimeout(r, 600))
    expect(installAnnouncementLog()).toEqual([])
  })

  it("Read-only keys", async () => {
    render(<Q defaultValue={3} readOnly />)
    await drv().via("keyboard").step("increase")
    expect(await drv().value()).toBe(3)
    expect(input().readOnly).toBe(true)
  })

  it("Alt/Ctrl/Meta + arrows are the browser's", () => {
    render(<Q defaultValue={3} />)
    act(() => input().focus())
    expect(keydown(input(), { key: "ArrowUp", altKey: true }).defaultPrevented).toBe(false)
    expect(input().getAttribute("aria-valuenow")).toBe("3")
  })

  it("Silent rewrite is announced (react-spectrum#4967)", async () => {
    render(<Q max={100} />)
    await drv().fill("150")
    await vi.waitFor(
      () => expect(installAnnouncementLog().map((a) => a.message)).toContain("100"),
      { timeout: 2000 },
    )
    const before = installAnnouncementLog().length
    await drv().fill("42")
    expect(await drv().value()).toBe(42)
    await new Promise((r) => setTimeout(r, 600))
    expect(installAnnouncementLog().length).toBe(before)
  })
})

describe("Steppers and press-and-hold", () => {
  it("One change per click (base-ui#2588); a mouse moves focus to the input", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(<Q defaultValue={0} onValueChange={onValueChange} onValueCommit={onValueCommit} />)
    const user = userEvent.setup()
    await user.click(inc())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(input())
  })

  it("Tap does not open the keyboard (reka-ui#2315, base-ui#1528)", async () => {
    render(<Q defaultValue={0} />)
    await drv().via("touch").step("increase")
    expect(await drv().value()).toBe(1)
    expect(document.activeElement).toBe(document.body)
  })

  it("a stylus tap steps without taking focus (base-ui#1528)", async () => {
    render(<Q defaultValue={0} />)
    await pointer(inc(), "pointerdown", "pen")
    await pointer(inc(), "pointerup", "pen")
    expect(input().getAttribute("aria-valuenow")).toBe("1")
    expect(document.activeElement).toBe(document.body)
  })

  it("Last press at the bound: aria-disabled, never native disabled, no pressed state", async () => {
    render(<Q defaultValue={9} max={10} />)
    await drv().step("increase")
    expect(await drv().value()).toBe(10)
    expect(inc().getAttribute("aria-disabled")).toBe("true")
    expect(inc().hasAttribute("disabled")).toBe(false)
    expect(inc().hasAttribute("data-pressed")).toBe(false)
    expect(await drv().canIncrement()).toBe(false)
  })

  it("Hold with fake timers: 400 + 3 × 60 ms gives 4, one commit; Spinning attribute", async () => {
    vi.useFakeTimers()
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(<Q defaultValue={0} onValueChange={onValueChange} onValueCommit={onValueCommit} />)
    const t = inc()
    await pointer(t, "pointerdown")
    await act(async () => {
      vi.advanceTimersByTime(400 + 3 * 60)
    })
    expect(document.querySelector('[data-part="root"]')?.hasAttribute("data-spinning")).toBe(true)
    await pointer(t, "pointerup")
    expect(input().getAttribute("aria-valuenow")).toBe("4")
    expect(onValueChange).toHaveBeenCalledTimes(4)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-part="root"]')?.hasAttribute("data-spinning")).toBe(false)
  })

  it("Hold stops at max (base-ui#3887)", async () => {
    vi.useFakeTimers()
    const onValueChange = vi.fn()
    render(<Q defaultValue={0} max={3} onValueChange={onValueChange} />)
    await pointer(inc(), "pointerdown")
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(input().getAttribute("aria-valuenow")).toBe("3")
    expect(onValueChange).toHaveBeenCalledTimes(3)
  })

  it("Disabled mid-hold (base-ui#5434)", async () => {
    vi.useFakeTimers()
    const ui = (disabled: boolean) => <Q defaultValue={0} disabled={disabled} />
    const { rerender } = render(ui(false))
    await pointer(inc(), "pointerdown")
    await act(async () => {
      vi.advanceTimersByTime(460)
    })
    rerender(ui(true))
    const v = input().getAttribute("aria-valuenow")
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(input().getAttribute("aria-valuenow")).toBe(v)
  })

  it("Touch scroll (react-spectrum#8472): pointercancel never steps", async () => {
    render(<Q defaultValue={0} />)
    await pointer(inc(), "pointerdown", "touch")
    await pointer(inc(), "pointercancel", "touch")
    expect(input().getAttribute("aria-valuenow")).toBe("0")
  })

  it("No hold", async () => {
    vi.useFakeTimers()
    render(<Q defaultValue={0} spinOnPress={false} />)
    await pointer(inc(), "pointerdown")
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    await pointer(inc(), "pointerup")
    expect(input().getAttribute("aria-valuenow")).toBe("1")
  })

  it("the touch context menu is suppressed while a trigger is held", async () => {
    render(<Q defaultValue={0} />)
    await pointer(inc(), "pointerdown", "touch")
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    act(() => {
      inc().dispatchEvent(e)
    })
    expect(e.defaultPrevented).toBe(true)
    await pointer(inc(), "pointercancel", "touch")
  })

  it("Screen reader stepper press: polite announcement of the final value", async () => {
    render(<Q defaultValue={0} />)
    for (let i = 0; i < 3; i++) {
      act(() => {
        inc().dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 }))
      })
    }
    expect(input().getAttribute("aria-valuenow")).toBe("3")
    await vi.waitFor(() => expect(installAnnouncementLog().length).toBeGreaterThan(0), {
      timeout: 2000,
    })
    const log = installAnnouncementLog()
    expect(log.at(-1)?.message).toBe("3")
    expect(log.every((a) => a.priority === "polite")).toBe(true)
  })
})

describe("Wheel", () => {
  const wheel = (el: Element, init: WheelEventInit) => {
    const e = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init })
    act(() => {
      el.dispatchEvent(e)
    })
    return e
  }
  it("steps the focused input vertically; horizontal, Ctrl and unfocused are the page's", () => {
    render(<Q defaultValue={5} allowWheel />)
    const el = input()
    expect(wheel(el, { deltaY: -10 }).defaultPrevented).toBe(false)
    expect(el.getAttribute("aria-valuenow")).toBe("5")
    act(() => el.focus())
    expect(wheel(el, { deltaY: -10 }).defaultPrevented).toBe(true)
    expect(el.getAttribute("aria-valuenow")).toBe("6")
    expect(wheel(el, { deltaX: 30, deltaY: 4 }).defaultPrevented).toBe(false)
    wheel(el, { deltaY: -10, ctrlKey: true })
    expect(el.getAttribute("aria-valuenow")).toBe("6")
    wheel(el, { deltaY: 10, shiftKey: true })
    expect(el.getAttribute("aria-valuenow")).toBe("-4")
  })
  it("is off by default", () => {
    render(<Q defaultValue={5} />)
    act(() => input().focus())
    wheel(input(), { deltaY: -10 })
    expect(input().getAttribute("aria-valuenow")).toBe("5")
  })
})

describe("Paste", () => {
  it("Paste a formatted amount over the whole text", async () => {
    render(<Q formatOptions={{ style: "currency", currency: "USD" }} defaultValue={1} />)
    const user = userEvent.setup()
    await user.tripleClick(input())
    await user.paste("$1,234.50")
    expect(await drv().value()).toBe(1234.5)
    expect(input().value).toBe("$1,234.50")
  })
  it("an unparsable paste is rejected", async () => {
    render(<Q defaultValue={7} />)
    const user = userEvent.setup()
    await user.tripleClick(input())
    await user.paste("hello")
    expect(input().value).toBe("7")
  })
})

describe("Forms and Field", () => {
  it("Raw number submitted", () => {
    render(
      <form data-testid="f">
        <Q
          name="price"
          defaultValue={1234.5}
          formatOptions={{ style: "currency", currency: "USD" }}
        />
      </form>,
    )
    expect(input().value).toBe("$1,234.50")
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).get("price")).toBe("1234.5")
  })

  it("Enter submits the new value (react-spectrum#9671); keys work after Enter (zag#1710)", async () => {
    const seen: (string | null)[] = []
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen.push(new FormData(e.currentTarget).get("q") as string | null)
        }}
      >
        <Q name="q" />
        <button type="submit">Send</button>
      </form>,
    )
    const user = userEvent.setup()
    await user.click(input())
    await user.keyboard("7{Enter}")
    expect(seen).toEqual(["7"])
    await user.keyboard("{ArrowUp}")
    expect(await drv().value()).toBe(8)
  })

  it("requestSubmit() from onValueCommit submits the committed value", async () => {
    const seen: (string | null)[] = []
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          seen.push(new FormData(e.currentTarget).get("q") as string | null)
        }}
      >
        <Q
          name="q"
          defaultValue={1}
          onValueCommit={() => document.querySelector("form")?.requestSubmit()}
        />
      </form>,
    )
    await drv().via("keyboard").step("increase")
    expect(seen).toEqual(["2"])
  })

  it("reset restores the current defaultValue without a commit", async () => {
    const onValueCommit = vi.fn()
    const ui = (d: number) => (
      <form>
        <Q name="q" defaultValue={d} onValueCommit={onValueCommit} />
        <button type="reset">Reset</button>
      </form>
    )
    const { rerender } = render(ui(3))
    rerender(ui(7))
    await drv().via("keyboard").step("increase")
    onValueCommit.mockClear()
    await drv().resetForm()
    expect(await drv().value()).toBe(7)
    expect(onValueCommit).not.toHaveBeenCalled()
  })

  it("autofill on the hidden input is adopted; read-only re-syncs", async () => {
    const { unmount } = render(<Q name="q" defaultValue={1} />)
    act(() => {
      hidden().value = "42"
      hidden().dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(await drv().value()).toBe(42)
    unmount()
    render(<Q name="q" defaultValue={1} readOnly />)
    act(() => {
      hidden().value = "42"
      hidden().dispatchEvent(new Event("change", { bubbles: true }))
    })
    await vi.waitFor(() => expect(hidden().value).toBe("1"))
    expect(await drv().value()).toBe(1)
  })

  it("Validation focus (base-ui#3574): required and empty blocks submission", async () => {
    const error = vi.spyOn(console, "error")
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Q name="q" required />
        <button type="submit">Send</button>
      </form>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(onSubmit).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(document.activeElement).toBe(input()))
    expect(input().hasAttribute("data-focus-visible")).toBe(true)
    expect(error.mock.calls.flat().join(" ")).not.toMatch(/aria-hidden/)
    expect(input().getAttribute("aria-required")).toBe("true")
  })

  it("Validate keeps the typed value (base-ui#1845): rangeOverflow blocks submission", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Field.Root>
          <Field.Label>Level</Field.Label>
          <NumberInput.Root name="q" max={100} commitBehavior="validate">
            <NumberInput.Input />
          </NumberInput.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Send</button>
      </form>,
    )
    const n = getNumberInput(screen, { name: "Level" }, { platform })
    await n.fill("150")
    expect(await n.value()).toBe(150)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(hidden().validity.rangeOverflow).toBe(true)
  })

  it("min without a step: a committed 1.5 is valid (no native stepMismatch)", async () => {
    render(
      <Field.Root validationMode="change">
        <Field.Label>Level</Field.Label>
        <NumberInput.Root name="q" min={0}>
          <NumberInput.Input />
        </NumberInput.Root>
        <Field.ErrorMessage />
      </Field.Root>,
    )
    const n = getNumberInput(screen, { name: "Level" }, { platform })
    await n.fill("1.5")
    expect(await n.value()).toBe(1.5)
    expect(hidden().validity.valid).toBe(true)
    expect(await n.isInvalid()).toBe(false)
  })

  it("Field disabled: input, hidden input and both triggers disabled", () => {
    render(
      <Field.Root disabled>
        <Field.Label>Level</Field.Label>
        <NumberInput.Root name="q">
          <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
          <NumberInput.Input />
          <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
        </NumberInput.Root>
      </Field.Root>,
    )
    expect(input().disabled).toBe(true)
    expect(hidden().disabled).toBe(true)
    for (const b of [inc(), dec()]) {
      expect(b.hasAttribute("data-disabled")).toBe(true)
      expect(b.getAttribute("aria-disabled")).toBe("true")
    }
  })

  it("its own Label inside a Field is not rendered (development warning)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Field.Root>
        <Field.Label>Level</Field.Label>
        <NumberInput.Root>
          <NumberInput.Label>Own</NumberInput.Label>
          <NumberInput.Input />
        </NumberInput.Root>
      </Field.Root>,
    )
    expect(screen.queryByText("Own")).toBeNull()
    expect(warn).toHaveBeenCalled()
    expect(screen.getByRole("spinbutton", { name: "Level" })).toBeTruthy()
  })
})

describe("Broken wrapper (task 6.2)", () => {
  it("native disabled on the increment trigger at max fails the trigger invariant", async () => {
    render(
      <NumberInput.Root defaultValue={10} max={10}>
        <NumberInput.Label>Quantity</NumberInput.Label>
        <NumberInput.Input />
        <NumberInput.IncrementTrigger disabled>+</NumberInput.IncrementTrigger>
      </NumberInput.Root>,
    )
    const env = domEnv().create({
      scope: "number-input",
      anchor: { role: "spinbutton", name: "Quantity" },
      modality: "keyboard",
    })
    const inv = numberInputInvariants.find(
      (i) => i.name === "number-input-trigger-disabled-at-bound",
    )
    const out = await inv?.check({
      env,
      state: "idle",
      modality: "keyboard",
      props: { max: 10, parser: createNumberParser("en-US"), messages: numberInputMessages },
      values: { value: 9 },
    } as never)
    expect(out).toMatch(/increment-trigger/)
  })
})

describe("Browser editing (task 7.2)", () => {
  browserIt("Japanese IME (react-spectrum#6678): the composing Enter does not commit", async () => {
    const onValueCommit = vi.fn()
    render(<Q onValueCommit={onValueCommit} />)
    const n = drv()
    await n.composeOpen("１２")
    await n.part("input").press("Enter", { composing: true })
    expect(onValueCommit).not.toHaveBeenCalled()
    await n.composeEnd("１２")
    await userEvent.setup().tab()
    expect(await n.value()).toBe(12)
  })
})
