// Color Field and Color Channel Field scenarios (color-field spec) through their drivers.
// Runs in jsdom and in real browsers.
import type { Color } from "@rind-ui/core"
import { ColorChannelField, ColorField, type ColorFieldRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getColorChannelField, getColorField } from "../index"

afterEach(() => vi.restoreAllMocks())

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const Field = (props: Partial<ColorFieldRootProps>) => (
  <ColorField.Root {...props}>
    <ColorField.Label>Fill</ColorField.Label>
    <ColorField.Input />
  </ColorField.Root>
)

const hex = (c: Color | null | undefined) =>
  c
    ? `#${c.channels
        .map((n) => Math.round(n).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`
    : null

describe("Color Field", () => {
  it("standalone: one textbox named by its Label, one hidden input, attributes forwarded", async () => {
    render(
      <form data-testid="f">
        <Field name="fill" defaultValue="#3366ff" data-testid="root" className="c" />
      </form>,
    )
    expect(screen.getAllByRole("textbox")).toHaveLength(1)
    const input = screen.getByRole("textbox", { name: "Fill" })
    expect(input.getAttribute("spellcheck")).toBe("false")
    expect(input.getAttribute("autocomplete")).toBe("off")
    expect(input.hasAttribute("maxlength")).toBe(false)
    expect(screen.getByTestId("root").className).toContain("c")
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).get("fill")).toBe("#3366FF")
    await a11y()
  })

  it("typing does not change the value; Enter commits once (react-spectrum#5484, #10445)", async () => {
    const onValueChange = vi.fn()
    const onInputValueChange = vi.fn()
    render(<Field onValueChange={onValueChange} onInputValueChange={onInputValueChange} />)
    const f = getColorField(screen, { name: "Fill" })
    await f.type("3366ff")
    expect(await f.text()).toBe("3366ff")
    expect(onInputValueChange).toHaveBeenCalled()
    expect(onValueChange).not.toHaveBeenCalled()
    await f.commit()
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(hex(onValueChange.mock.calls[0]?.[0])).toBe("#3366FF")
    expect(await f.text()).toBe("#3366FF")
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("INPUT.COMMIT")
  })

  it("lower case and paste (react-spectrum#7547)", async () => {
    render(<Field />)
    const f = getColorField(screen, { name: "Fill" })
    await f.fill("#e84e0f")
    expect(await f.text()).toBe("#E84E0F")
    await f.fill("e84e0f")
    expect(await f.formValue()).toBe("#E84E0F")
  })

  it("an edit whose resulting text is not partial hex is rejected", async () => {
    render(<Field defaultValue="#FFFFFF" />)
    const input = screen.getByRole("textbox", { name: "Fill" }) as HTMLInputElement
    await userEvent.type(input, "hello")
    // Each insertion would make 7 or more digits, or a non-hex character: all rejected.
    expect(input.value).toBe("#FFFFFF")
  })

  it("alpha kept (zag#884)", async () => {
    const onValueChange = vi.fn()
    render(<Field alpha defaultValue="#FF000080" onValueChange={onValueChange} />)
    const f = getColorField(screen, { name: "Fill" })
    await f.fill("00FF00")
    expect((onValueChange.mock.calls[0]?.[0] as Color | undefined)?.alpha).toBe(0.5)
    await f.fill("00FF00FF")
    expect((onValueChange.mock.calls[1]?.[0] as Color | undefined)?.alpha).toBe(1)
  })

  it("empty commits null; invalid keeps the text and sets aria-invalid", async () => {
    const onValueChange = vi.fn()
    render(<Field defaultValue="#3366FF" onValueChange={onValueChange} />)
    const f = getColorField(screen, { name: "Fill" })
    await f.fill("#12345")
    expect(await f.isInvalid()).toBe(true)
    expect(await f.text()).toBe("#12345")
    expect(onValueChange).not.toHaveBeenCalled()
    await f.type("")
    await f.blur()
    expect(onValueChange).toHaveBeenCalledWith(null, expect.anything())
  })

  it("Escape reverts a dirty draft and is handled", async () => {
    render(<Field defaultValue="#3366FF" />)
    const f = getColorField(screen, { name: "Fill" })
    await f.type("00")
    await f.escape()
    expect(await f.text()).toBe("#3366FF")
  })

  it("a refused controlled commit shows the controlled value", async () => {
    function Parent() {
      const [v] = useState("#112233")
      return <Field value={v} onValueChange={() => {}} />
    }
    render(<Parent />)
    const f = getColorField(screen, { name: "Fill" })
    await f.fill("#ABCDEF")
    expect(await f.text()).toBe("#112233")
  })

  it("a form reset restores the default", async () => {
    render(
      <form>
        <Field name="fill" defaultValue="#3366FF" />
        <button type="reset">Reset</button>
      </form>,
    )
    const f = getColorField(screen, { name: "Fill" })
    await f.fill("000000")
    expect(await f.formValue()).toBe("#000000")
    await f.resetForm()
    expect(await f.text()).toBe("#3366FF")
  })
})

describe("Color Channel Field", () => {
  const Channel = ({
    channel,
    ...rest
  }: { channel: "hue" | "saturation" | "brightness" | "red" | "alpha" } & Record<
    string,
    unknown
  >) => (
    <ColorChannelField.Root channel={channel} {...rest}>
      <ColorChannelField.Input />
    </ColorChannelField.Root>
  )

  it("clamps every channel (zag#1567)", async () => {
    const onValueChange = vi.fn()
    render(
      <>
        <Channel channel="hue" defaultValue="hsb(10, 20%, 30%)" onValueChange={onValueChange} />
        <Channel channel="saturation" defaultValue="hsb(10, 20%, 30%)" />
        <Channel channel="brightness" defaultValue="hsb(10, 20%, 30%)" />
      </>,
    )
    for (const [name, shown] of [
      ["Hue", "360°"],
      ["Saturation", "100%"],
      ["Brightness", "100%"],
    ] as const) {
      const f = getColorChannelField(screen, { name })
      await f.fill("999")
      expect(await f.text()).toBe(shown)
    }
    expect((onValueChange.mock.calls.at(-1)?.[0] as Color | undefined)?.channels[0]).toBe(360)
  })

  it("alpha as percent (kobalte#589)", async () => {
    const onValueChange = vi.fn()
    render(<Channel channel="alpha" defaultValue="#336699" onValueChange={onValueChange} />)
    const f = getColorChannelField(screen, { name: "Alpha" })
    await f.fill("50")
    expect((onValueChange.mock.calls.at(-1)?.[0] as Color | undefined)?.alpha).toBe(0.5)
    expect(await f.text()).toBe("50%")
  })

  it("a channel the value lacks: hue of rgb red shows 0° and emits rgb (ark#1649)", async () => {
    const onValueChange = vi.fn()
    render(<Channel channel="hue" defaultValue="rgb(255, 0, 0)" onValueChange={onValueChange} />)
    const f = getColorChannelField(screen, { name: "Hue" })
    expect(await f.text()).toBe("0°")
    await f.fill("120")
    expect((onValueChange.mock.calls.at(-1)?.[0] as Color | undefined)?.space).toBe("rgb")
    expect(await f.channel()).toBe("hue")
  })

  it("an empty commit restores the text, no callback", async () => {
    const onValueChange = vi.fn()
    render(<Channel channel="red" defaultValue="rgb(10, 0, 0)" onValueChange={onValueChange} />)
    const f = getColorChannelField(screen, { name: "Red" })
    const input = screen.getByRole("spinbutton", { name: "Red" })
    await userEvent.clear(input)
    await userEvent.tab()
    expect(await f.text()).toBe("10")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("ArrowUp steps once with one change and one commit", async () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(
      <Channel
        channel="red"
        defaultValue="rgb(10, 0, 0)"
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
      />,
    )
    const input = screen.getByRole("spinbutton", { name: "Red" })
    input.focus()
    await getColorChannelField(screen, { name: "Red" }).via("keyboard").step("increase")
    expect(input.getAttribute("aria-valuenow")).toBe("11")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueCommit).toHaveBeenCalledTimes(1)
  })
})
