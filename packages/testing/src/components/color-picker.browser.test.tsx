// Color Picker scenarios that need a real browser (add-color-picker 9.2): the picker in a Dialog
// (open → dismiss → open → press inside; zag#3043, ark#3414) and a slider drag released outside
// the Popover (react-spectrum#3994).
import { ColorPicker, Dialog } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { getColorPicker } from "../index"

function Picker(props: { readonly onValueCommit?: () => void }) {
  return (
    <ColorPicker.Root defaultValue="hsb(0, 100%, 100%)" {...props}>
      <ColorPicker.Label>Fill</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Trigger>
          <ColorPicker.ValueSwatch style={{ width: 20, height: 20 }} />
        </ColorPicker.Trigger>
      </ColorPicker.Control>
      <ColorPicker.Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content style={{ width: 240, padding: 8, background: "white" }}>
            <ColorPicker.ChannelSlider channel="hue" style={{ width: 200, height: 20 }}>
              <ColorPicker.ChannelSliderTrack style={{ position: "absolute", inset: 0 }}>
                <ColorPicker.ChannelSliderThumb style={{ width: 10, height: 10 }} />
              </ColorPicker.ChannelSliderTrack>
            </ColorPicker.ChannelSlider>
            <ColorPicker.ChannelInput channel="hex" />
          </ColorPicker.Content>
        </ColorPicker.Positioner>
      </ColorPicker.Portal>
    </ColorPicker.Root>
  )
}

const pointer = (type: string, target: EventTarget, x: number, y: number) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerType: "mouse",
      isPrimary: true,
    }),
  )

describe("color picker in real browsers", () => {
  it("the content is positioned next to the control, not at the page origin", async () => {
    render(
      <div style={{ margin: "200px 0 0 300px" }}>
        <Picker />
      </div>,
    )
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.open()
    const control = document.querySelector(
      '[data-scope="color-picker"][data-part="control"]',
    ) as HTMLElement
    const positioner = document.querySelector(
      '[data-scope="color-picker"][data-part="positioner"]',
    ) as HTMLElement
    // The Popover found its anchor: coordinates were computed and the anchor is not hidden.
    await vi.waitFor(() => expect(positioner.style.getPropertyValue("--rind-x")).not.toBe(""))
    expect(positioner.hasAttribute("data-anchor-hidden")).toBe(false)
    const anchor = control.getBoundingClientRect()
    const x = Number.parseFloat(positioner.style.getPropertyValue("--rind-x"))
    const y = Number.parseFloat(positioner.style.getPropertyValue("--rind-y"))
    // Default placement: below the control, starting near its inline start.
    expect(y).toBeGreaterThanOrEqual(anchor.bottom - 1)
    expect(Math.abs(x - anchor.left)).toBeLessThan(anchor.width + 300)
    expect(x).toBeGreaterThan(100)
  })

  it("in a Dialog: open, dismiss, open again, press inside (zag#3043, ark#3414)", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content style={{ padding: 40 }}>
              <Dialog.Title>Theme</Dialog.Title>
              {/* Above the picker: the content opens below the control and would cover it. */}
              <p data-testid="inside-dialog">Elsewhere in the dialog</p>
              <Picker />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    const picker = getColorPicker(screen, { name: "Fill" })
    for (let round = 0; round < 2; round++) {
      await picker.open()
      expect(await picker.isOpen()).toBe(true)
      await userEvent.click(screen.getByTestId("inside-dialog"))
      expect(await picker.isOpen()).toBe(false)
      expect(screen.getByRole("dialog", { name: "Theme" })).toBeTruthy()
    }
    await picker.open()
    await userEvent.click(screen.getByRole("textbox"))
    expect(await picker.isOpen()).toBe(true)
    await picker.close()
    expect(await picker.isOpen()).toBe(false)
    expect(screen.getByRole("dialog", { name: "Theme" })).toBeTruthy()
  })

  it("a slider drag released outside the Popover keeps it open and commits once (react-spectrum#3994)", async () => {
    const onValueCommit = vi.fn()
    render(<Picker onValueCommit={onValueCommit} />)
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.open()
    const thumb = document.querySelector('[data-scope="slider"][data-part="thumb"]') as HTMLElement
    const r = thumb.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    await act(async () => {
      pointer("pointerdown", thumb, x, y)
      pointer("pointermove", document, x + 100, y + 300)
      pointer("pointerup", document, x + 100, y + 300)
      // The click a browser sends to the common ancestor of the press and the release.
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x + 100 }))
    })
    expect(await picker.isOpen()).toBe(true)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
    expect(
      Number(screen.getByRole("slider", { name: "Hue" }).getAttribute("aria-valuenow")),
    ).toBeGreaterThan(0)
  })
})
