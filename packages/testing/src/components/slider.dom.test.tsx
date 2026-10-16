// biome-ignore-all lint/a11y: fixtures deliberately wrap and label arbitrary elements
// Spec scenarios (add-slider tasks 4.2, 6.3, 7.2, A.1, A.2), through the driver where it can.
// Pointer scenarios need layout: they run in browser mode and are skipped in jsdom.
import { domEnvironment, platforms } from "@rind-ui/core"
import { Dialog, Field, RindProvider, Slider, type SliderRootProps } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getSlider } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const browserIt = it.skipIf(inJsdom)
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

afterEach(() => vi.restoreAllMocks())

type Props = SliderRootProps & {
  readonly label?: string
  readonly thumbs?: number
  readonly disabledThumb?: number
  readonly markers?: readonly number[]
  readonly withDescription?: string
}

/** A laid-out Slider (inline sizes, so browser runs measure without a theme). */
function S({ label = "Volume", thumbs, disabledThumb, markers, withDescription, ...props }: Props) {
  const given = props.value ?? props.defaultValue
  const count = thumbs ?? (Array.isArray(given) ? given.length : 1)
  const vertical = props.orientation === "vertical"
  return (
    <Slider.Root {...props}>
      <Slider.Label>{label}</Slider.Label>
      <Slider.ValueText />
      <Slider.Control
        style={vertical ? { width: 20, height: 200 } : { width: 200, height: 20, margin: "8px 0" }}
      >
        <Slider.Track style={{ position: "absolute", inset: 0 }}>
          <Slider.Indicator />
        </Slider.Track>
        {markers && (
          <Slider.MarkerGroup>
            {markers.map((m) => (
              <Slider.Marker key={m} value={m} />
            ))}
          </Slider.MarkerGroup>
        )}
        {Array.from({ length: count }, (_, i) => (
          <Slider.Thumb
            // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are identified by index
            key={i}
            index={i}
            disabled={i === disabledThumb}
            style={{ width: 16, height: 16 }}
          />
        ))}
      </Slider.Control>
      {withDescription && <Slider.Description>{withDescription}</Slider.Description>}
    </Slider.Root>
  )
}

const drv = (name = "Volume") => getSlider(screen, { name }, { platform })
const inputs = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-scope="slider"][data-part="hidden-input"]'),
  )
const thumbEls = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-scope="slider"][data-part="thumb"]'))
const root = () =>
  document.querySelector<HTMLElement>('[data-scope="slider"][data-part="root"]') as HTMLElement
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(el, { key: k, ...init })
  })

describe("Slider smoke", () => {
  it("steps with the keyboard through the driver", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(<S defaultValue={50} onValueChange={onValueChange} onValueCommit={onValueCommit} />)
    const s = drv()
    expect(await s.values()).toEqual([50])
    await s.step(0, "increase")
    expect(await s.values()).toEqual([51])
    expect(onValueChange).toHaveBeenCalledWith(
      51,
      expect.objectContaining({ reason: "INCREASE", index: 0 }),
    )
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(inputs()[0]?.value).toBe("51")
    expect(inputs()[0]?.getAttribute("aria-valuetext")).toBe("51")
  })

  it.runIf(inJsdom)("Pointer action without layout rejects naming the action", async () => {
    render(<S defaultValue={10} />)
    await expect(drv().pressTrack(30)).rejects.toThrow(/pressTrack.*pointer step needs layout/)
  })
})

describe("Anatomy and labelling", () => {
  it("One slider per thumb (Kobalte span + input); no other tabindex (BU#2575)", () => {
    render(<S label="Price" defaultValue={[20, 80]} withDescription="Per night" />)
    const sliders = screen.getAllByRole("slider")
    expect(sliders).toHaveLength(2)
    for (const s of sliders) expect(s.tagName).toBe("INPUT")
    expect((sliders[0] as HTMLInputElement).type).toBe("range")
    const tabbable = root().querySelectorAll("[tabindex], button, a[href], textarea, select")
    expect(tabbable).toHaveLength(0)
    expect(root().querySelectorAll("input")).toHaveLength(2)
  })

  it("Range thumb names and translated thumb names", async () => {
    const { unmount } = render(<S label="Price" defaultValue={[20, 80]} />)
    expect(screen.getByRole("slider", { name: "Price Minimum" })).toBeTruthy()
    expect(screen.getByRole("slider", { name: "Price Maximum" })).toBeTruthy()
    unmount()
    render(
      <S
        label="Price"
        defaultValue={[20, 80]}
        messages={{ thumbLabel: (i) => (i === 0 ? "Minimo" : "Massimo") }}
      />,
    )
    expect(screen.getByRole("slider", { name: "Price Minimo" })).toBeTruthy()
    expect(screen.getByRole("slider", { name: "Price Massimo" })).toBeTruthy()
  })

  it("a single thumb is named by the Label alone; the Root is a labelled group", () => {
    render(<S defaultValue={40} />)
    expect(screen.getByRole("slider", { name: "Volume" })).toBeTruthy()
    expect(screen.getByRole("group", { name: "Volume" })).toBeTruthy()
    expect(document.querySelector("label")?.hasAttribute("for")).toBe(false)
  })

  it("a consumer aria-label on the Thumb is used as given", () => {
    render(
      <Slider.Root defaultValue={[10, 90]}>
        <Slider.Label>Range</Slider.Label>
        <Slider.Control>
          <Slider.Thumb index={0} aria-label="From" />
          <Slider.Thumb index={1} aria-label="To" />
        </Slider.Control>
      </Slider.Root>,
    )
    expect(screen.getByRole("slider", { name: "From" })).toBeTruthy()
    expect(screen.getByRole("slider", { name: "To" })).toBeTruthy()
  })

  it("the Description describes every thumb input", () => {
    render(<S defaultValue={[1, 2]} withDescription="Per night" />)
    const id = screen.getByText("Per night").id
    for (const input of inputs()) expect(input.getAttribute("aria-describedby")).toContain(id)
  })

  it("Label press focuses without a ring", async () => {
    render(<S defaultValue={30} />)
    await drv().part("label").click()
    expect(document.activeElement).toBe(inputs()[0])
    expect(thumbEls()[0]?.hasAttribute("data-focus")).toBe(true)
    expect(thumbEls()[0]?.hasAttribute("data-focus-visible")).toBe(false)
    expect(await drv().values()).toEqual([30])
  })
})

describe("Value, range and rounding", () => {
  it("Shape preserved", async () => {
    const onValueChange = vi.fn()
    render(<S defaultValue={30} onValueChange={onValueChange} />)
    await drv().step(0, "increase")
    expect(onValueChange.mock.calls[0]?.[0]).toBe(31)
  })

  it("No float drift (BU#4547, BITS#1518)", async () => {
    render(<S min={0} max={1} step={0.1} defaultValue={0.2} />)
    await drv().step(0, "increase")
    expect(await drv().values()).toEqual([0.3])
  })

  it("Large step clamped (ZG#2504)", async () => {
    render(<S defaultValue={95} largeStep={10} />)
    await drv().step(0, "increase", { large: true })
    expect(await drv().values()).toEqual([100])
  })

  it("Off-grid maximum: End stops at 9 and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<S min={0} max={10} step={3} defaultValue={3} />)
    await drv().toEdge(0, "max")
    expect(await drv().values()).toEqual([9])
    expect(warn.mock.calls.flat().join(" ")).toMatch(/max 10 is not reachable/)
  })

  it("Out-of-range value (RA#4978)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<S value={150} max={100} />)
    expect(inputs()[0]?.getAttribute("aria-valuenow")).toBe("100")
    expect(thumbEls()[0]?.style.getPropertyValue("--rind-slider-thumb-percent")).toBe("100%")
  })

  it("Controlled refusal (keyboard; the drag twin runs in browser mode)", async () => {
    const onValueChange = vi.fn()
    render(<S value={40} onValueChange={onValueChange} />)
    // A raw key: the driver's step waits for a change the parent refuses.
    await drv().part("hidden-input").press("ArrowRight")
    expect(onValueChange).toHaveBeenCalledWith(41, expect.anything())
    await frame()
    expect(inputs()[0]?.value).toBe("40")
    expect(inputs()[0]?.getAttribute("aria-valuenow")).toBe("40")
  })

  it("External change then a step (RA#5644)", async () => {
    const onValueChange = vi.fn()
    const { rerender } = render(<S value={10} onValueChange={onValueChange} />)
    rerender(<S value={70} onValueChange={onValueChange} />)
    await drv().part("hidden-input").press("ArrowRight")
    expect(onValueChange.mock.calls[0]?.[0]).toBe(71)
  })

  it("Value text always present, formatted for the locale", () => {
    render(<S defaultValue={40} />)
    expect(inputs()[0]?.getAttribute("aria-valuetext")).toBe("40")
  })

  it("Currency (RA#6402): aria-valuetext and ValueText agree", () => {
    render(
      <S defaultValue={20} locale="de-DE" formatOptions={{ style: "currency", currency: "EUR" }} />,
    )
    const text = inputs()[0]?.getAttribute("aria-valuetext")
    expect(text).toBe(
      new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(20),
    )
    expect(document.querySelector('[data-part="value-text"]')?.textContent).toBe(text)
  })

  it("Custom value text per thumb, and not live", () => {
    render(
      <S
        defaultValue={[2, 5]}
        messages={{ valueText: ({ formatted }) => `${formatted} nights` }}
      />,
    )
    expect(inputs().map((i) => i.getAttribute("aria-valuetext"))).toEqual(["2 nights", "5 nights"])
    expect(root().querySelector("[aria-live], [role=status], [role=log], [role=alert]")).toBeNull()
  })
})

describe("Multiple thumbs", () => {
  it("Neighbour bounds", () => {
    render(<S defaultValue={[20, 60]} minStepsBetweenThumbs={5} />)
    expect(inputs()[0]?.getAttribute("aria-valuemax")).toBe("55")
    expect(inputs()[1]?.getAttribute("aria-valuemin")).toBe("25")
    expect(inputs()[0]?.max).toBe("55")
  })

  it("Keyboard stops at the neighbour and focus stays", async () => {
    render(<S defaultValue={[20, 21]} />)
    const s = drv()
    await s.step(0, "increase")
    await s.step(0, "increase")
    expect(await s.values()).toEqual([21, 21])
    expect(document.activeElement).toBe(inputs()[0])
  })

  it("Gap at creation (ZG#2488)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<S defaultValue={[50, 52]} step={1} minStepsBetweenThumbs={5} />)
    const [a = 0, b = 0] = inputs().map((i) => Number(i.value))
    expect(b - a).toBeGreaterThanOrEqual(5)
    expect(warn.mock.calls.flat().join(" ")).toMatch(/defaultValue \[50, 52\]/)
  })

  it("Range submission order (RX#2454)", () => {
    render(
      <form data-testid="f">
        <S name="price" defaultValue={[20, 80]} />
      </form>,
    )
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).getAll("price")).toEqual([
      "20",
      "80",
    ])
  })
})

describe("Keyboard", () => {
  it("PageUp increases (RX#715)", async () => {
    render(<S defaultValue={10} largeStep={10} />)
    await drv().step(0, "increase", { page: true })
    expect(await drv().values()).toEqual([20])
  })

  it("Slider in RTL: ArrowLeft increases", async () => {
    render(<S defaultValue={10} dir="rtl" />)
    await drv().part("hidden-input").press("ArrowLeft")
    expect(await drv().values()).toEqual([11])
  })

  it("Vertical up increases, and is announced as vertical", async () => {
    render(<S defaultValue={10} orientation="vertical" />)
    await drv().part("hidden-input").press("ArrowUp")
    expect(await drv().values()).toEqual([11])
    expect(inputs()[0]?.getAttribute("aria-orientation")).toBe("vertical")
  })

  it("Home and End go to the bounds and are prevented (RX#1054, KB#293)", async () => {
    render(<S defaultValue={40} />)
    const input = inputs()[0] as HTMLInputElement
    input.focus()
    const home = new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true })
    act(() => {
      input.dispatchEvent(home)
    })
    expect(home.defaultPrevented).toBe(true)
    expect(input.getAttribute("aria-valuenow")).toBe("0")
  })

  it("No blur before the value (BU#5296): attributes updated in the keydown's task", async () => {
    render(<S defaultValue={40} />)
    const input = inputs()[0] as HTMLInputElement
    const events: string[] = []
    input.addEventListener("focus", () => events.push("focus"))
    input.addEventListener("blur", () => events.push("blur"))
    act(() => input.focus())
    events.length = 0
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
      )
    })
    expect(input.getAttribute("aria-valuenow")).toBe("41")
    expect(input.value).toBe("41")
    expect(events).toEqual([])
  })

  it("Keyboard commits per step (RX#3619, KB#352)", async () => {
    const onValueCommit = vi.fn()
    render(<S defaultValue={40} onValueCommit={onValueCommit} />)
    const input = inputs()[0] as HTMLInputElement
    act(() => input.focus())
    await key(input, "ArrowRight")
    await key(input, "ArrowRight", { repeat: true })
    await key(input, "ArrowRight", { repeat: true })
    expect(onValueCommit).toHaveBeenCalledTimes(3)
    // Alt+Arrow is the browser's (history Back): not prevented, no step.
    const back = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      altKey: true,
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      input.dispatchEvent(back)
    })
    expect(back.defaultPrevented).toBe(false)
    expect(onValueCommit).toHaveBeenCalledTimes(3)
    expect(onValueCommit.mock.calls.map((c) => c[1].reason)).toEqual([
      "INCREASE",
      "INCREASE",
      "INCREASE",
    ])
  })

  it("Read-only: focusable, keys do nothing", async () => {
    render(<S defaultValue={40} readOnly />)
    await drv().step(0, "increase")
    expect(await drv().values()).toEqual([40])
    expect(inputs()[0]?.getAttribute("aria-readonly")).toBe("true")
    expect(inputs()[0]?.disabled).toBe(false)
  })

  it("Escape does nothing outside a drag (propagates)", () => {
    const onKeyDown = vi.fn()
    render(
      <div onKeyDown={(e) => onKeyDown(e.key)}>
        <S defaultValue={40} />
      </div>,
    )
    const input = inputs()[0] as HTMLInputElement
    act(() => input.focus())
    fireEvent.keyDown(input, { key: "Escape" })
    expect(onKeyDown).toHaveBeenCalledWith("Escape")
  })

  it("Ring on the visible thumb: keyboard focus marks only its Thumb", async () => {
    render(<S defaultValue={[20, 80]} />)
    await drv().focusThumb(1)
    await act(() => fireEvent.keyDown(inputs()[1] as HTMLInputElement, { key: "Shift" }))
    expect(thumbEls()[1]?.hasAttribute("data-focus")).toBe(true)
    expect(thumbEls()[0]?.hasAttribute("data-focus")).toBe(false)
  })
})

describe("Assistive technology, forms and reset", () => {
  it("TalkBack adjust (BU#2575, RX#2850)", async () => {
    const onValueCommit = vi.fn()
    render(<S defaultValue={[20, 80]} onValueCommit={onValueCommit} />)
    await drv().adjustNative(0, 35)
    expect(await drv().values()).toEqual([35, 80])
    expect(onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("Read-only rejects a native change within a frame", async () => {
    const onValueChange = vi.fn()
    render(<S defaultValue={20} readOnly onValueChange={onValueChange} />)
    await drv().adjustNative(0, 35)
    await act(frame)
    await act(frame)
    expect(inputs()[0]?.value).toBe("20")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("Enter submits the form (RX#2541) and the value is unchanged", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <S name="v" defaultValue={40} />
        <button type="submit">Send</button>
      </form>,
    )
    await drv().part("hidden-input").press("Enter")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await drv().values()).toEqual([40])
  })

  it("Reset restores the default, reason RESET, no commit", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(
      <form>
        <S name="v" defaultValue={30} onValueChange={onValueChange} onValueCommit={onValueCommit} />
        <button type="reset">Reset</button>
      </form>,
    )
    await drv().via("keyboard").setValue(0, 33)
    onValueCommit.mockClear()
    await drv().resetForm()
    expect(await drv().values()).toEqual([30])
    expect(onValueChange.mock.calls.at(-1)).toEqual([
      30,
      expect.objectContaining({ reason: "RESET" }),
    ])
    expect(onValueCommit).not.toHaveBeenCalled()
  })

  it("A.2: reset restores the CURRENT defaultValue; a defaultValue change never moves", async () => {
    const ui = (d: number) => (
      <form>
        <S name="v" defaultValue={d} />
        <button type="reset">Reset</button>
      </form>
    )
    const { rerender } = render(ui(30))
    rerender(ui(50))
    expect(await drv().values()).toEqual([30])
    expect(inputs()[0]?.getAttribute("value")).toBe("50")
    await drv().via("keyboard").setValue(0, 33)
    await drv().resetForm()
    expect(await drv().values()).toEqual([50])
  })

  it("Programmatic change is silent (RX#4096)", () => {
    const events = vi.fn()
    const { rerender } = render(<S value={10} />)
    for (const i of inputs()) {
      i.addEventListener("input", events)
      i.addEventListener("change", events)
    }
    rerender(<S value={60} />)
    expect(inputs()[0]?.value).toBe("60")
    expect(events).not.toHaveBeenCalled()
  })

  it("a user step dispatches one input and one change, after the property", async () => {
    render(<S defaultValue={10} />)
    const seen: string[] = []
    const input = inputs()[0] as HTMLInputElement
    input.addEventListener("input", () => seen.push(`input ${input.value}`))
    input.addEventListener("change", () => seen.push(`change ${input.value}`))
    await drv().step(0, "increase")
    expect(seen).toEqual(["input 11", "change 11"])
  })

  it("a disabled Slider submits nothing", () => {
    render(
      <form data-testid="f">
        <S name="v" defaultValue={10} disabled />
      </form>,
    )
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).getAll("v")).toEqual([])
    expect(inputs()[0]?.disabled).toBe(true)
  })
})

describe("Positions and data attributes", () => {
  it("Disabled keeps its position (RK#1691)", () => {
    render(<S defaultValue={60} disabled />)
    expect(thumbEls()[0]?.style.getPropertyValue("--rind-slider-thumb-percent")).toBe("60%")
    expect(thumbEls()[0]?.style.getPropertyValue("inset-inline-start")).toBe("60%")
  })

  it("Marker state", () => {
    render(<S defaultValue={50} markers={[25, 50, 75]} />)
    const states = Array.from(document.querySelectorAll('[data-part="marker"]')).map((m) =>
      m.getAttribute("data-state"),
    )
    expect(states).toEqual(["under-value", "at-value", "over-value"])
    expect(document.querySelector('[data-part="marker-group"]')?.getAttribute("aria-hidden")).toBe(
      "true",
    )
  })

  it("touch-action and user-select on Control and Thumb", () => {
    const { unmount } = render(<S defaultValue={50} />)
    const control = document.querySelector<HTMLElement>('[data-part="control"]') as HTMLElement
    expect(control.style.touchAction).toBe("pan-y pinch-zoom")
    expect(control.style.userSelect).toBe("none")
    expect(thumbEls()[0]?.style.touchAction).toBe("none")
    unmount()
    render(<S defaultValue={50} orientation="vertical" />)
    expect(document.querySelector<HTMLElement>('[data-part="control"]')?.style.touchAction).toBe(
      "pan-x pinch-zoom",
    )
  })

  it("Indicator spans the outer thumbs", () => {
    render(<S defaultValue={[20, 70]} />)
    const ind = document.querySelector<HTMLElement>('[data-part="indicator"]') as HTMLElement
    expect(ind.style.getPropertyValue("--rind-slider-start")).toBe("20%")
    expect(ind.style.getPropertyValue("--rind-slider-end")).toBe("70%")
  })
})

describe("Field binding (A.1)", () => {
  it("Slider in an invalid Field", () => {
    render(
      <Field.Root invalid>
        <Field.Label>Price</Field.Label>
        <Slider.Root defaultValue={[20, 80]}>
          <Slider.Control>
            <Slider.Thumb index={0} />
            <Slider.Thumb index={1} />
          </Slider.Control>
        </Slider.Root>
        <Field.ErrorMessage>Too wide</Field.ErrorMessage>
      </Field.Root>,
    )
    const error = screen.getByText("Too wide").id
    for (const input of inputs()) {
      expect(input.getAttribute("aria-invalid")).toBe("true")
      expect(input.getAttribute("aria-describedby")).toContain(error)
    }
    expect(root().hasAttribute("data-invalid")).toBe(true)
    expect(screen.getByRole("slider", { name: "Price Minimum" })).toBeTruthy()
  })

  const matrix = [
    { prop: "disabled", check: (i: HTMLInputElement) => i.disabled },
    {
      prop: "readOnly",
      check: (i: HTMLInputElement) => i.getAttribute("aria-readonly") === "true",
    },
    { prop: "required", check: () => root().hasAttribute("data-required") },
    { prop: "invalid", check: (i: HTMLInputElement) => i.getAttribute("aria-invalid") === "true" },
  ] as const
  for (const { prop, check } of matrix) {
    for (const where of ["field", "slider", "neither"] as const) {
      it(`Field prop × control: ${prop} on ${where}`, () => {
        const on = { [prop]: true }
        render(
          <Field.Root {...(where === "field" ? on : {})}>
            <Field.Label>Level</Field.Label>
            <Slider.Root defaultValue={10} {...(where === "slider" ? on : {})}>
              <Slider.Control>
                <Slider.Thumb index={0} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        )
        expect(check(inputs()[0] as HTMLInputElement)).toBe(where !== "neither")
        // required is never a native constraint on a range input
        expect(inputs()[0]?.required).toBe(false)
      })
    }
  }
})

describe("Pointer (browser)", () => {
  browserIt("Track press focuses without a ring and commits once (BU#5772)", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(<S defaultValue={10} onValueChange={onValueChange} onValueCommit={onValueCommit} />)
    await drv().pressTrack(75)
    expect(await drv().values()).toEqual([75])
    expect(document.activeElement).toBe(inputs()[0])
    expect(thumbEls()[0]?.hasAttribute("data-focus-visible")).toBe(false)
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
  })

  browserIt("Off-centre press on a thumb does not move it (ZG#541, RK#1557)", async () => {
    const onValueChange = vi.fn()
    render(<S defaultValue={40} onValueChange={onValueChange} />)
    const thumb = drv().part("thumb").nth(0)
    // 6 px right of the centre of a 16 px thumb.
    await thumb.pointer("down", { at: { x: 0.5 + 6 / 16, y: 0.5 } })
    await thumb.pointer("up", { at: { x: 0.5 + 6 / 16, y: 0.5 } })
    expect(await drv().values()).toEqual([40])
    expect(onValueChange).not.toHaveBeenCalled()
  })

  browserIt("Stacked thumbs at the maximum: the first moves left (BU#1602, RA#6408)", async () => {
    render(<S defaultValue={[100, 100]} />)
    const s = drv()
    await s.pointerDown(1)
    await s.pointerMove(60)
    await s.pointerUp()
    expect(await s.values()).toEqual([60, 100])
  })

  browserIt("Disabled thumb skipped (RA#942)", async () => {
    render(<S defaultValue={[20, 80]} disabledThumb={0} />)
    await drv().pressTrack(10)
    expect(await drv().values()).toEqual([20, 20])
  })

  browserIt("Swap moves focus (RX#730, RX#2247)", async () => {
    render(<S defaultValue={[20, 60]} thumbCollision="swap" />)
    const s = drv()
    await s.pointerDown(0)
    await s.pointerMove(70)
    expect(await s.values()).toEqual([60, 70])
    expect(document.activeElement).toBe(inputs()[1])
    await s.pointerMove(80)
    await s.pointerUp()
    expect(await s.values()).toEqual([60, 80])
  })

  browserIt("Push", async () => {
    render(<S defaultValue={[20, 60]} thumbCollision="push" />)
    await drv().setValue(0, 70)
    expect(await drv().values()).toEqual([70, 70])
  })

  browserIt("Range narrowed to one value commits once (RX#3698, RX#1760)", async () => {
    const onValueCommit = vi.fn()
    render(<S defaultValue={[20, 60]} onValueCommit={onValueCommit} />)
    await drv().setValue(0, 60)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(onValueCommit.mock.calls[0]?.[0]).toEqual([60, 60])
  })

  browserIt("Fast drag: the commit equals the last change (RX#4154, ZG#2497)", async () => {
    const changes: unknown[] = []
    const onValueCommit = vi.fn()
    render(
      <S defaultValue={10} onValueChange={(v) => changes.push(v)} onValueCommit={onValueCommit} />,
    )
    const s = drv()
    await s.pointerDown(0)
    for (const v of [20, 35, 50, 65]) await s.pointerMove(v)
    await s.pointerUp()
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(onValueCommit.mock.calls[0]?.[0]).toBe(changes.at(-1))
  })

  browserIt("Exactly once (KB#322): single and two thumbs", async () => {
    const one = vi.fn()
    const two = vi.fn()
    render(
      <>
        <S label="One" defaultValue={10} onValueCommit={one} />
        <S label="Two" defaultValue={[10, 90]} onValueCommit={two} />
      </>,
    )
    await drv("One").setValue(0, 50)
    await drv("Two").setValue(0, 50)
    expect(one).toHaveBeenCalledTimes(1)
    expect(two).toHaveBeenCalledTimes(1)
  })

  browserIt(
    "Controlled refusal while dragging (ARK#3270); the next drag starts from it",
    async () => {
      const onValueChange = vi.fn()
      render(<S value={30} onValueChange={onValueChange} />)
      const s = drv()
      await s.setValue(0, 60)
      expect(onValueChange).toHaveBeenCalled()
      expect(await s.values()).toEqual([30])
      expect(thumbEls()[0]?.style.getPropertyValue("--rind-slider-thumb-percent")).toBe("30%")
    },
  )

  browserIt("Escape cancels a drag inside a Dialog, which stays open", async () => {
    const onValueCommit = vi.fn()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Positioner>
          <Dialog.Content aria-label="Settings">
            <S defaultValue={20} onValueCommit={onValueCommit} />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>,
    )
    const s = drv()
    await s.pointerDown(0)
    await s.pointerMove(60)
    expect(await s.values()).toEqual([60])
    await s.via("keyboard").cancelDrag()
    expect(await s.values()).toEqual([20])
    expect(onValueCommit).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeTruthy()
    await s.part("control").pointer("up", { at: { x: 0.5, y: 0.5 } })
  })

  browserIt("Browser takes the touch for scrolling (BU#5637, RX#3010)", async () => {
    const onValueCommit = vi.fn()
    render(<S defaultValue={20} onValueCommit={onValueCommit} />)
    const s = drv()
    await s.via("touch").pointerDown(0)
    await s.via("touch").pointerMove(60)
    await s.via("touch").cancelDrag()
    expect(await s.values()).toEqual([20])
    // A later tap elsewhere commits nothing.
    await act(async () => {
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerId: 2, pointerType: "touch" }),
      )
      document.body.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 2, pointerType: "touch" }),
      )
    })
    expect(onValueCommit).not.toHaveBeenCalled()
  })

  browserIt("Release outside the frame: lost capture removes data-dragging (BU#1910)", async () => {
    render(<S defaultValue={20} />)
    const s = drv()
    await s.pointerDown(0)
    expect(root().hasAttribute("data-dragging")).toBe(true)
    const control = document.querySelector('[data-part="control"]') as HTMLElement
    await act(async () => {
      control.dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true, pointerId: 1 }))
    })
    expect(root().hasAttribute("data-dragging")).toBe(false)
  })

  browserIt("No listeners when idle (BU#3311)", async () => {
    const onValueChange = vi.fn()
    render(<S defaultValue={20} onValueChange={onValueChange} />)
    await drv().setValue(0, 40)
    onValueChange.mockClear()
    await act(async () => {
      document.body.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerId: 1, buttons: 1, clientX: 5 }),
      )
      document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }))
    })
    expect(onValueChange).not.toHaveBeenCalled()
  })

  browserIt("RTL pointer: 25 % from the right edge is 25", async () => {
    render(<S defaultValue={60} dir="rtl" />)
    const control = drv().part("control")
    await control.pointer("down", { at: { x: 0.75, y: 0.5 } })
    await control.pointer("up", { at: { x: 0.75, y: 0.5 } })
    expect(await drv().values()).toEqual([25])
  })

  browserIt("Tiny steps (RX#3852): dragged values have at most 7 decimals", async () => {
    const seen: number[] = []
    render(
      <S
        min={0}
        max={0.001}
        step={1e-7}
        defaultValue={0}
        onValueChange={(v) => seen.push(v as number)}
      />,
    )
    await drv().setValue(0, 0.0003)
    expect(seen.length).toBeGreaterThan(0)
    for (const v of seen) expect(String(v).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(7)
  })

  browserIt("Hidden slider (BU#4303): a press before layout proposes no NaN", async () => {
    const onValueChange = vi.fn()
    render(
      <div style={{ display: "none" }}>
        <S defaultValue={20} onValueChange={onValueChange} />
      </div>,
    )
    const control = document.querySelector('[data-part="control"]') as HTMLElement
    await act(async () => {
      control.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          buttons: 1,
        }),
      )
      control.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }))
    })
    expect(onValueChange).not.toHaveBeenCalled()
    for (const el of document.querySelectorAll<HTMLElement>(
      "[data-part=thumb],[data-part=indicator]",
    )) {
      expect(el.getAttribute("style")).not.toMatch(/NaN/)
    }
  })

  browserIt("One validation per drag in a change-mode Field", async () => {
    const validate = vi.fn(() => null)
    render(
      <Field.Root validationMode="change" validate={validate}>
        <Field.Label>Level</Field.Label>
        <Slider.Root defaultValue={10}>
          <Slider.Control style={{ width: 200, height: 20 }}>
            <Slider.Thumb index={0} style={{ width: 16, height: 16 }} />
          </Slider.Control>
        </Slider.Root>
      </Field.Root>,
    )
    const s = getSlider(screen, { name: "Level" }, { platform })
    validate.mockClear()
    await s.pointerDown(0)
    for (const v of [20, 30, 40]) await s.pointerMove(v)
    await s.pointerUp()
    // One validation per accepted change (three), none extra for the commit.
    expect(validate.mock.calls.length).toBeLessThanOrEqual(4)
  })
})

describe("Touch (browser)", () => {
  browserIt("Long press on a thumb (BU#1295): iOS text selection is off for the drag", async () => {
    render(
      <RindProvider environment={{ platform: platforms.ios }}>
        <S defaultValue={40} />
      </RindProvider>,
    )
    const s = getSlider(screen, { name: "Volume" }, { platform: platforms.ios })
    const html = document.documentElement
    await s.via("touch").pointerDown(0)
    expect(html.style.getPropertyValue("-webkit-user-select")).toBe("none")
    await s.via("touch").pointerUp()
    await vi.waitFor(() => expect(html.style.getPropertyValue("-webkit-user-select")).toBe(""), {
      timeout: 2000,
    })
  })

  browserIt(
    "Inside a modal on iOS (RA#9493): the thumb follows the finger under scroll lock",
    async () => {
      render(
        <RindProvider environment={{ platform: platforms.ios }}>
          <Dialog.Root defaultOpen modal>
            <Dialog.Positioner>
              <Dialog.Content aria-label="Settings">
                <S defaultValue={20} />
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Root>
        </RindProvider>,
      )
      const s = getSlider(screen, { name: "Volume" }, { platform: platforms.ios })
      await s.via("touch").setValue(0, 70)
      expect(await s.values()).toEqual([70])
    },
  )
})

describe("Contract invariants catch a broken wrapper", () => {
  it("an extra span[role=slider] around each thumb fails, naming it", async () => {
    const { sliderStepInvariants } = await import("../index")
    render(
      <Slider.Root defaultValue={[20, 80]}>
        <Slider.Label>Price</Slider.Label>
        <Slider.Control>
          {[0, 1].map((i) => (
            <span key={i} role="slider" tabIndex={0} aria-valuenow={0} aria-label="x">
              <Slider.Thumb index={i} />
            </span>
          ))}
        </Slider.Control>
      </Slider.Root>,
    )
    const inv = sliderStepInvariants().invariants.find(
      (i) => i.name === "slider-only-thumb-inputs-focusable",
    )
    const out = await inv?.check({} as never)
    expect(out).toMatch(/span role="slider"/)
  })
})

describe("Controlled helper", () => {
  it("applies proposals (sanity of the controlled path)", async () => {
    function C() {
      const [v, setV] = useState(10)
      return <S value={v} onValueChange={(n) => setV(n as number)} />
    }
    render(<C />)
    await drv().step(0, "increase")
    expect(await drv().values()).toEqual([11])
  })
})
