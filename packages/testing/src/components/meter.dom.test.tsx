// Meter through its driver (add-meter 4.2, 3.1): queries, zones, no role fallback, no live
// region, the name and value rules. Runs in jsdom and in real browsers.
import { Meter, type MeterRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getMeter } from "../index"

afterEach(() => vi.restoreAllMocks())

function Battery(props: Partial<MeterRootProps>) {
  return (
    <Meter.Root value={10} low={20} high={80} optimum={100} {...props}>
      <Meter.Label>Battery</Meter.Label>
      <Meter.ValueText />
      <Meter.Track>
        <Meter.Indicator />
      </Meter.Track>
    </Meter.Root>
  )
}

describe("Meter driver", () => {
  it("reads value, text, percent, name and zone (spec: Driver reads the zone)", async () => {
    render(<Battery />)
    const m = getMeter(screen, { name: "Battery" })
    expect(await m.name()).toBe("Battery")
    expect(await m.value()).toBe(10)
    expect(await m.valueText()).toBe("10%")
    expect(await m.percent()).toBe(10)
    expect(await m.zone()).toBe("even-less-good")
  })

  it("middle value: suboptimum; no thresholds: no zone", async () => {
    const { rerender } = render(<Battery value={50} />)
    const m = getMeter(screen, { name: "Battery" })
    expect(await m.zone()).toBe("suboptimum")
    rerender(
      <Meter.Root value={50}>
        <Meter.Label>Battery</Meter.Label>
      </Meter.Root>,
    )
    expect(await m.zone()).toBeUndefined()
    expect(document.querySelector("[data-zone]")).toBeNull()
  })

  it("role is exactly meter and axe finds no aria-allowed-attr (RS#6627)", async () => {
    render(<Battery />)
    expect(screen.getByRole("meter").getAttribute("role")).toBe("meter")
    const { violations } = await axe.run(document.body, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("missing value: a development error and aria-valuenow = min", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    // A consumer may still forget it at runtime (plain JS, an API that returned nothing).
    render(<Battery value={undefined as unknown as number} min={5} />)
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("5")
    expect(error.mock.calls.some((c) => /meter: value is required/.test(String(c[0])))).toBe(true)
  })

  it("live value: no aria-live anywhere, nothing announced", async () => {
    const { rerender } = render(<Battery value={10} />)
    const m = getMeter(screen, { name: "Battery" })
    for (let v = 11; v < 20; v += 1) rerender(<Battery value={v} />)
    const root = screen.getByRole("meter")
    expect(root.closest("[aria-live]")).toBeNull()
    expect(root.querySelector("[aria-live]")).toBeNull()
    expect(await m.announcements()).toEqual([])
  })

  it("NVDA filler span; Root data attributes", () => {
    render(<Battery value={3} max={5} />)
    const root = screen.getByRole("meter")
    expect(root.lastElementChild?.getAttribute("role")).toBe("presentation")
    expect(root.dataset).toMatchObject({ value: "3", min: "0", max: "5" })
  })

  it("unnamed: a development error; aria-hidden is fine", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { unmount } = render(<Meter.Root value={1} aria-hidden="true" />)
    expect(error).not.toHaveBeenCalled()
    unmount()
    render(<Meter.Root value={1} />)
    expect(error.mock.calls[0]?.[0]).toMatch(/meter: Root has no accessible name/)
  })
})
