// biome-ignore-all lint/a11y: fixtures deliberately wrap, label and click arbitrary elements
import { domEnvironment } from "@rind-ui/core"
import { Field, Fieldset, Switch } from "@rind-ui/react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getSwitch, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform

describe("Switch smoke", () => {
  it("toggles, role switch, one form entry, Enter does not toggle", async () => {
    const onCheckedChange = vi.fn()
    render(
      <form data-testid="f">
        <Switch.Root name="wifi" onCheckedChange={onCheckedChange}>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label>Wi-Fi</Switch.Label>
        </Switch.Root>
      </form>,
    )
    const s = getSwitch(screen, { name: "Wi-Fi" }, { platform })
    const control = screen.getByRole("switch", { name: "Wi-Fi" })
    expect(control.getAttribute("type")).toBe("button")
    expect(control.hasAttribute("name")).toBe(false)
    await s.toggle()
    expect(await s.isChecked()).toBe(true)
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).getAll("wifi")).toEqual(["on"])
    await s.part("control").press("Enter")
    expect(await s.isChecked()).toBe(true)
    await s.via("keyboard").toggle()
    expect(await s.isChecked()).toBe(false)
    expect(document.querySelector("[data-part=thumb]")?.getAttribute("aria-hidden")).toBe("true")
  })
})

// ---- Spec scenarios: switch, hidden-form-input, control-label (tasks 1.x, 3.2, 4.3, 5.2, A.1) ----
const inJsdom = navigator.userAgent.includes("jsdom")
const opts = { platform }
const NAME = "Wi-Fi"
const drv = (name: string = NAME) => getSwitch(screen, { name }, opts)
const ctrl = (name: string = NAME) => screen.getByRole("switch", { name })
const hidden = () =>
  document.querySelector<HTMLInputElement>('[data-part="hidden-input"]') as HTMLInputElement
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

afterEach(() => vi.restoreAllMocks())

/** A real pointer press at the element's centre: a click without coordinates lands at 0,0. */
const centre = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
}
async function click(el: Element) {
  const coords = centre(el)
  await act(() =>
    userEvent.setup().pointer([
      { target: el, coords },
      { keys: "[MouseLeft]", target: el, coords },
    ]),
  )
}

function Wifi(props: Partial<Parameters<typeof Switch.Root>[0]>) {
  return (
    <Switch.Root name="wifi" {...props}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>{NAME}</Switch.Label>
    </Switch.Root>
  )
}

describe("Anatomy", () => {
  it("one role switch named by its Label, a native button, hidden input after it", () => {
    render(<Wifi />)
    expect(screen.getAllByRole("switch")).toHaveLength(1)
    const control = ctrl()
    expect(control.tagName).toBe("BUTTON")
    expect(control.getAttribute("type")).toBe("button")
    expect(control.hasAttribute("name")).toBe(false)
    const input = hidden()
    expect(input.getAttribute("aria-hidden")).toBe("true")
    expect(input.tabIndex).toBe(-1)
    expect(input.parentElement?.lastElementChild).toBe(input)
    expect(control.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("named by a wrapping label, and clicking its text toggles once (BU#4122)", async () => {
    const onCheckedChange = vi.fn()
    render(
      <label>
        <Switch.Root onCheckedChange={onCheckedChange}>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
        <span>Dark mode</span>
      </label>,
    )
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBeTruthy()
    await click(screen.getByText("Dark mode"))
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true)
  })

  it("data-state is on Root, Control, Thumb and Label", async () => {
    render(<Wifi defaultChecked />)
    const states = () =>
      ["root", "control", "thumb", "label"].map((p) =>
        document
          .querySelector(`[data-scope="switch"][data-part="${p}"]`)
          ?.getAttribute("data-state"),
      )
    expect(states()).toEqual(["checked", "checked", "checked", "checked"])
    await drv().toggle()
    expect(states()).toEqual(["unchecked", "unchecked", "unchecked", "unchecked"])
  })
})

describe("Checked value", () => {
  it("uncontrolled toggle: once, aria-checked already true", async () => {
    let seen: string | null = null
    const onCheckedChange = vi.fn((_checked: boolean) => {
      seen = ctrl().getAttribute("aria-checked")
    })
    render(<Wifi onCheckedChange={onCheckedChange} />)
    await drv().toggle()
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true)
    expect(ctrl().getAttribute("aria-checked")).toBe("true")
    expect(seen).not.toBeNull()
  })

  it("onCheckedChange sees the new value in FormData (HUI#3760)", async () => {
    const data: [string, FormDataEntryValue][][] = []
    function App() {
      const [form, setForm] = useState<HTMLFormElement | null>(null)
      return (
        <form
          ref={setForm}
          onSubmit={(e) => {
            e.preventDefault()
            data.push([...new FormData(e.currentTarget)])
          }}
        >
          <Wifi onCheckedChange={() => form?.requestSubmit()} />
        </form>
      )
    }
    render(<App />)
    await drv().toggle()
    expect(data).toEqual([[["wifi", "on"]]])
  })

  it("a controlled refusal keeps aria-checked, data-state and the hidden input", async () => {
    const onCheckedChange = vi.fn()
    render(<Wifi checked={false} onCheckedChange={onCheckedChange} />)
    await click(ctrl())
    await click(ctrl())
    expect(onCheckedChange).toHaveBeenCalledTimes(2)
    expect(ctrl().getAttribute("aria-checked")).toBe("false")
    expect(ctrl().getAttribute("data-state")).toBe("unchecked")
    expect(hidden().checked).toBe(false)
  })
})

describe("ARIA", () => {
  it("required, invalid and read-only", () => {
    render(<Wifi required invalid readOnly />)
    const c = ctrl()
    expect(c.getAttribute("aria-required")).toBe("true")
    expect(c.getAttribute("aria-invalid")).toBe("true")
    expect(c.getAttribute("aria-readonly")).toBe("true")
    expect(hidden().required).toBe(true)
  })

  it("the accessible name is the same in both states, only aria-checked changes", async () => {
    render(<Wifi />)
    const d = drv()
    expect(await d.name()).toBe(NAME)
    expect(ctrl().getAttribute("aria-checked")).toBe("false")
    await d.toggle()
    expect(await d.name()).toBe(NAME)
    expect(ctrl().getAttribute("aria-checked")).toBe("true")
  })

  it("sends no announcement and renders no aria-live region", async () => {
    const log = installAnnouncementLog()
    const before = log.length
    render(<Wifi />)
    await drv().toggle()
    await drv().toggle()
    expect(log.length).toBe(before)
    expect(document.querySelector("[aria-live]")).toBeNull()
  })
})

describe("Keyboard", () => {
  it("Space toggles on keyup and shows data-focus-visible", async () => {
    const onCheckedChange = vi.fn()
    render(<Wifi onCheckedChange={onCheckedChange} />)
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(ctrl())
    await user.keyboard("[Space>]")
    expect(onCheckedChange).not.toHaveBeenCalled()
    await user.keyboard("[/Space]")
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(ctrl().hasAttribute("data-focus-visible")).toBe(true)
  })

  it("a held Space (key repeat) toggles exactly once", async () => {
    const onCheckedChange = vi.fn()
    render(<Wifi onCheckedChange={onCheckedChange} />)
    const c = ctrl()
    act(() => c.focus())
    fireEvent.keyDown(c, { key: " ", code: "Space" })
    fireEvent.keyDown(c, { key: " ", code: "Space", repeat: true })
    fireEvent.keyDown(c, { key: " ", code: "Space", repeat: true })
    fireEvent.keyUp(c, { key: " ", code: "Space" })
    await waitFor(() => expect(onCheckedChange).toHaveBeenCalled())
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it("Enter submits the form and leaves the value (ark#2946)", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    const onCheckedChange = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <Wifi onCheckedChange={onCheckedChange} />
        <button type="submit">Send</button>
      </form>,
    )
    await drv().part("control").press("Enter")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(await drv().isChecked()).toBe(false)
  })

  it("Enter outside a form does nothing", async () => {
    const onCheckedChange = vi.fn()
    render(<Wifi onCheckedChange={onCheckedChange} />)
    await drv().part("control").press("Enter")
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(await drv().isChecked()).toBe(false)
  })
})

describe("Pointer, touch and assistive technology", () => {
  it("a press that leaves the Control before release does not toggle (bits#789)", async () => {
    const onCheckedChange = vi.fn()
    render(<Wifi onCheckedChange={onCheckedChange} />)
    const c = ctrl()
    const away = { clientX: 1, clientY: 1 }
    await act(() =>
      userEvent.setup().pointer([
        { keys: "[MouseLeft>]", target: c, coords: centre(c) },
        { target: document.body, coords: away },
        { keys: "[/MouseLeft]", target: document.body, coords: away },
      ]),
    )
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(await drv().isChecked()).toBe(false)
  })

  it("a bare click (detail 0) toggles exactly once", () => {
    const onCheckedChange = vi.fn()
    render(<Wifi onCheckedChange={onCheckedChange} />)
    fireEvent.click(ctrl(), { detail: 0 })
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it("an ancestor onClick runs once per Control click (zag#633)", async () => {
    const onClick = vi.fn()
    function App() {
      const [checked, setChecked] = useState(false)
      return (
        <div onClick={onClick}>
          <Wifi checked={checked} onCheckedChange={setChecked} />
        </div>
      )
    }
    render(<App />)
    await click(ctrl())
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(ctrl().getAttribute("aria-checked")).toBe("true")
  })

  it("a click focuses the Control with data-focus and no ring; Space then toggles (kobalte#230)", async () => {
    render(<Wifi />)
    await drv().toggle()
    expect(document.activeElement).toBe(ctrl())
    expect(ctrl().hasAttribute("data-focus")).toBe(true)
    expect(ctrl().hasAttribute("data-focus-visible")).toBe(false)
    await drv().part("control").press("Space")
    expect(await drv().isChecked()).toBe(false)
  })

  it("the Label click toggles once", async () => {
    const onCheckedChange = vi.fn()
    render(<Wifi onCheckedChange={onCheckedChange} />)
    await drv().clickLabel()
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(await drv().isChecked()).toBe(true)
  })
})

describe("Disabled and read-only", () => {
  it("read-only ignores click and Space, keeps value and focus, still submits", async () => {
    const onCheckedChange = vi.fn()
    render(
      <form data-testid="f">
        <Wifi readOnly defaultChecked onCheckedChange={onCheckedChange} />
      </form>,
    )
    const d = drv()
    await d.toggle()
    await d.via("keyboard").toggle()
    fireEvent.click(ctrl(), { detail: 0 })
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(await d.isChecked()).toBe(true)
    expect(await d.isReadOnly()).toBe(true)
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).get("wifi")).toBe("on")
    expect(document.activeElement).toBe(ctrl())
  })

  it("focusableWhenDisabled: reached with Tab, aria-disabled, Space changes nothing (BU#5139)", async () => {
    const onCheckedChange = vi.fn()
    render(<Wifi disabled focusableWhenDisabled onCheckedChange={onCheckedChange} />)
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(ctrl())
    expect(ctrl().getAttribute("aria-disabled")).toBe("true")
    await user.keyboard(" ")
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(ctrl().getAttribute("aria-checked")).toBe("false")
  })

  it("disabled disables the hidden input: nothing is submitted", async () => {
    render(<Wifi disabled defaultChecked />)
    expect(hidden().disabled).toBe(true)
    expect(await drv().formValue()).toBeNull()
  })
})

describe("Form participation", () => {
  it("exactly one form entry and no name on the Control (BU#2762)", () => {
    render(
      <form data-testid="f">
        <Wifi defaultChecked />
      </form>,
    )
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).getAll("wifi")).toEqual(["on"])
    expect(ctrl().hasAttribute("name")).toBe(false)
  })

  it("reset returns to defaultChecked with reason RESET (RX#3177)", async () => {
    const onCheckedChange = vi.fn()
    render(
      <form>
        <Wifi onCheckedChange={onCheckedChange} />
        <button type="reset">Reset</button>
      </form>,
    )
    await drv().toggle()
    expect(await drv().isChecked()).toBe(true)
    await drv().resetForm()
    expect(await drv().isChecked()).toBe(false)
    expect(onCheckedChange.mock.calls.at(-1)?.[0]).toBe(false)
    expect(onCheckedChange.mock.calls.at(-1)?.[1].reason).toBe("RESET")
  })

  it("the initial value is silent: no change reaches the form until a toggle (RX#2419)", async () => {
    const changes = vi.fn()
    render(
      <form data-testid="f">
        <Wifi defaultChecked />
      </form>,
    )
    screen.getByTestId("f").addEventListener("change", changes)
    await frame()
    await frame()
    expect(changes).not.toHaveBeenCalled()
    await drv().toggle()
    expect(changes).toHaveBeenCalledTimes(1)
  })

  it.skipIf(inJsdom)("does not overflow a narrow RTL scroll container (RX#4041)", async () => {
    render(
      <div
        data-testid="box"
        dir="rtl"
        style={{ width: 60, height: 60, overflow: "auto", position: "relative" }}
      >
        <form>
          <Wifi defaultChecked />
        </form>
      </div>,
    )
    await frame()
    const box = screen.getByTestId("box")
    expect(box.scrollWidth).toBe(box.clientWidth)
  })

  it('type="submit" on the Control warns naming type, and pressing still toggles (HUI#2935)', async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Switch.Root name="wifi">
          <Switch.Control type="submit" />
          <Switch.Label>{NAME}</Switch.Label>
        </Switch.Root>
      </form>,
    )
    expect(warn.mock.calls.some((c) => /"type"/.test(String(c[0])))).toBe(true)
    await drv().toggle()
    expect(await drv().isChecked()).toBe(true)
  })
})

describe("Field binding", () => {
  it("an invalid, required Field: ARIA, error id, input required, root data-*", () => {
    render(
      <Field.Root required invalid>
        <Field.Label>{NAME}</Field.Label>
        <Switch.Root name="wifi">
          <Switch.Control />
        </Switch.Root>
        <Field.ErrorMessage>Must be on</Field.ErrorMessage>
      </Field.Root>,
    )
    const c = ctrl()
    expect(c.getAttribute("aria-required")).toBe("true")
    expect(c.getAttribute("aria-invalid")).toBe("true")
    expect(c.getAttribute("aria-describedby")).toContain(screen.getByText("Must be on").id)
    expect(hidden().required).toBe(true)
    const root = document.querySelector('[data-scope="switch"][data-part="root"]') as HTMLElement
    expect(root.hasAttribute("data-required")).toBe(true)
    expect(root.hasAttribute("data-invalid")).toBe(true)
  })

  it("a disabled Field disables it and its hidden input", async () => {
    render(
      <Field.Root disabled>
        <Field.Label>{NAME}</Field.Label>
        <Switch.Root name="wifi" defaultChecked>
          <Switch.Control />
        </Switch.Root>
      </Field.Root>,
    )
    await waitFor(async () => expect(await drv().isDisabled()).toBe(true))
    expect(hidden().disabled).toBe(true)
  })

  it("a disabled Fieldset disables it", async () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Group</Fieldset.Legend>
        <Field.Root>
          <Field.Label>{NAME}</Field.Label>
          <Switch.Root name="wifi" defaultChecked>
            <Switch.Control />
          </Switch.Root>
        </Field.Root>
      </Fieldset.Root>,
    )
    await waitFor(async () => expect(await drv().isDisabled()).toBe(true))
    expect(hidden().disabled).toBe(true)
  })

  it("the Field Label names it and clicking it toggles once", async () => {
    const onCheckedChange = vi.fn()
    render(
      <Field.Root>
        <Field.Label>{NAME}</Field.Label>
        <Switch.Root name="wifi" onCheckedChange={onCheckedChange}>
          <Switch.Control />
        </Switch.Root>
      </Field.Root>,
    )
    expect(await drv().name()).toBe(NAME)
    await click(screen.getByText(NAME))
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })
})
