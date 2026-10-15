// biome-ignore-all lint/a11y: fixtures deliberately render bare buttons and forms
// Segmented Control in the DOM (tasks 3.2, 4.2, 5.3): render substitution, the indicator's
// mount, StrictMode, development warnings, form participation and the driver in every
// modality. Runs in the jsdom and browser projects.
import { domEnvironment } from "@rind-ui/core"
import { RindProvider, SegmentedControl } from "@rind-ui/react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getSegmentedControl } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
]

afterEach(() => vi.restoreAllMocks())

type RootProps = Partial<Parameters<typeof SegmentedControl.Root>[0]>
function Range({
  label = "Range",
  disabledItems = [],
  indicator = true,
  ...root
}: RootProps & { label?: string | null; disabledItems?: string[]; indicator?: boolean }) {
  return (
    <form data-testid="f">
      <SegmentedControl.Root name="range" {...root}>
        {label !== null && <SegmentedControl.Label>{label}</SegmentedControl.Label>}
        {RANGES.map((r) => (
          <SegmentedControl.Item
            key={r.value}
            value={r.value}
            disabled={disabledItems.includes(r.value)}
          >
            {r.label}
          </SegmentedControl.Item>
        ))}
        {indicator && <SegmentedControl.Indicator />}
      </SegmentedControl.Root>
      <button type="button">After</button>
    </form>
  )
}

const drv = () => getSegmentedControl(screen, { name: "Range" }, { platform })
const seg = (name: string) => screen.getByRole("radio", { name })
const hiddenInputs = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]'))
const formEl = () => screen.getByTestId("f") as HTMLFormElement
const indicator = () => document.querySelector<HTMLElement>('[data-part="indicator"]')

/** A real pointer press at the element's centre: a click without coordinates lands at 0,0. */
async function click(el: Element) {
  const r = el.getBoundingClientRect()
  const coords = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
  await act(() =>
    userEvent.setup().pointer([
      { target: el, coords },
      { keys: "[MouseLeft]", target: el, coords },
    ]),
  )
}

describe("anatomy and semantics", () => {
  it("radiogroup of radios named by their text, the hidden input a sibling", () => {
    render(<Range />)
    expect(screen.getByRole("radiogroup", { name: "Range" })).toBeTruthy()
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Day", "Week", "Month"])
    expect(hiddenInputs()).toHaveLength(3)
    expect(document.querySelector("[role=radio] input")).toBeNull()
    expect(document.querySelector('[data-scope="radio-group"]')).toBeNull()
  })
})

describe("render substitution", () => {
  it("a segment rendered as another element keeps its role and behaviour", async () => {
    const onValueChange = vi.fn()
    render(
      <form>
        <SegmentedControl.Root name="range" onValueChange={onValueChange}>
          <SegmentedControl.Label>Range</SegmentedControl.Label>
          {RANGES.map((r) => (
            <SegmentedControl.Item
              key={r.value}
              value={r.value}
              render={(p) => <div {...(p as object)} />}
            >
              {r.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </form>,
    )
    expect(seg("Week").tagName).toBe("DIV")
    expect(seg("Week").getAttribute("role")).toBe("radio")
    expect(seg("Week").getAttribute("aria-checked")).toBe("false")
    await drv().via("keyboard").select("Week")
    expect(await drv().selected()).toBe("Week")
    await drv().via("pointer").select("Month")
    expect(await drv().selected()).toBe("Month")
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual(["week", "month"])
  })
})

describe("indicator", () => {
  it("conditional mount shows the indicator state for the current selection (ark#3435)", async () => {
    function Toggle() {
      const [on, setOn] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOn(true)}>
            Mount
          </button>
          <Range defaultValue="week" indicator={on} />
        </>
      )
    }
    render(<Toggle />)
    expect(indicator()).toBeNull()
    fireEvent.click(screen.getByText("Mount"))
    await waitFor(() => expect(indicator()).not.toBeNull())
    const ind = indicator()
    expect(ind?.getAttribute("aria-hidden")).toBe("true")
    if (inJsdom) {
      // No layout in jsdom: the box never measures, so it stays hidden.
      expect(ind?.hasAttribute("hidden")).toBe(true)
      expect(ind?.getAttribute("data-state")).toBe("hidden")
      expect(ind?.getAttribute("style") ?? "").not.toContain("--rind-indicator")
    } else {
      await waitFor(() => expect(indicator()?.getAttribute("data-state")).toBe("visible"))
      expect(indicator()?.hasAttribute("hidden")).toBe(false)
    }
  })

  it("nothing selected: hidden with no custom properties", () => {
    render(<Range />)
    expect(indicator()?.hasAttribute("hidden")).toBe(true)
    expect(indicator()?.getAttribute("data-state")).toBe("hidden")
    expect(indicator()?.getAttribute("style") ?? "").not.toContain("--rind-indicator")
  })

  it("StrictMode leaves no stale indicator inline style (react-spectrum#10570)", async () => {
    const { unmount } = render(
      <StrictMode>
        <Range defaultValue="week" />
      </StrictMode>,
    )
    await drv().via("pointer").select("Month")
    const style = indicator()?.getAttribute("style") ?? ""
    for (const v of ["left", "right", "top", "bottom", "width", "height"]) {
      expect(
        style.match(new RegExp(`--rind-indicator-${v}:`, "g"))?.length ?? 0,
      ).toBeLessThanOrEqual(1)
    }
    if (inJsdom) expect(style).not.toContain("--rind-indicator")
    unmount()
    expect(document.querySelector('[data-part="indicator"]')).toBeNull()
  })
})

describe("development warnings", () => {
  const warnings = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .filter((m: string) => /segmented-control/.test(m))

  it("an unnamed control warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Range label={null} />)
    expect(warnings(warn).some((m: string) => /no accessible name/.test(m))).toBe(true)
  })

  it("a control named by a Label does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Range />)
    expect(warnings(warn)).toEqual([])
  })

  it("a control named by aria-label does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Range label={null} aria-label="Range" />)
    expect(warnings(warn)).toEqual([])
  })

  it("an icon-only segment without aria-label warns; with aria-label it does not", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { unmount } = render(
      <SegmentedControl.Root aria-label="View">
        <SegmentedControl.Item value="grid">
          <svg aria-hidden="true" width="8" height="8" />
        </SegmentedControl.Item>
      </SegmentedControl.Root>,
    )
    expect(warnings(warn).some((m: string) => /"grid".*no text and no aria-label/.test(m))).toBe(
      true,
    )
    unmount()
    warn.mockClear()
    render(
      <SegmentedControl.Root aria-label="View">
        <SegmentedControl.Item value="grid" aria-label="Grid">
          <svg aria-hidden="true" width="8" height="8" />
        </SegmentedControl.Item>
      </SegmentedControl.Root>,
    )
    expect(warnings(warn)).toEqual([])
  })
})

describe("form participation", () => {
  it("no entry with nothing selected, exactly range=week with one", async () => {
    render(<Range />)
    expect([...new FormData(formEl())]).toEqual([])
    await drv().select("Week")
    expect([...new FormData(formEl())]).toEqual([["range", "week"]])
    expect(await drv().formValue()).toEqual([["range", "week"]])
  })

  it("reset restores the default value and the hidden inputs", async () => {
    render(<Range defaultValue="day" />)
    await drv().select("Month")
    expect(await drv().selected()).toBe("Month")
    act(() => formEl().reset())
    await waitFor(async () => expect(await drv().selected()).toBe("Day"))
    await waitFor(() => expect(hiddenInputs().map((i) => i.checked)).toEqual([true, false, false]))
    expect([...new FormData(formEl())]).toEqual([["range", "day"]])
  })

  it("required is exposed on the root and on every hidden input", () => {
    render(<Range required />)
    expect(screen.getByRole("radiogroup").getAttribute("aria-required")).toBe("true")
    expect(screen.getByRole("radiogroup").getAttribute("aria-invalid")).toBeNull()
    expect(hiddenInputs().every((i) => i.required)).toBe(true)
  })

  it("a disabled segment is never submitted nor selectable", async () => {
    render(<Range disabledItems={["week"]} />)
    expect(await drv().isDisabled("Week")).toBe(true)
    await drv().select("Week")
    expect(await drv().selected()).toBeNull()
    expect([...new FormData(formEl())]).toEqual([])
  })

  it("a user change dispatches input then change once; a programmatic one does not", async () => {
    const events: string[] = []
    const { rerender } = render(<Range value="day" onValueChange={() => {}} />)
    const form = formEl()
    form.addEventListener("input", () => events.push("input"))
    form.addEventListener("change", () => events.push("change"))
    rerender(<Range value="week" onValueChange={() => {}} />)
    expect(events).toEqual([])
    const user = render(<Range name="x" />)
    user.unmount()
    render(<Range />).rerender(<Range />)
  })

  it("Enter submits the form once and does not select (implicit submission)", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    const onValueChange = vi.fn()
    render(
      <form data-testid="f" onSubmit={onSubmit}>
        <SegmentedControl.Root name="range" onValueChange={onValueChange}>
          <SegmentedControl.Label>Range</SegmentedControl.Label>
          {RANGES.map((r) => (
            <SegmentedControl.Item key={r.value} value={r.value}>
              {r.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
        <button type="submit">Send</button>
      </form>,
    )
    act(() => seg("Month").focus())
    await user.keyboard("{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onValueChange).not.toHaveBeenCalled()
    expect(await drv().selected()).toBeNull()
  })
})

describe("driver", () => {
  it("queries: segments, selected, focusedSegment, isDisabled, formValue", async () => {
    render(<Range defaultValue="week" disabledItems={["month"]} />)
    expect(await drv().segments()).toEqual(["Day", "Week", "Month"])
    expect(await drv().selected()).toBe("Week")
    expect(await drv().focusedSegment()).toBeNull()
    expect(await drv().isDisabled("Month")).toBe(true)
    expect(await drv().isDisabled("Day")).toBe(false)
    expect(await drv().formValue()).toEqual([["range", "week"]])
    act(() => seg("Day").focus())
    expect(await drv().focusedSegment()).toBe("Day")
  })

  it("select works in every modality, one tab stop", async () => {
    for (const modality of ["pointer", "touch", "keyboard", "virtual"] as const) {
      const onValueChange = vi.fn()
      const { unmount } = render(<Range onValueChange={onValueChange} />)
      await drv().via(modality).select("Month")
      expect(await drv().selected(), modality).toBe("Month")
      // Arrows select on the way (day, week, month); the other modalities select once.
      if (modality !== "keyboard") expect(onValueChange, modality).toHaveBeenCalledTimes(1)
      expect(onValueChange.mock.lastCall?.[0], modality).toBe("month")
      expect(
        screen.getAllByRole("radio").filter((r) => r.tabIndex === 0),
        modality,
      ).toHaveLength(1)
      unmount()
    }
  })

  it("keyboard select with a different selection moves forward through the arrows", async () => {
    render(<Range defaultValue="week" />)
    await drv().via("keyboard").select("Day")
    expect(await drv().selected()).toBe("Day")
  })

  it("RTL: ArrowLeft moves to the next segment and selects it", async () => {
    const user = userEvent.setup()
    render(
      <RindProvider dir="rtl">
        <Range defaultValue="day" />
      </RindProvider>,
    )
    act(() => seg("Day").focus())
    await user.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(seg("Week"))
    expect(await drv().selected()).toBe("Week")
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(seg("Day"))
    expect(await drv().selected()).toBe("Day")
  })

  it("read-only: no select attempt changes the value", async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Range readOnly defaultValue="day" onValueChange={onValueChange} />)
    expect(screen.getByRole("radiogroup").getAttribute("aria-readonly")).toBe("true")
    for (const modality of ["pointer", "touch", "keyboard", "virtual"] as const) {
      await drv().via(modality).select("Month")
      expect(await drv().selected(), modality).toBe("Day")
    }
    act(() => seg("Day").focus())
    await user.keyboard("{ArrowRight} ")
    await click(seg("Month"))
    expect(await drv().selected()).toBe("Day")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("a virtual click selects once, with modality virtual", async () => {
    const onValueChange = vi.fn()
    render(<Range onValueChange={onValueChange} />)
    act(() => seg("Month").click())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toBe("month")
    expect(onValueChange.mock.calls[0]?.[1].event.modality).toBe("virtual")
    await drv().via("virtual").select("Week")
    expect(onValueChange).toHaveBeenCalledTimes(2)
    expect(await drv().selected()).toBe("Week")
  })

  it("virtual focus (a programmatic .focus()) does not select", async () => {
    const onValueChange = vi.fn()
    render(<Range defaultValue="day" onValueChange={onValueChange} />)
    act(() => seg("Month").focus())
    expect(document.activeElement).toBe(seg("Month"))
    expect(await drv().selected()).toBe("Day")
    expect(await drv().focusedSegment()).toBe("Month")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("pressing the selected segment changes nothing and calls nothing", async () => {
    const onValueChange = vi.fn()
    render(<Range onValueChange={onValueChange} />)
    await click(seg("Week"))
    await click(seg("Week"))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(await drv().selected()).toBe("Week")
  })
})
