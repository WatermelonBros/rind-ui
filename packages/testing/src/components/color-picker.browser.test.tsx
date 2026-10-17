// Color Picker scenarios that need a real browser (add-color-picker 9.2): the picker in a Dialog
// (open → dismiss → open → press inside; zag#3043, ark#3414) and a slider drag released outside
// the Popover (react-spectrum#3994).
import { ColorPicker, Dialog } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import siteBase from "../../../../apps/site/skins/base.css?inline"
import siteColor from "../../../../apps/site/skins/color.css?inline"
// The stylesheets that draw a swatch's selected mark: the theme's and the docs site's skin.
import siteRadio from "../../../../apps/site/skins/radio-group.css?inline"
import swatchPicker from "../../../theme/src/color-swatch-picker.css?inline"
import radioGroup from "../../../theme/src/radio-group.css?inline"
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
  for (const [sheet, css, skinned] of [
    ["theme", `${radioGroup}\n${swatchPicker}`, false],
    ["site skin", `${siteBase}\n${siteRadio}\n${siteColor}`, true],
  ] as const) {
    for (const glyph of [undefined, "✓"]) {
      it(`a selected swatch shows exactly one mark, centred (${sheet}, ${glyph ? "a glyph" : "the default dot"})`, async () => {
        const style = document.createElement("style")
        style.textContent = css
        document.head.append(style)
        try {
          const colors = ["#ef4444", "#22c55e", "#3b82f6"]
          render(
            <div {...(skinned ? { "data-skinned": "", "data-skin": "crisp" } : {})}>
              <ColorPicker.Root inline defaultValue="#ffffff">
                <ColorPicker.Label>Fill</ColorPicker.Label>
                <ColorPicker.Content>
                  <ColorPicker.SwatchGroup aria-label="Swatches">
                    {colors.map((c) => (
                      <ColorPicker.SwatchTrigger key={c} color={c}>
                        <ColorPicker.Swatch color={c} aria-hidden="true" />
                        <ColorPicker.SwatchIndicator>{glyph}</ColorPicker.SwatchIndicator>
                      </ColorPicker.SwatchTrigger>
                    ))}
                  </ColorPicker.SwatchGroup>
                </ColorPicker.Content>
              </ColorPicker.Root>
            </div>,
          )
          const radio = screen.getAllByRole("radio")[1] as HTMLElement
          await userEvent.click(radio)
          await vi.waitFor(() => expect(radio.getAttribute("aria-checked")).toBe("true"))
          const marks = [...radio.querySelectorAll<HTMLElement>("*")].filter((el) => {
            if (el.closest('[data-scope="color-swatch"]')) return false
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"
          })
          // One mark: the indicator element (a glyph inside it is the mark, with no dot).
          expect(marks).toHaveLength(1)
          const mark = marks[0] as HTMLElement
          expect(mark.matches('[data-part="item-indicator"]')).toBe(true)
          if (glyph) expect(getComputedStyle(mark).backgroundColor).toBe("rgba(0, 0, 0, 0)")
          const a = radio.getBoundingClientRect()
          const b = mark.getBoundingClientRect()
          expect(Math.abs(b.left + b.width / 2 - (a.left + a.width / 2))).toBeLessThanOrEqual(1)
          expect(Math.abs(b.top + b.height / 2 - (a.top + a.height / 2))).toBeLessThanOrEqual(1)
        } finally {
          style.remove()
        }
      })
    }
  }

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
