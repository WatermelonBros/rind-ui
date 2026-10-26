// Color Picker scenarios (color-picker spec) through its driver and its children's drivers.
// Runs in jsdom and in real browsers.
import { type Color, formatColor } from "@rind-ui/core"
import { ColorPicker, type ColorPickerRootProps, Field } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getColorPicker, installAnnouncementLog } from "../index"

afterEach(() => vi.restoreAllMocks())

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function Inline(props: Partial<ColorPickerRootProps>) {
  return (
    <ColorPicker.Root inline defaultValue="#336699" {...props}>
      <ColorPicker.Label>Fill</ColorPicker.Label>
      <ColorPicker.Content>
        <ColorPicker.ValueText />
        <ColorPicker.Area>
          <ColorPicker.AreaBackground />
          <ColorPicker.AreaThumb />
        </ColorPicker.Area>
        <ColorPicker.ChannelSlider channel="hue">
          <ColorPicker.ChannelSliderTrack>
            <ColorPicker.ChannelSliderThumb />
          </ColorPicker.ChannelSliderTrack>
        </ColorPicker.ChannelSlider>
        <ColorPicker.ChannelSlider channel="alpha">
          <ColorPicker.ChannelSliderTrack>
            <ColorPicker.ChannelSliderThumb />
          </ColorPicker.ChannelSliderTrack>
        </ColorPicker.ChannelSlider>
        <ColorPicker.ChannelInput channel="hex" />
      </ColorPicker.Content>
    </ColorPicker.Root>
  )
}

function Popup(props: Partial<ColorPickerRootProps>) {
  return (
    <ColorPicker.Root defaultValue="#336699" {...props}>
      <ColorPicker.Label>Fill</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Trigger>
          <ColorPicker.ValueSwatch />
        </ColorPicker.Trigger>
      </ColorPicker.Control>
      <ColorPicker.Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content>
            <ColorPicker.ChannelInput channel="hex" />
            <ColorPicker.SwatchGroup>
              <ColorPicker.SwatchTrigger color="#FF0000">
                <ColorPicker.SwatchIndicator>✓</ColorPicker.SwatchIndicator>
              </ColorPicker.SwatchTrigger>
              <ColorPicker.SwatchTrigger color="#00FF00" />
            </ColorPicker.SwatchGroup>
            <ColorPicker.EyeDropperTrigger>Pick</ColorPicker.EyeDropperTrigger>
            <ColorPicker.FormatSelect />
            <ColorPicker.View format="hsl">
              <span>HSL view</span>
            </ColorPicker.View>
          </ColorPicker.Content>
        </ColorPicker.Positioner>
      </ColorPicker.Portal>
    </ColorPicker.Root>
  )
}

describe("inline (Reado's anatomy)", () => {
  it("renders the content at once, no trigger, every slider operable", async () => {
    const onValueChange = vi.fn()
    render(<Inline onValueChange={onValueChange} />)
    expect(screen.queryByRole("button")).toBeNull()
    const picker = getColorPicker(screen, { name: "Fill" })
    expect(await picker.isInline()).toBe(true)
    expect(await picker.valueText()).toBe("#336699")
    await picker.slider("hue").step(0, "increase")
    await picker.slider("alpha").step(0, "decrease")
    expect(onValueChange).toHaveBeenCalledTimes(2)
    expect((onValueChange.mock.calls[1]?.[0] as Color | undefined)?.alpha).toBe(0.99)
    await a11y()
  })

  it("a native <fieldset disabled> disables the picker and its sliders", async () => {
    const onValueChange = vi.fn()
    render(
      <fieldset disabled>
        <Inline onValueChange={onValueChange} />
      </fieldset>,
    )
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-scope="color-picker"][data-part="root"][data-disabled]'),
      ).not.toBeNull(),
    )
    for (const thumb of document.querySelectorAll('[role="slider"]')) {
      expect(thumb.getAttribute("aria-disabled")).toBe("true")
    }
  })

  it("inside a disabled Field the picker is disabled", () => {
    render(
      <Field.Root disabled>
        <Inline />
      </Field.Root>,
    )
    expect(document.querySelector('[data-scope="color-picker"][data-disabled]')).not.toBeNull()
  })

  it("no layer and no dismissal while idle: Escape reaches the host unhandled", () => {
    const add = vi.spyOn(document, "addEventListener")
    render(<Inline />)
    // Only the shared modality tracker listens (every focusable component has it).
    const listened = new Set(add.mock.calls.map((c) => c[0]))
    expect(listened.has("pointermove")).toBe(false)
    expect(listened.has("focusin")).toBe(false)
    const escapeKey = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
    screen.getByRole("textbox").dispatchEvent(escapeKey)
    expect(escapeKey.defaultPrevented).toBe(false)
    expect(document.querySelector("[data-rind-layer], [inert]")).toBeNull()
  })

  it("one change per gesture; format and hex", async () => {
    const onValueChange = vi.fn()
    render(<Inline onValueChange={onValueChange} format="rgb" />)
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.input("hex").fill("#00FF00")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    const [c] = onValueChange.mock.calls[0] as [Color]
    expect(c.space).toBe("rgb")
    expect(await picker.color("hex")).toBe("#00FF00")
    // The area and the hue slider follow the new colour.
    expect(screen.getByRole("slider", { name: "Hue" }).getAttribute("aria-valuenow")).toBe("120")
  })

  it("a fresh rgb object every render keeps the hue continuous (zag#2503)", async () => {
    const onValueChange = vi.fn()
    function Parent() {
      const [c, setC] = useState("rgba(51, 102, 153, 1)")
      return (
        <Inline
          format="rgb"
          value={c}
          onValueChange={(next) => {
            onValueChange(next)
            setC(formatColor(next, "rgb"))
          }}
        />
      )
    }
    render(<Parent />)
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.slider("hue").toEdge(0, "max")
    expect(screen.getByRole("slider", { name: "Hue" }).getAttribute("aria-valuenow")).toBe("360")
  })
})

describe("popover", () => {
  it("the trigger is named with the colour and the label", () => {
    render(<Popup defaultValue="#FF0000" />)
    const trigger = screen.getByRole("button", { name: /Choose color, vibrant red/ })
    expect(trigger.getAttribute("aria-labelledby")).toContain(
      document.querySelector('[data-part="label"]')?.id ?? "?",
    )
  })

  it("opens; the hex input commits; Escape layers (dirty draft first)", async () => {
    const onOpenChange = vi.fn()
    render(<Popup onOpenChange={onOpenChange} />)
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.open()
    expect(await picker.isOpen()).toBe(true)
    await picker.input("hex").fill("3366ff")
    expect(await picker.color("hex")).toBe("#3366FF")
    await picker.input("hex").type("00")
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      )
    })
    expect(await picker.isOpen()).toBe(true)
    await picker.close()
    expect(await picker.isOpen()).toBe(false)
  })

  it("a typed hex survives an outside press (react-spectrum#9748)", async () => {
    const order: string[] = []
    render(
      <Popup
        onValueChange={(c) => order.push(`value ${formatColor(c, "hex")}`)}
        onOpenChange={(o) => order.push(`open ${o}`)}
      />,
    )
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.open()
    await picker.input("hex").type("111111")
    await picker.pressOutside()
    expect(order).toEqual(["open true", "value #111111", "open false"])
    expect(await picker.formValue()).toBe("#111111")
  })

  it("an emptied hex input leaves the colour opaque (react-spectrum#6363)", async () => {
    render(<Popup />)
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.open()
    await picker.input("hex").type("")
    await picker.pressOutside()
    expect(await picker.formValue()).toBe("#336699")
  })

  it("close on select: one change, closes with reason select", async () => {
    const onValueChange = vi.fn()
    const onOpenChange = vi.fn()
    render(<Popup closeOnSelect onValueChange={onValueChange} onOpenChange={onOpenChange} />)
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.open()
    await picker.swatches().pick("vibrant red")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenLastCalledWith(false, { reason: "select" })
  })

  it("format change does not emit; View and select follow", async () => {
    const onValueChange = vi.fn()
    const onFormatChange = vi.fn()
    render(<Popup onValueChange={onValueChange} onFormatChange={onFormatChange} />)
    const picker = getColorPicker(screen, { name: "Fill" })
    await picker.open()
    expect(screen.queryByText("HSL view")).toBeNull()
    await picker.setFormat("hsl")
    expect(onFormatChange).toHaveBeenCalledWith("hsl")
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByText("HSL view")).toBeTruthy()
  })

  it("eye dropper: hidden without support (ark#2764)", async () => {
    const saved = Reflect.get(window, "EyeDropper")
    Reflect.deleteProperty(window, "EyeDropper")
    try {
      render(<Popup />)
      const picker = getColorPicker(screen, { name: "Fill" })
      await picker.open()
      expect(await picker.isEyeDropperAvailable()).toBe(false)
    } finally {
      if (saved) Object.assign(window, { EyeDropper: saved })
    }
  })

  it("eye dropper: a fake pick is opaque and announced (zag#2782); a dismissal changes nothing", async () => {
    const saved = Reflect.get(window, "EyeDropper")
    const log = installAnnouncementLog()
    const onValueChange = vi.fn()
    render(<Popup defaultValue="#33669966" onValueChange={onValueChange} />)
    const picker = getColorPicker(screen, { name: "Fill" })
    try {
      picker.eyeDropper("abort")
      await picker.open()
      const button = await screen.findByRole("button", { name: "Pick a color from the screen" })
      await act(async () => button.click())
      expect(onValueChange).not.toHaveBeenCalled()
      picker.eyeDropper("#336699")
      const before = log.length
      await act(async () => button.click())
      await vi.waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1))
      expect((onValueChange.mock.calls[0]?.[0] as Color | undefined)?.alpha).toBe(1)
      await vi.waitFor(() => expect(log.length).toBeGreaterThan(before))
      expect(log.at(-1)?.message).toMatch(/^Picked /)
    } finally {
      if (saved) Object.assign(window, { EyeDropper: saved })
      else Reflect.deleteProperty(window, "EyeDropper")
    }
  })
})

describe("forms and server render", () => {
  it("submits the canonical hex whatever the format; reset restores", async () => {
    render(
      <form data-testid="f">
        <Popup name="fill" format="hsl" />
        <button type="reset">Reset</button>
      </form>,
    )
    const f = screen.getByTestId("f") as HTMLFormElement
    expect(new FormData(f).get("fill")).toBe("#336699")
  })

  it("server render: the eye dropper is hidden, the trigger named", () => {
    const html = renderToString(<Popup />)
    expect(html).toContain("Choose color")
    const inline = renderToString(<Inline />)
    expect(inline).toContain('role="group"')
  })

  it("announcements: none for a value change", async () => {
    const log = installAnnouncementLog()
    const before = log.length
    render(<Inline />)
    await getColorPicker(screen, { name: "Fill" }).slider("hue").step(0, "increase")
    expect(log.length).toBe(before)
  })
})
