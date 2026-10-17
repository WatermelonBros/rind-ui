// Color Area pointer behaviour in real browsers (spec "Pointer Interaction", "Drag
// Lifecycle"): press jumps in one write, thumb grab without a jump, RTL, Escape while
// dragging, and pointer-drag's 2D mode.
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ColorArea, type ColorAreaRootProps, getColorArea } from "./color-parts"

afterEach(() => vi.restoreAllMocks())

const Area = (props: ColorAreaRootProps) => (
  <ColorArea.Root
    aria-label="Fill"
    defaultValue="hsb(200, 50%, 50%)"
    style={{ width: 200, height: 100 }}
    {...props}
  >
    <ColorArea.Background style={{ position: "absolute", inset: 0 }} />
    <ColorArea.Thumb style={{ width: 12, height: 12 }} />
  </ColorArea.Root>
)

describe("pointer", () => {
  it("a press at the top-right corner sets both channels in one change (kobalte#592)", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(<Area onValueChange={onValueChange} onValueCommit={onValueCommit} />)
    const area = getColorArea(screen, { name: "Fill" }, { modality: "pointer" })
    await area.pressAt({ x: 1, y: 1 })
    expect(await area.channels()).toEqual({
      x: { channel: "saturation", value: 100 },
      y: { channel: "brightness", value: 100 },
    })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    // Focus went to the x input, with pointer modality (no ring).
    const x = screen.getByRole("slider", { name: "Fill Saturation" })
    expect(document.activeElement).toBe(x)
    expect(x.hasAttribute("data-focus-visible")).toBe(false)
  })

  it("RTL: 30 px from the right edge is 10 % of x", async () => {
    render(<Area dir="rtl" style={{ width: 300, height: 100 }} />)
    const area = getColorArea(screen, { name: "Fill" }, { modality: "pointer" })
    await area.pressAt({ x: 0.1, y: 0.5 })
    expect((await area.channels()).x.value).toBe(10)
  })

  it("grabbing the thumb keeps the value; a drag moves it", async () => {
    const onValueChange = vi.fn()
    render(<Area onValueChange={onValueChange} />)
    const area = getColorArea(screen, { name: "Fill" }, { modality: "pointer" })
    await area.pointerDown()
    expect(onValueChange).not.toHaveBeenCalled()
    await area.pointerMove({ x: 0.75, y: 0.5 })
    expect((await area.channels()).x.value).toBeCloseTo(75, 0)
    await area.pointerUp()
    expect(await area.isDragging()).toBe(false)
  })

  it("Escape while dragging restores the press colour, no commit (react-spectrum#2252)", async () => {
    const onValueCommit = vi.fn()
    render(<Area onValueCommit={onValueCommit} />)
    const area = getColorArea(screen, { name: "Fill" }, { modality: "pointer" })
    await area.pointerDown({ x: 0.9, y: 0.9 })
    await area.pointerMove({ x: 0.1, y: 0.1 })
    const escapeKey = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
    document.activeElement?.dispatchEvent(escapeKey)
    await area.pointerUp().catch(() => {})
    expect(escapeKey.defaultPrevented).toBe(true)
    expect(onValueCommit).not.toHaveBeenCalled()
    expect((await area.channels()).x.value).toBe(50)
  })
})
