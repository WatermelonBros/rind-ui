// Angle Slider (React) in a real browser (pointer angles need layout): a press sets the angle
// around the Control's centre and focuses the input; a touch does the same; Escape cancels a
// drag back to the value at the press.
import { AngleSlider, RindProvider } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getAngleSlider } from "../index"

function setup(onValueCommit = vi.fn()) {
  render(
    <RindProvider locale="en-US">
      <AngleSlider.Root defaultValue={0} onValueCommit={onValueCommit}>
        <AngleSlider.Label>Heading</AngleSlider.Label>
        <AngleSlider.Control style={{ width: 160, height: 160, borderRadius: "50%" }}>
          <AngleSlider.Thumb>
            <AngleSlider.Input />
          </AngleSlider.Thumb>
        </AngleSlider.Control>
      </AngleSlider.Root>
    </RindProvider>,
  )
  return { onValueCommit, d: () => getAngleSlider(document.body, { label: "Heading" }) }
}

describe("React AngleSlider pointer", () => {
  it("a press sets the angle around the centre and focuses the input", async () => {
    const t = setup()
    await t.d().via("pointer").setAngle(90)
    await vi.waitFor(async () => expect(await t.d().value()).toBe(90))
    expect(document.activeElement?.getAttribute("data-part")).toBe("input")
    expect(t.onValueCommit.mock.lastCall?.[0]).toBe(90)
    await t.d().via("touch").setAngle(180)
    await vi.waitFor(async () => expect(await t.d().value()).toBe(180))
  })

  it("Escape during a drag restores the value at the press", async () => {
    const t = setup()
    const control = document.querySelector('[data-part="control"]') as HTMLElement
    const box = control.getBoundingClientRect()
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    act(() => {
      control.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: cx + 60,
          clientY: cy,
          pointerId: 1,
          button: 0,
          buttons: 1,
          pointerType: "mouse",
        }),
      )
    })
    await vi.waitFor(async () => expect(await t.d().isDragging()).toBe(true))
    expect(await t.d().value()).toBe(90)
    const input = document.querySelector('[data-part="input"]') as HTMLInputElement
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    await vi.waitFor(async () => expect(await t.d().isDragging()).toBe(false))
    expect(await t.d().value()).toBe(0)
  })
})
