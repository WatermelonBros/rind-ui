// Color Slider pointer behaviour in real browsers (spec "Track And Thumb Appearance"): the
// Root is the pointer surface without a Control (design request to add-slider), vertical
// (zag#3010) and right-to-left (zag#2666) gradients agree with the thumb.
import { ColorSlider, Slider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

const press = async (el: Element, fx: number, fy: number) => {
  const r = el.getBoundingClientRect()
  const x = r.left + fx * r.width
  const y = r.top + fy * r.height
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
    buttons: 1,
    pointerType: "mouse",
    isPrimary: true,
  }
  el.dispatchEvent(new PointerEvent("pointerdown", init))
  document.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }))
}

describe("pointer", () => {
  it("a plain Slider's Root without a Control does not start a drag", async () => {
    render(
      <Slider.Root aria-label="Volume" defaultValue={10} style={{ width: 200, height: 20 }}>
        <Slider.Track style={{ position: "absolute", inset: 0 }}>
          <Slider.Thumb index={0} style={{ width: 10, height: 10 }} />
        </Slider.Track>
      </Slider.Root>,
    )
    await press(screen.getByRole("group", { name: "Volume" }), 0.9, 0.5)
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("10")
  })

  it("no Control: the Root is the pointer surface", async () => {
    render(
      <ColorSlider.Root
        channel="hue"
        defaultValue="hsb(0, 100%, 100%)"
        style={{ width: 360, height: 20 }}
      >
        <ColorSlider.Track style={{ position: "absolute", inset: 0 }}>
          <ColorSlider.Thumb style={{ width: 10, height: 10 }} />
        </ColorSlider.Track>
      </ColorSlider.Root>,
    )
    const root = screen.getByRole("group", { name: "Hue" })
    await press(root, 0.5, 0.5)
    expect(Number(screen.getByRole("slider").getAttribute("aria-valuenow"))).toBeCloseTo(180, -1)
  })

  it("vertical: near the top is near 360 and the gradient runs to top (zag#3010)", async () => {
    render(
      <ColorSlider.Root channel="hue" orientation="vertical" style={{ width: 20, height: 200 }}>
        <ColorSlider.Track style={{ position: "absolute", inset: 0 }}>
          <ColorSlider.Thumb style={{ width: 10, height: 10 }} />
        </ColorSlider.Track>
      </ColorSlider.Root>,
    )
    await press(screen.getByRole("group", { name: "Hue" }), 0.5, 0.02)
    expect(Number(screen.getByRole("slider").getAttribute("aria-valuenow"))).toBeGreaterThan(340)
    const track = document.querySelector<HTMLElement>('[data-part="track"]')
    expect(track?.style.backgroundImage).toContain("to top")
  })

  it("RTL alpha pressed at the left end is 1 (zag#2666)", async () => {
    render(
      <ColorSlider.Root
        channel="alpha"
        dir="rtl"
        defaultValue="#33669900"
        style={{ width: 200, height: 20 }}
      >
        <ColorSlider.Track style={{ position: "absolute", inset: 0 }}>
          <ColorSlider.Thumb style={{ width: 10, height: 10 }} />
        </ColorSlider.Track>
      </ColorSlider.Root>,
    )
    await press(screen.getByRole("group", { name: "Alpha" }), 0.005, 0.5)
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("1")
    expect(
      document.querySelector<HTMLElement>('[data-part="track"]')?.style.backgroundImage,
    ).toContain("to left")
  })

  it("a press on the Label does not start a drag", async () => {
    render(
      <ColorSlider.Root
        channel="hue"
        defaultValue="hsb(10, 100%, 100%)"
        style={{ width: 360, height: 40 }}
      >
        <ColorSlider.Label>Hue label</ColorSlider.Label>
        <ColorSlider.Track style={{ position: "absolute", inset: "20px 0 0 0" }}>
          <ColorSlider.Thumb style={{ width: 10, height: 10 }} />
        </ColorSlider.Track>
      </ColorSlider.Root>,
    )
    await userEvent.click(screen.getByText("Hue label"))
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("10")
  })
})
