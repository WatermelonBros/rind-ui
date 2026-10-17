// Color Swatch Picker scenarios (color-swatch-picker spec). Runs in jsdom and real browsers.
import type { Color } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import {
  ColorSwatchPicker,
  type ColorSwatchPickerRootProps,
  getColorSwatchPicker,
} from "./color-parts"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const Palette = (
  props: Partial<ColorSwatchPickerRootProps> & {
    items?: [string, (string | undefined)?, boolean?][]
  },
) => {
  const { items = [["#FF0000"], ["#00FF00"], ["#0000FF"]], ...rest } = props
  return (
    <ColorSwatchPicker.Root aria-label="Palette" {...rest}>
      {items.map(([color, key, disabled]) => (
        <ColorSwatchPicker.Item
          key={key ?? color}
          color={color}
          disabled={disabled === true}
          {...(key ? { value: key } : {})}
        >
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator>✓</ColorSwatchPicker.Indicator>
        </ColorSwatchPicker.Item>
      ))}
    </ColorSwatchPicker.Root>
  )
}

describe("Color Swatch Picker", () => {
  it("radios named by their colours; no input inside a radio", async () => {
    render(<Palette />)
    expect(screen.getByRole("radiogroup", { name: "Palette" })).toBeTruthy()
    const names = screen.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))
    expect(names).toEqual(["vibrant red", "vibrant green", "vibrant blue"])
    for (const r of screen.getAllByRole("radio")) expect(r.querySelector("input")).toBeNull()
    await a11y()
  })

  it("no match: nothing checked (react-spectrum#7918)", () => {
    render(<Palette value="#123456" items={[["#000000"], ["#FF0000"]]} />)
    for (const r of screen.getAllByRole("radio"))
      expect(r.getAttribute("aria-checked")).toBe("false")
  })

  it("matches across spaces", async () => {
    render(<Palette value="hsb(0, 100%, 100%)" />)
    expect(await getColorSwatchPicker(screen, { name: "Palette" }).selectedColor()).toBe("#FF0000")
  })

  it("same colour twice, stable keys (react-spectrum#10251)", async () => {
    const onValueChange = vi.fn()
    render(
      <Palette
        defaultValue="#FF0000"
        onValueChange={onValueChange}
        items={[
          ["#FF0000", "primary"],
          ["#FF0000", "danger"],
        ]}
      />,
    )
    const p = getColorSwatchPicker(screen, { name: "Palette" })
    await p.pick("danger")
    expect(onValueChange.mock.calls.at(-1)?.[1].value).toBe("danger")
    expect((await p.selected())?.key).toBe("danger")
  })

  it("an arrow moves and checks once; a disabled swatch is skipped", async () => {
    const onValueChange = vi.fn()
    render(
      <Palette
        defaultValue="#FF0000"
        onValueChange={onValueChange}
        items={[["#FF0000"], ["#00FF00", undefined, true], ["#0000FF"]]}
      />,
    )
    screen.getAllByRole("radio")[0]?.focus()
    const p = getColorSwatchPicker(screen, { name: "Palette" })
    await p.move("next")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect((onValueChange.mock.calls[0]?.[0] as Color | undefined)?.channels).toEqual([0, 0, 255])
    expect((await p.selected())?.name).toBe("vibrant blue")
  })

  it("the checked swatch is the tab stop and shows its Indicator", () => {
    render(<Palette value="#0000FF" />)
    const radios = screen.getAllByRole("radio")
    expect(radios[2]?.tabIndex).toBe(0)
    expect(radios[0]?.tabIndex).toBe(-1)
    expect(radios[2]?.textContent).toContain("✓")
    expect(radios[0]?.textContent).not.toContain("✓")
  })

  it("submits the checked key", () => {
    render(
      <form data-testid="f">
        <Palette name="tone" value="#00FF00" />
      </form>,
    )
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).get("tone")).toBe("#00FF00FF")
  })
})
