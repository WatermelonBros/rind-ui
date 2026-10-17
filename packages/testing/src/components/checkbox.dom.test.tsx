// biome-ignore-all lint/a11y: fixtures deliberately wrap, label and click arbitrary elements
import { domEnvironment } from "@rind-ui/core"
import { CheckboxGroup } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getCheckbox } from "../index"

const platform = domEnvironment().platform

function Terms(props: Partial<Parameters<typeof CheckboxGroup.Item>[0]>) {
  return (
    <CheckboxGroup.Item name="tos" {...props}>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>
          {({ indeterminate }) => (indeterminate ? "–" : "✓")}
        </CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>Accept terms</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Item>
  )
}

describe("Checkbox smoke", () => {
  it("toggles, mirrors the hidden input, submits", async () => {
    const onCheckedChange = vi.fn()
    render(
      <form data-testid="f">
        <Terms onCheckedChange={onCheckedChange} />
      </form>,
    )
    const c = getCheckbox(screen, { name: "Accept terms" }, { platform })
    const control = screen.getByRole("checkbox", { name: "Accept terms" })
    expect(control.getAttribute("aria-checked")).toBe("false")
    expect(control.hasAttribute("aria-labelledby")).toBe(false)
    expect(await c.formValue()).toBeNull()
    const changes = vi.fn()
    screen.getByTestId("f").addEventListener("change", changes)
    await c.check()
    expect(await c.isChecked()).toBe(true)
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(changes).toHaveBeenCalledTimes(1)
    expect(await c.formValue()).toBe("on")
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).get("tos")).toBe("on")
    await c.via("keyboard").toggle()
    expect(await c.isChecked()).toBe(false)
  })

  it("indeterminate default; activation makes it checked", async () => {
    render(<Terms defaultChecked="indeterminate" />)
    const c = getCheckbox(screen, { name: "Accept terms" }, { platform })
    expect(await c.checkedState()).toBe("indeterminate")
    const input = document.querySelector("[data-part=hidden-input]") as HTMLInputElement
    expect(input.indeterminate).toBe(true)
    expect(input.checked).toBe(false)
    await c.toggle()
    expect(await c.checkedState()).toBe(true)
  })

  it("Enter does not toggle; label click toggles once", async () => {
    render(<Terms />)
    const c = getCheckbox(screen, { name: "Accept terms" }, { platform })
    await c.part("control").press("Enter")
    expect(await c.isChecked()).toBe(false)
    await c.clickLabel()
    expect(await c.isChecked()).toBe(true)
  })

  it("form reset restores the default", async () => {
    render(
      <form>
        <Terms defaultChecked />
        <button type="reset">Reset</button>
      </form>,
    )
    const c = getCheckbox(screen, { name: "Accept terms" }, { platform })
    await c.uncheck()
    await c.resetForm()
    expect(await c.isChecked()).toBe(true)
  })
})

// ---- Spec scenarios: checkbox, hidden-form-input, control-label (tasks 1.x, 2.x, 5.x, 6.4, A.x) ----
import type { CheckedState } from "@rind-ui/core"
import { Field, Fieldset } from "@rind-ui/react"
import { act, fireEvent, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode, useState } from "react"
import { afterEach } from "vitest"

const inJsdom = navigator.userAgent.includes("jsdom")
const opts = { platform }
const NAME = "Accept terms"
const drv = (name: string = NAME) => getCheckbox(screen, { name }, opts)
const ctrl = (name: string = NAME) => screen.getByRole("checkbox", { name })
const hidden = () =>
  document.querySelector<HTMLInputElement>('[data-part="hidden-input"]') as HTMLInputElement
const inputs = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]'))
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

afterEach(() => vi.restoreAllMocks())

/** A real pointer press at the element's centre: a click without coordinates lands at 0,0. */
const centre = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
}
async function click(el: Element, times = 1) {
  const coords = centre(el)
  const keys = "[MouseLeft]".repeat(times)
  await act(() =>
    userEvent.setup().pointer([
      { target: el, coords },
      { keys, target: el, coords },
    ]),
  )
}

/** Counts the events a hidden input dispatches, and the clicks an ancestor sees. */
function spyEvents(target: EventTarget = document) {
  const seen: { type: string; target: EventTarget | null; checked: boolean | undefined }[] = []
  const on = (e: Event) =>
    seen.push({
      type: e.type,
      target: e.target,
      checked: e.target instanceof HTMLInputElement ? e.target.checked : undefined,
    })
  for (const t of ["input", "change", "click"]) target.addEventListener(t, on)
  const count = (type: string, fromInput = true) =>
    seen.filter((s) => s.type === type && (!fromInput || s.target instanceof HTMLInputElement))
      .length
  return { seen, count }
}

/** A controlled Checkbox whose setter escapes so a test can act as the parent. */
let setExternally: (v: CheckedState) => void = () => {}
function Controlled({
  refuse = false,
  initial = false,
  onChange,
  ...rest
}: {
  refuse?: boolean
  initial?: CheckedState
  onChange?: (v: CheckedState, d: { reason: string; cancel: () => void }) => void
} & Partial<Parameters<typeof CheckboxGroup.Item>[0]>) {
  const [checked, setChecked] = useState<CheckedState>(initial)
  setExternally = setChecked
  return (
    <Terms
      {...rest}
      checked={checked}
      onCheckedChange={(v, d) => {
        onChange?.(v, d)
        if (!refuse) setChecked(v)
      }}
    />
  )
}

describe("Anatomy", () => {
  it("one role checkbox (the hidden input is not matched), input after the Control", () => {
    render(<Terms />)
    expect(screen.getAllByRole("checkbox")).toHaveLength(1)
    const control = ctrl()
    expect(control.tagName).toBe("BUTTON")
    expect(control.getAttribute("type")).toBe("button")
    const input = hidden()
    expect(input.type).toBe("checkbox")
    expect(input.getAttribute("aria-hidden")).toBe("true")
    expect(input.tabIndex).toBe(-1)
    expect(input.parentElement?.lastElementChild).toBe(input)
    expect(control.hasAttribute("name")).toBe(false)
  })

  it("the Indicator stays mounted and follows data-state", async () => {
    render(<Terms defaultChecked />)
    const ind = document.querySelector('[data-part="indicator"]') as HTMLElement
    expect(ind.getAttribute("aria-hidden")).toBe("true")
    expect(ind.getAttribute("data-state")).toBe("checked")
    await drv().uncheck()
    expect(ind.isConnected).toBe(true)
    expect(ind.getAttribute("data-state")).toBe("unchecked")
  })

  it("every part carries scope, part and instance", () => {
    render(
      <CheckboxGroup.Item>
        <CheckboxGroup.ItemControl />
        <CheckboxGroup.ItemIndicator />
        <CheckboxGroup.ItemLabel>Accept terms</CheckboxGroup.ItemLabel>
        <CheckboxGroup.ItemDescription>Hint</CheckboxGroup.ItemDescription>
      </CheckboxGroup.Item>,
    )
    const parts = ["root", "control", "indicator", "label", "description", "hidden-input"]
    for (const part of parts) {
      const el = document.querySelector(`[data-part="${part}"]`)
      expect(el?.getAttribute("data-scope"), part).toBe("checkbox")
      expect(el?.hasAttribute("data-instance"), part).toBe(true)
    }
  })
})

describe("Checked value", () => {
  it("uncontrolled toggle: once, reason TOGGLE", async () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    await drv().toggle()
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true)
    expect(onCheckedChange.mock.calls[0]?.[1].reason).toBe("TOGGLE")
  })

  it("controlled after an external change proposes on the first click (ark#2608, zag#3018)", async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    act(() => setExternally(true))
    expect(ctrl().getAttribute("aria-checked")).toBe("true")
    await drv().toggle()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]?.[0]).toBe(false)
  })

  it("a refused proposal changes nothing, and every click proposes again", async () => {
    const onChange = vi.fn()
    render(<Controlled refuse onChange={onChange} />)
    await click(ctrl())
    await click(ctrl())
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(ctrl().getAttribute("aria-checked")).toBe("false")
    expect(hidden().checked).toBe(false)
  })

  it("cancel() keeps the value and dispatches no change", async () => {
    const changes = vi.fn()
    render(
      <form data-testid="f">
        <Terms onCheckedChange={(_, d) => d.cancel()} />
      </form>,
    )
    screen.getByTestId("f").addEventListener("change", changes)
    await click(ctrl())
    expect(ctrl().getAttribute("aria-checked")).toBe("false")
    expect(hidden().checked).toBe(false)
    expect(changes).not.toHaveBeenCalled()
  })

  it("changing defaultChecked later does not change the value", () => {
    const { rerender } = render(<Terms defaultChecked={false} />)
    rerender(<Terms defaultChecked />)
    expect(ctrl().getAttribute("aria-checked")).toBe("false")
  })
})

describe("Indeterminate", () => {
  it("is mixed, submits nothing, and becomes checked by pointer, Space and a bare click (ark#3174)", async () => {
    for (const how of ["pointer", "keyboard", "bare"] as const) {
      const { unmount } = render(
        <form>
          <Terms defaultChecked="indeterminate" />
        </form>,
      )
      expect(ctrl().getAttribute("aria-checked")).toBe("mixed")
      expect(ctrl().getAttribute("data-state")).toBe("indeterminate")
      expect(hidden().indeterminate).toBe(true)
      expect(hidden().checked).toBe(false)
      expect(await drv().formValue()).toBeNull()
      if (how === "pointer") await drv().toggle()
      else if (how === "keyboard") await drv().via("keyboard").toggle()
      else fireEvent.click(ctrl(), { detail: 0 })
      expect(ctrl().getAttribute("aria-checked"), how).toBe("true")
      expect(hidden().indeterminate, how).toBe(false)
      expect(hidden().checked, how).toBe(true)
      unmount()
    }
  })

  it("exposes only the Control as a checkbox, with mixed (react-spectrum#4004)", () => {
    render(<Terms defaultChecked="indeterminate" />)
    expect(screen.getAllByRole("checkbox")).toHaveLength(1)
    expect(ctrl().getAttribute("aria-checked")).toBe("mixed")
    expect(ctrl().tagName).toBe("BUTTON")
  })
})

describe("ARIA", () => {
  it("required, invalid and read-only", () => {
    render(<Terms required invalid readOnly />)
    const c = ctrl()
    expect(c.getAttribute("aria-required")).toBe("true")
    expect(c.getAttribute("aria-invalid")).toBe("true")
    expect(c.getAttribute("aria-readonly")).toBe("true")
    expect(hidden().required).toBe(true)
    const root = document.querySelector('[data-part="root"]') as HTMLElement
    for (const a of ["data-required", "data-invalid", "data-readonly"]) {
      expect(root.hasAttribute(a), a).toBe(true)
    }
  })

  it("a click at the centre of the element found by role toggles it (react-spectrum#9687)", async () => {
    render(<Terms />)
    await click(ctrl())
    expect(ctrl().getAttribute("aria-checked")).toBe("true")
    if (inJsdom) return
    const hit = document.elementFromPoint(centre(ctrl()).clientX, centre(ctrl()).clientY)
    expect(ctrl().contains(hit)).toBe(true)
  })

  it("the accessible name is the same in every state", async () => {
    render(<Terms />)
    const c = drv()
    expect(await c.name()).toBe(NAME)
    await c.check()
    expect(await c.name()).toBe(NAME)
  })
})

describe("Keyboard", () => {
  it("Space toggles on keyup, once per press even when held", async () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    const c = ctrl()
    act(() => c.focus())
    fireEvent.keyDown(c, { key: " ", code: "Space" })
    expect(onCheckedChange).not.toHaveBeenCalled()
    fireEvent.keyDown(c, { key: " ", code: "Space", repeat: true })
    fireEvent.keyDown(c, { key: " ", code: "Space", repeat: true })
    fireEvent.keyUp(c, { key: " ", code: "Space" })
    await waitFor(() => expect(onCheckedChange).toHaveBeenCalled())
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it("keys during IME composition do not toggle", () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    const c = ctrl()
    act(() => c.focus())
    fireEvent.keyDown(c, { key: " ", code: "Space", isComposing: true })
    fireEvent.keyUp(c, { key: " ", code: "Space", isComposing: true })
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it("Enter outside a form changes nothing (react-spectrum#6398)", async () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    await drv().part("control").press("Enter")
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(await drv().isChecked()).toBe(false)
  })

  it("Enter submits the form once and leaves the value (headlessui#2958, base-ui#4677, radix#1595)", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Terms />
        <button type="submit">Send</button>
      </form>,
    )
    await drv().part("control").press("Enter")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await drv().isChecked()).toBe(false)
  })

  it("preventDefault on the Enter keydown prevents the submission", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <CheckboxGroup.Item name="tos">
          <CheckboxGroup.ItemControl onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
          <CheckboxGroup.ItemLabel>{NAME}</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
        <button type="submit">Send</button>
      </form>,
    )
    await drv().part("control").press("Enter")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("Enter with a disabled default button submits nothing", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Terms />
        <button type="submit" disabled>
          Send
        </button>
      </form>,
    )
    await drv().part("control").press("Enter")
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("Pointer, touch and assistive technology", () => {
  it("a bare click toggles exactly once", () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    fireEvent.click(ctrl(), { detail: 0 })
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it("a tap toggles once", async () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    await drv().via("touch").toggle()
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it("focus alone (virtual cursor) does not toggle", () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    act(() => ctrl().focus())
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it("a press that leaves the Control before release does not toggle", async () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    const c = ctrl()
    const user = userEvent.setup()
    const away = { clientX: 1, clientY: 1 }
    await act(() =>
      user.pointer([
        { keys: "[MouseLeft>]", target: c, coords: centre(c) },
        { target: document.body, coords: away },
        { keys: "[/MouseLeft]", target: document.body, coords: away },
      ]),
    )
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it("a pointer click focuses the Control with data-focus, no ring; Space then toggles (kobalte#230)", async () => {
    render(<Terms />)
    await drv().toggle()
    expect(document.activeElement).toBe(ctrl())
    expect(ctrl().hasAttribute("data-focus")).toBe(true)
    expect(ctrl().hasAttribute("data-focus-visible")).toBe(false)
    await drv().part("control").press("Space")
    expect(await drv().isChecked()).toBe(false)
  })

  it("data-pressed is a press in progress, data-state follows the value", async () => {
    render(<Terms defaultChecked />)
    const c = ctrl()
    const user = userEvent.setup()
    const coords = centre(c)
    expect(c.hasAttribute("data-pressed")).toBe(false)
    await act(() => user.pointer({ keys: "[MouseLeft>]", target: c, coords }))
    expect(c.hasAttribute("data-pressed")).toBe(true)
    expect(c.getAttribute("data-state")).toBe("checked")
    await act(() => user.pointer({ keys: "[/MouseLeft]", target: c, coords }))
    expect(c.hasAttribute("data-pressed")).toBe(false)
    expect(c.getAttribute("data-state")).toBe("unchecked")
  })

  it("Root mirrors focus and focus-visible from the keyboard", async () => {
    render(<Terms defaultChecked />)
    const root = document.querySelector('[data-part="root"]') as HTMLElement
    await userEvent.setup().tab()
    expect(document.activeElement).toBe(ctrl())
    expect(root.hasAttribute("data-focus")).toBe(true)
    expect(root.hasAttribute("data-focus-visible")).toBe(true)
    expect(root.getAttribute("data-state")).toBe("checked")
  })

  it("StrictMode renders one checkbox and toggles once", async () => {
    const onCheckedChange = vi.fn()
    const changes = vi.fn()
    render(
      <StrictMode>
        <form data-testid="f">
          <Terms onCheckedChange={onCheckedChange} />
        </form>
      </StrictMode>,
    )
    screen.getByTestId("f").addEventListener("change", changes)
    expect(screen.getAllByRole("checkbox")).toHaveLength(1)
    expect(inputs()).toHaveLength(1)
    await drv().toggle()
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(changes).toHaveBeenCalledTimes(1)
  })
})

describe("Disabled and read-only", () => {
  it("disabled is not tabbable and its hidden input is disabled (headlessui#3212)", async () => {
    render(
      <>
        <button type="button">before</button>
        <form>
          <Terms disabled defaultChecked />
        </form>
        <button type="button">after</button>
      </>,
    )
    expect(hidden().disabled).toBe(true)
    expect(await drv().formValue()).toBeNull()
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "before" }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }))
  })

  it("disabled ignores every activation", async () => {
    const onCheckedChange = vi.fn()
    render(<Terms disabled onCheckedChange={onCheckedChange} />)
    await drv().toggle()
    await drv().clickLabel()
    fireEvent.click(ctrl(), { detail: 0 })
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it("focusableWhenDisabled keeps it in the tab order with aria-disabled", async () => {
    render(<Terms disabled focusableWhenDisabled />)
    expect(ctrl().getAttribute("aria-disabled")).toBe("true")
    await userEvent.setup().tab()
    expect(document.activeElement).toBe(ctrl())
  })

  it("read-only ignores pointer, touch, Space, label and bare click, and still submits", async () => {
    const onCheckedChange = vi.fn()
    render(
      <form data-testid="f">
        <Terms readOnly defaultChecked onCheckedChange={onCheckedChange} />
      </form>,
    )
    const c = drv()
    await c.toggle()
    await c.via("touch").toggle()
    await c.via("keyboard").toggle()
    await c.clickLabel()
    fireEvent.click(ctrl(), { detail: 0 })
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(await c.isChecked()).toBe(true)
    expect(await c.isReadOnly()).toBe(true)
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).get("tos")).toBe("on")
    act(() => ctrl().focus())
    expect(document.activeElement).toBe(ctrl())
  })
})

describe("Hidden input: structure", () => {
  it("an unnamed input has an id (base-ui#2114)", () => {
    render(
      <CheckboxGroup.Item>
        <CheckboxGroup.ItemControl aria-label="x" />
      </CheckboxGroup.Item>,
    )
    expect(hidden().id).not.toBe("")
    expect(hidden().hasAttribute("name")).toBe(false)
  })

  it("mirrors properties from the first render; the default attribute never follows the value (zag#3402, radix#2133)", async () => {
    render(<Terms defaultChecked="indeterminate" name="a" />)
    expect(hidden().indeterminate).toBe(true)
    expect(hidden().checked).toBe(false)
    expect(hidden().name).toBe("a")
    expect(hidden().value).toBe("on")
    document.body.replaceChildren()
    render(<Terms defaultChecked={false} />)
    await drv().check()
    expect(hidden().checked).toBe(true)
    expect(hidden().defaultChecked).toBe(false)
  })

  it("value, form and required mirror the props", () => {
    render(<Terms value="yes" form="f1" required />)
    expect(hidden().value).toBe("yes")
    expect(hidden().getAttribute("form")).toBe("f1")
    expect(hidden().required).toBe(true)
  })

  it.skipIf(inJsdom)(
    "adds no scroll size in a fixed-height scroll container (radix#3588, radix#2402, radix#4041)",
    () => {
      const measure = (dir: "ltr" | "rtl", withInput: boolean) => {
        const { unmount } = render(
          <div dir={dir}>
            <form>
              <div data-testid="sc" style={{ height: 100, width: 300, overflow: "auto" }}>
                <div style={{ height: 1500 }} />
                <div style={{ display: "flex", gap: 4 }}>
                  <Terms />
                </div>
              </div>
            </form>
          </div>,
        )
        // The same layout without the hidden input: removed from the DOM, nothing else differs.
        if (!withInput) hidden().remove()
        const sc = screen.getByTestId("sc")
        const doc = document.documentElement
        const r = [sc.scrollWidth, sc.scrollHeight, doc.scrollWidth, doc.scrollHeight]
        unmount()
        return r
      }
      for (const dir of ["ltr", "rtl"] as const) {
        const plain = measure(dir, false)
        const withBox = measure(dir, true)
        expect(withBox[0], `${dir} container width`).toBe(plain[0])
        expect(withBox[1], `${dir} container height`).toBe(plain[1])
        expect(withBox[2], `${dir} document width`).toBe(plain[2])
        expect(withBox[3], `${dir} document height`).toBe(plain[3])
      }
    },
  )

  it("the hidden input never receives pointer input", () => {
    render(<Terms />)
    expect(getComputedStyle(hidden()).pointerEvents).toBe("none")
  })
})

describe("Hidden input: events for user changes only", () => {
  it("native input and change listeners on the form run once, target the input, see checked (reka-ui#1209)", async () => {
    render(
      <form data-testid="f">
        <Terms />
      </form>,
    )
    const form = screen.getByTestId("f")
    const seen: { type: string; checked: boolean; target: EventTarget | null }[] = []
    for (const t of ["input", "change"]) {
      form.addEventListener(t, (e) =>
        seen.push({ type: t, checked: (e.target as HTMLInputElement).checked, target: e.target }),
      )
    }
    await drv().toggle()
    expect(seen.map((s) => s.type)).toEqual(["input", "change"])
    expect(seen.every((s) => s.target === hidden() && s.checked)).toBe(true)
  })

  it("the hidden input dispatches no click", async () => {
    render(<Terms />)
    const ev = spyEvents()
    await drv().toggle()
    expect(ev.count("click")).toBe(0)
  })

  it("requestSubmit from onCheckedChange sees the new value (headlessui#3760)", async () => {
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
          <Terms onCheckedChange={() => form?.requestSubmit()} />
        </form>
      )
    }
    render(<App />)
    await drv().toggle()
    expect(data).toEqual([[["tos", "on"]]])
  })

  it("a programmatic or default change is silent (radix#4102, radix#2419)", () => {
    const ev = spyEvents()
    render(<Controlled initial={false} />)
    act(() => setExternally(true))
    act(() => setExternally(false))
    document.body.replaceChildren()
    render(<Terms defaultChecked />)
    expect(ev.count("input")).toBe(0)
    expect(ev.count("change")).toBe(0)
    expect(ev.count("click")).toBe(0)
  })

  it("a controlled change applied later: one input and one change, input already updated", async () => {
    render(<Controlled />)
    const ev = spyEvents()
    await drv().toggle()
    expect(ev.count("input")).toBe(1)
    expect(ev.count("change")).toBe(1)
    expect(ev.seen.find((s) => s.type === "change")?.checked).toBe(true)
  })

  it("a refused change is silent, and so is a later programmatic change", async () => {
    render(<Controlled refuse />)
    const ev = spyEvents()
    await click(ctrl())
    expect(ev.count("change")).toBe(0)
    act(() => setExternally(true))
    expect(ev.count("input")).toBe(0)
    expect(ev.count("change")).toBe(0)
  })

  it("a clickable row sees one click per user click, none for a programmatic change, and stopPropagation works (radix#3265, base-ui#5175)", async () => {
    const row = vi.fn()
    function Row({ stop }: { stop?: boolean }) {
      const [checked, setChecked] = useState<CheckedState>(false)
      setExternally = setChecked
      return (
        <div onClick={row}>
          <CheckboxGroup.Item checked={checked} onCheckedChange={setChecked} name="tos">
            <CheckboxGroup.ItemControl onClick={stop ? (e) => e.stopPropagation() : undefined} />
            <CheckboxGroup.ItemLabel>{NAME}</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
        </div>
      )
    }
    const { rerender } = render(<Row />)
    await drv().toggle()
    expect(row).toHaveBeenCalledTimes(1)
    act(() => setExternally(false))
    expect(row).toHaveBeenCalledTimes(1)
    rerender(<Row stop />)
    await drv().toggle()
    expect(row).toHaveBeenCalledTimes(1)
  })
})

describe("Form reset", () => {
  it("unchecks, reason RESET (radix#983)", async () => {
    const onCheckedChange = vi.fn()
    render(
      <form>
        <Terms onCheckedChange={onCheckedChange} />
        <button type="reset">Reset</button>
      </form>,
    )
    await drv().check()
    await drv().resetForm()
    expect(await drv().isChecked()).toBe(false)
    expect(ctrl().getAttribute("aria-checked")).toBe("false")
    expect(onCheckedChange.mock.calls.at(-1)?.[0]).toBe(false)
    expect(onCheckedChange.mock.calls.at(-1)?.[1].reason).toBe("RESET")
  })

  it("a reset dispatches no change event", async () => {
    render(
      <form>
        <Terms defaultChecked />
        <button type="reset">Reset</button>
      </form>,
    )
    await drv().uncheck()
    const ev = spyEvents()
    await drv().resetForm()
    expect(ev.count("change")).toBe(0)
  })

  it("a controlled parent that refuses the reset stays checked and the input is re-checked within a frame", async () => {
    render(
      <form>
        <Controlled initial refuse />
        <button type="reset">Reset</button>
      </form>,
    )
    await click(screen.getByRole("button", { name: "Reset" }))
    await waitFor(() => expect(hidden().checked).toBe(true))
    expect(ctrl().getAttribute("aria-checked")).toBe("true")
  })

  it("a framework resetting the form behind a controlled checked Checkbox is undone within a frame (radix#3444)", async () => {
    const data: [string, FormDataEntryValue][][] = []
    render(
      <form
        data-testid="f"
        onSubmit={(e) => {
          e.preventDefault()
          data.push([...new FormData(e.currentTarget)])
        }}
      >
        <Terms checked onCheckedChange={() => {}} />
      </form>,
    )
    const form = screen.getByTestId("f") as HTMLFormElement
    act(() => form.reset())
    await waitFor(() => expect(hidden().checked).toBe(true))
    act(() => form.requestSubmit())
    expect(data).toEqual([[["tos", "on"]]])
  })

  it("restores the CURRENT default (react-spectrum#6830, radix#4155)", async () => {
    const onCheckedChange = vi.fn()
    const App = ({ d }: { d: boolean }) => (
      <form>
        <Terms defaultChecked={d} onCheckedChange={onCheckedChange} />
        <button type="reset">Reset</button>
      </form>
    )
    const { rerender } = render(<App d={false} />)
    rerender(<App d />)
    expect(ctrl().getAttribute("aria-checked")).toBe("false")
    await drv().check()
    await drv().uncheck()
    await drv().resetForm()
    expect(ctrl().getAttribute("aria-checked")).toBe("true")
    expect(onCheckedChange.mock.calls.at(-1)?.[0]).toBe(true)
    expect(onCheckedChange.mock.calls.at(-1)?.[1].reason).toBe("RESET")
    await waitFor(() => expect(hidden().checked).toBe(true))
  })

  it("a form named by the form prop resets and submits it (base-ui#4334)", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <>
        <form id="prefs" data-testid="f" onSubmit={onSubmit}>
          <button type="reset">Reset</button>
        </form>
        <Terms form="prefs" name="dark" defaultChecked />
      </>,
    )
    const form = screen.getByTestId("f") as HTMLFormElement
    expect(new FormData(form).get("dark")).toBe("on")
    await drv().uncheck()
    expect(new FormData(form).get("dark")).toBeNull()
    await drv().resetForm()
    expect(await drv().isChecked()).toBe(true)
    expect(new FormData(form).get("dark")).toBe("on")
  })
})

describe("Native constraint validation", () => {
  it("required blocks submission; focus goes to the control with a ring (radix#649)", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <form data-testid="f" onSubmit={onSubmit}>
        <Terms required />
      </form>,
    )
    const form = screen.getByTestId("f") as HTMLFormElement
    act(() => form.requestSubmit())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(hidden().validity.valueMissing).toBe(true)
    expect(error).not.toHaveBeenCalled()
    // jsdom runs constraint validation but, unlike a browser, does not move focus.
    if (!inJsdom) {
      await waitFor(() => expect(document.activeElement).toBe(ctrl()))
      expect(ctrl().hasAttribute("data-focus-visible")).toBe(true)
    }
    await drv().check()
    expect(hidden().validity.valueMissing).toBe(false)
    act(() => form.requestSubmit())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("script focusing the hidden input lands on the control", async () => {
    render(<Terms />)
    act(() => hidden().focus())
    await waitFor(() => expect(document.activeElement).toBe(ctrl()))
  })

  it.skipIf(inJsdom)(
    "validation in a scroll area scrolls the container, not the document (ark#3705, kobalte#452)",
    async () => {
      render(
        <form data-testid="f">
          <div data-testid="sc" style={{ height: 100, overflow: "auto" }}>
            <div style={{ height: 1000 }} />
            <Terms required />
          </div>
        </form>,
      )
      const sc = screen.getByTestId("sc")
      const before = [window.scrollX, window.scrollY]
      act(() => (screen.getByTestId("f") as HTMLFormElement).requestSubmit())
      await waitFor(() => expect(sc.scrollTop).toBeGreaterThan(0))
      expect([window.scrollX, window.scrollY]).toEqual(before)
    },
  )

  it("a Field-set custom validity survives a re-sync", async () => {
    const { rerender } = render(<Terms />)
    hidden().setCustomValidity("Accept the terms")
    await drv().toggle()
    rerender(<Terms readOnly={false} />)
    await frame()
    expect(hidden().validationMessage).toBe("Accept the terms")
    expect(hidden().validity.customError).toBe(true)
  })
})

describe("Form data", () => {
  it("a checked Checkbox submits name=value, once", () => {
    render(
      <form data-testid="f">
        <Terms defaultChecked value="yes" />
      </form>,
    )
    expect([...new FormData(screen.getByTestId("f") as HTMLFormElement)]).toEqual([["tos", "yes"]])
  })

  it("native submission: exactly [[a, 42]] (base-ui#3239)", () => {
    render(
      <form data-testid="f">
        <Terms name="a" value="42" defaultChecked />
        <CheckboxGroup.Item name="a" value="69">
          <CheckboxGroup.ItemControl aria-label="other" />
        </CheckboxGroup.Item>
      </form>,
    )
    expect([...new FormData(screen.getByTestId("f") as HTMLFormElement)]).toEqual([["a", "42"]])
  })

  it("uncheckedValue submits while unchecked and enabled only", async () => {
    render(
      <form data-testid="f">
        <Terms name="news" uncheckedValue="no" />
      </form>,
    )
    const data = () => [...new FormData(screen.getByTestId("f") as HTMLFormElement)]
    expect(data()).toEqual([["news", "no"]])
    await drv().check()
    expect(data()).toEqual([["news", "on"]])
    await drv().uncheck()
    expect(data()).toEqual([["news", "no"]])
  })

  it("a disabled Checkbox with uncheckedValue submits nothing", () => {
    render(
      <form data-testid="f">
        <Terms name="news" uncheckedValue="no" disabled />
      </form>,
    )
    expect([...new FormData(screen.getByTestId("f") as HTMLFormElement)]).toEqual([])
  })

  it("an indeterminate Checkbox submits nothing", () => {
    render(
      <form data-testid="f">
        <Terms defaultChecked="indeterminate" />
      </form>,
    )
    expect([...new FormData(screen.getByTestId("f") as HTMLFormElement)]).toEqual([])
  })

  it("formValue reads the value, null after uncheck", async () => {
    render(
      <form>
        <Terms />
      </form>,
    )
    await drv().check()
    expect(await drv().formValue()).toBe("on")
    await drv().uncheck()
    expect(await drv().formValue()).toBeNull()
  })
})

describe("Labels: naming", () => {
  it("named by the Label part, no aria-labelledby, label has for", () => {
    render(<Terms />)
    expect(ctrl().hasAttribute("aria-labelledby")).toBe(false)
    const label = document.querySelector('[data-part="label"]') as HTMLLabelElement
    expect(label.getAttribute("for")).toBe(ctrl().id)
  })

  it("wrapped in a consumer label (base-ui#4122)", () => {
    render(
      <label>
        <CheckboxGroup.Item>
          <CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
          </CheckboxGroup.ItemControl>
        </CheckboxGroup.Item>{" "}
        Accept terms
      </label>,
    )
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeTruthy()
  })

  it("aria-label is not doubled by a wrapping label (base-ui#5786)", () => {
    render(
      <label>
        <CheckboxGroup.Item>
          <CheckboxGroup.ItemControl aria-label="lease.pdf" />
        </CheckboxGroup.Item>
        lease.pdf
      </label>,
    )
    expect(screen.getByRole("checkbox", { name: "lease.pdf" })).toBeTruthy()
    expect(screen.getByRole("checkbox").hasAttribute("aria-labelledby")).toBe(false)
  })

  it("no Label: no dangling idref (ark#3824)", () => {
    const { container } = render(
      <CheckboxGroup.Item>
        <CheckboxGroup.ItemControl aria-label="Solo" />
      </CheckboxGroup.Item>,
    )
    expect(ctrl("Solo").hasAttribute("aria-labelledby")).toBe(false)
    expect(container.querySelector("[for]")).toBeNull()
    for (const attr of ["aria-labelledby", "aria-describedby"]) {
      for (const el of container.querySelectorAll(`[${attr}]`)) {
        for (const id of (el.getAttribute(attr) ?? "").split(/\s+/)) {
          expect(document.getElementById(id), `${attr}=${id}`).not.toBeNull()
        }
      }
    }
  })
})

describe("Labels: activation", () => {
  it("a Label click toggles once with one change (bits-ui#1670)", async () => {
    const onCheckedChange = vi.fn()
    render(
      <form>
        <Terms onCheckedChange={onCheckedChange} />
      </form>,
    )
    const ev = spyEvents()
    await drv().clickLabel()
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(ev.count("change")).toBe(1)
    expect(await drv().isChecked()).toBe(true)
  })

  it("a plain wrapping label around a controlled Checkbox toggles once per click (radix#512)", async () => {
    const onChange = vi.fn()
    render(
      <label>
        <Controlled onChange={onChange} />
        <span data-testid="txt">extra text</span>
      </label>,
    )
    const indicator = document.querySelector('[data-part="indicator"]') as HTMLElement
    const ctrl = () => screen.getByRole("checkbox")
    const want = [true, false, true]
    const targets = [indicator, ctrl(), screen.getByTestId("txt")]
    for (const [i, el] of targets.entries()) {
      await click(el)
      expect(onChange, `click ${i}`).toHaveBeenCalledTimes(i + 1)
      expect(ctrl().getAttribute("aria-checked")).toBe(String(want[i]))
    }
  })

  it("a double click outside, then a label click, toggles once (zag#515)", async () => {
    const onCheckedChange = vi.fn()
    render(
      <>
        <div data-testid="out" style={{ height: 20, width: 40 }}>
          x
        </div>
        <Terms onCheckedChange={onCheckedChange} />
      </>,
    )
    await click(screen.getByTestId("out"), 2)
    await drv().clickLabel()
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it("a label click focuses the control without a ring (react-spectrum#10299)", async () => {
    render(<Terms />)
    await drv().clickLabel()
    expect(document.activeElement).toBe(ctrl())
    expect(ctrl().hasAttribute("data-focus")).toBe(true)
    expect(ctrl().hasAttribute("data-focus-visible")).toBe(false)
  })

  it("a label click inside an element with a tabIndex still shows no ring", async () => {
    render(
      <div tabIndex={0}>
        <Terms />
      </div>,
    )
    await drv().clickLabel()
    expect(ctrl().hasAttribute("data-focus-visible")).toBe(false)
  })

  it("a label click then Space changes the value twice (kobalte#230)", async () => {
    const onCheckedChange = vi.fn()
    render(<Terms onCheckedChange={onCheckedChange} />)
    await drv().clickLabel()
    await drv().part("control").press("Space")
    expect(onCheckedChange).toHaveBeenCalledTimes(2)
  })

  it("a consumer <label for> toggles once", async () => {
    const onCheckedChange = vi.fn()
    render(
      <>
        <label htmlFor="c1" data-testid="l">
          Consumer label
        </label>
        <CheckboxGroup.Item onCheckedChange={onCheckedChange}>
          <CheckboxGroup.ItemControl id="c1" />
        </CheckboxGroup.Item>
      </>,
    )
    await click(screen.getByTestId("l"))
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("checkbox", { name: "Consumer label" })).toBeTruthy()
  })

  it("a div Control: label click toggles once, no for, named by the label (headlessui#3876)", async () => {
    const onCheckedChange = vi.fn()
    render(
      <CheckboxGroup.Item onCheckedChange={onCheckedChange}>
        <CheckboxGroup.ItemControl render={<div />} />
        <CheckboxGroup.ItemLabel>{NAME}</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>,
    )
    const label = document.querySelector('[data-part="label"]') as HTMLElement
    expect(label.hasAttribute("for")).toBe(false)
    expect(ctrl().tagName).toBe("DIV")
    expect(await drv().name()).toBe(NAME)
    await drv().clickLabel()
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(ctrl().getAttribute("aria-checked")).toBe("true")
  })

  it.skipIf(inJsdom)(
    "a double click on the label text selects nothing and toggles twice (radix#2656)",
    async () => {
      const onCheckedChange = vi.fn()
      render(<Terms onCheckedChange={onCheckedChange} />)
      const label = document.querySelector('[data-part="label"]') as HTMLElement
      const downs: { detail: number; prevented: boolean }[] = []
      document.addEventListener("mousedown", (e) =>
        downs.push({ detail: e.detail, prevented: e.defaultPrevented }),
      )
      await click(label, 2)
      expect(window.getSelection()?.toString()).toBe("")
      expect(downs.find((d) => d.detail === 1)?.prevented).toBe(false)
      expect(downs.find((d) => d.detail === 2)?.prevented).toBe(true)
      expect(onCheckedChange).toHaveBeenCalledTimes(2)
    },
  )

  it("a link inside the label navigates and does not toggle (headlessui#3658)", async () => {
    const onCheckedChange = vi.fn()
    render(
      <CheckboxGroup.Item onCheckedChange={onCheckedChange}>
        <CheckboxGroup.ItemControl />
        <CheckboxGroup.ItemLabel>
          I accept the <a href="#terms-x">terms</a>
        </CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>,
    )
    // The link keeps its default action: nothing on the way cancels the click.
    const prevented: boolean[] = []
    const record = (e: Event) => prevented.push(e.defaultPrevented)
    document.addEventListener("click", record)
    await click(screen.getByRole("link", { name: "terms" }))
    document.removeEventListener("click", record)
    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(prevented).toEqual([false])
    history.replaceState(null, "", location.pathname + location.search)
  })
})

describe("Description and state mirroring", () => {
  it("Description appears later: aria-describedby is added only then", async () => {
    function App() {
      const [shown, setShown] = useState(false)
      return (
        <CheckboxGroup.Item onCheckedChange={() => setShown(true)}>
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>{NAME}</CheckboxGroup.ItemLabel>
          {shown && <CheckboxGroup.ItemDescription>Read it first</CheckboxGroup.ItemDescription>}
        </CheckboxGroup.Item>
      )
    }
    render(<App />)
    expect(ctrl().hasAttribute("aria-describedby")).toBe(false)
    await drv().toggle()
    await waitFor(async () => expect(await drv().description()).toBe("Read it first"))
  })

  it("consumer aria-describedby ids are kept next to the Description's", () => {
    render(
      <>
        <span id="hint">Hint</span>
        <CheckboxGroup.Item>
          <CheckboxGroup.ItemControl aria-describedby="hint" />
          <CheckboxGroup.ItemLabel>{NAME}</CheckboxGroup.ItemLabel>
          <CheckboxGroup.ItemDescription>Own</CheckboxGroup.ItemDescription>
        </CheckboxGroup.Item>
      </>,
    )
    const ids = (ctrl().getAttribute("aria-describedby") ?? "").split(/\s+/)
    const own = document.querySelector('[data-part="description"]')?.id
    expect(ids).toContain("hint")
    expect(ids).toContain(own)
  })

  it("Label and Description mirror the state attributes", async () => {
    render(
      <CheckboxGroup.Item disabled required invalid defaultChecked>
        <CheckboxGroup.ItemControl />
        <CheckboxGroup.ItemLabel>{NAME}</CheckboxGroup.ItemLabel>
        <CheckboxGroup.ItemDescription>Hint</CheckboxGroup.ItemDescription>
      </CheckboxGroup.Item>,
    )
    for (const part of ["label", "description"]) {
      const el = document.querySelector(`[data-part="${part}"]`) as HTMLElement
      for (const a of ["data-disabled", "data-required", "data-invalid"]) {
        expect(el.hasAttribute(a), `${part} ${a}`).toBe(true)
      }
      expect(el.getAttribute("data-state")).toBe("checked")
    }
  })
})

describe("Field binding", () => {
  it("named and described by the Field, and the Field Label click toggles once", async () => {
    const onCheckedChange = vi.fn()
    render(
      <Field.Root>
        <Field.Label>{NAME}</Field.Label>
        <CheckboxGroup.Item name="tos" onCheckedChange={onCheckedChange}>
          <CheckboxGroup.ItemControl />
        </CheckboxGroup.Item>
        <Field.Description>Required to continue</Field.Description>
      </Field.Root>,
    )
    expect(await drv().name()).toBe(NAME)
    expect(await drv().description()).toBe("Required to continue")
    await click(screen.getByText(NAME))
    expect(onCheckedChange).toHaveBeenCalledTimes(1)
  })

  it("an own Label inside a Field warns; the Field Label names the control", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Field.Root>
        <Field.Label>{NAME}</Field.Label>
        <CheckboxGroup.Item>
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>Own</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      </Field.Root>,
    )
    expect(warn.mock.calls.some((c) => /Label/.test(String(c[0])))).toBe(true)
    expect(screen.getByRole("checkbox").getAttribute("id")).toBeTruthy()
    expect(await getCheckbox(screen, { name: /./ }, opts).name()).toBe(NAME)
  })

  it("an invalid, required Field: ARIA, error id, input required, root data-*", async () => {
    render(
      <Field.Root required invalid>
        <Field.Label>{NAME}</Field.Label>
        <CheckboxGroup.Item name="tos">
          <CheckboxGroup.ItemControl />
        </CheckboxGroup.Item>
        <Field.ErrorMessage>Must accept</Field.ErrorMessage>
      </Field.Root>,
    )
    const c = ctrl()
    expect(c.getAttribute("aria-required")).toBe("true")
    expect(c.getAttribute("aria-invalid")).toBe("true")
    const err = screen.getByText("Must accept")
    expect(c.getAttribute("aria-describedby")).toContain(err.id)
    expect(hidden().required).toBe(true)
    const root = document.querySelector('[data-scope="checkbox"][data-part="root"]') as HTMLElement
    expect(root.hasAttribute("data-required")).toBe(true)
    expect(root.hasAttribute("data-invalid")).toBe(true)
    expect(await drv().description()).toContain("Must accept")
  })

  it("a disabled Fieldset disables the Checkbox", async () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Group</Fieldset.Legend>
        <Field.Root>
          <Field.Label>{NAME}</Field.Label>
          <CheckboxGroup.Item name="tos" defaultChecked>
            <CheckboxGroup.ItemControl />
          </CheckboxGroup.Item>
        </Field.Root>
      </Fieldset.Root>,
    )
    await waitFor(async () => expect(await drv().isDisabled()).toBe(true))
    expect(hidden().disabled).toBe(true)
    expect(
      document
        .querySelector('[data-part="root"][data-scope="checkbox"]')
        ?.hasAttribute("data-disabled"),
    ).toBe(true)
  })
})
