// Color Wheel (React) in a real browser (the ring needs layout): a press on the ring sets the
// hue and focuses the input; a press in the centre does nothing.
import { ColorWheel, RindProvider } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getColorWheel } from "../index"

function setup() {
  const onValueChange = vi.fn()
  render(
    <RindProvider locale="en-US">
      <ColorWheel.Root defaultValue="hsl(0 100% 50%)" onValueChange={onValueChange}>
        <ColorWheel.Label>Hue</ColorWheel.Label>
        <ColorWheel.Track style={{ width: 200, height: 200, borderRadius: "50%" }}>
          <ColorWheel.Thumb>
            <ColorWheel.Input />
          </ColorWheel.Thumb>
        </ColorWheel.Track>
      </ColorWheel.Root>
    </RindProvider>,
  )
  return { onValueChange, d: () => getColorWheel(document.body, { label: "Hue" }) }
}

describe("React ColorWheel pointer", () => {
  it("a press on the ring sets the hue and focuses the input", async () => {
    const t = setup()
    await t.d().via("pointer").setHue(90)
    await vi.waitFor(async () => expect(await t.d().hue()).toBe(90))
    expect(document.activeElement?.getAttribute("data-part")).toBe("input")
  })

  it("a press in the centre does nothing", async () => {
    const t = setup()
    const track = document.querySelector('[data-part="track"]') as HTMLElement
    const box = track.getBoundingClientRect()
    act(() => {
      track.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: box.left + box.width / 2 + 20,
          clientY: box.top + box.height / 2,
          pointerId: 1,
          button: 0,
          buttons: 1,
          pointerType: "mouse",
        }),
      )
    })
    expect(await t.d().isDragging()).toBe(false)
    expect(t.onValueChange).not.toHaveBeenCalled()
  })
})
