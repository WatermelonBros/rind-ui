// Color Field in Node (task 5.1): the draft, commit points, invalid drafts, Escape, flush,
// controlled text, alpha, and the text filter and channel-field props (task 5.3).
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import { makeColor } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { parseColor } from "../shared/color/parse"
import { channelFieldFormat, colorChannelFieldProps } from "./color-channel-field.connect"
import {
  type ColorFieldMachineProps,
  colorFieldMachine,
  colorFieldValue,
} from "./color-field.machine"
import { acceptColorText, colorFieldText, commitAlpha, parseColorText } from "./color-field.text"

function make(over: Partial<ColorFieldMachineProps> = {}) {
  const onValueChange = vi.fn()
  const onInputValueChange = vi.fn()
  let props: ColorFieldMachineProps = {
    format: "hex",
    alpha: false,
    onValueChange,
    onInputValueChange,
    ...over,
  }
  const s = createService(colorFieldMachine, props, {})
  s.start()
  const value = () => colorFieldValue(props, s.view(props).values.value)
  const text = () => {
    const v = s.view(props)
    return v.state === "idle" ? colorFieldText(value(), props.format, props.alpha) : v.context.draft
  }
  return {
    onValueChange,
    onInputValueChange,
    value,
    text,
    state: () => s.getSnapshot().state,
    type: (t: string) => s.send({ type: "INPUT", text: t }),
    enter: () => s.send({ type: "COMMIT" }),
    blur: () => s.send({ type: "BLUR" }),
    flush: () => s.send({ type: "FLUSH" }),
    escape: () => s.send({ type: "ESCAPE" }),
    reset: () => s.send({ type: "RESET" }),
    setProps: (p: Partial<ColorFieldMachineProps>) => {
      props = { ...props, ...p }
      s.setProps(props)
    },
  }
}

describe("text rules", () => {
  it("accepts partial hex only; the resulting text is checked (react-spectrum#3985)", () => {
    expect(acceptColorText("#FFF", "hex", false)).toBe(true)
    expect(acceptColorText("FFFFFF", "hex", false)).toBe(true)
    expect(acceptColorText("#FFFFFFA", "hex", false)).toBe(false)
    expect(acceptColorText("#FFFFFFAA", "hex", true)).toBe(true)
    expect(acceptColorText("hello", "hex", false)).toBe(false)
    expect(acceptColorText("hello", "css", false)).toBe(true)
  })

  it("parses leniently (react-spectrum#7547)", () => {
    for (const t of ["#e84e0f", "e84e0f", "E84E0F", " #E84E0F "]) {
      expect(
        formatColor(parseColorText(t, "hex", false) ?? makeColor("rgb", [0, 0, 0]), "hex"),
      ).toBe("#E84E0F")
    }
    expect(parseColorText("", "hex", false)).toBeNull()
    expect(parseColorText("#12345", "hex", false)).toBeUndefined()
    expect(parseColorText("12345678", "hex", false)).toBeUndefined()
    expect(parseColorText("hsl(10, 20%, 30%)", "css", false)?.space).toBe("hsl")
  })

  it("a css commit with alpha sets it; without alpha the current one stays", () => {
    const current = parseColor("#FF0000FF")
    const css = "rgba(0, 255, 0, 0.5)"
    expect(commitAlpha(parseColor(css), css, current, true).alpha).toBeCloseTo(0.5, 2)
    expect(commitAlpha(parseColor(css), css, current, false).alpha).toBe(1)
  })

  it("alpha on a hex commit (zag#884)", () => {
    const current = parseColor("#FF000080")
    expect(commitAlpha(parseColor("#00FF00"), "00FF00", current, true).alpha).toBeCloseTo(0.5, 2)
    expect(commitAlpha(parseColor("#00FF00FF"), "00FF00FF", current, true).alpha).toBe(1)
    expect(commitAlpha(parseColor("#00FF00FF"), "00FF00FF", current, false).alpha).toBeCloseTo(
      0.5,
      2,
    )
  })
})

describe("value and commit", () => {
  it("typing does not change the value (react-spectrum#5484)", () => {
    const m = make({ value: parseColor("#112233") })
    m.type("#334")
    expect(m.text()).toBe("#334")
    expect(m.onInputValueChange).toHaveBeenCalledWith("#334")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("Enter commits once and shows the formatted colour (react-spectrum#10445)", () => {
    const m = make()
    m.type("3366ff")
    m.enter()
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(formatColor(m.value() ?? makeColor("rgb", [0, 0, 0]), "hex")).toBe("#3366FF")
    expect(m.text()).toBe("#3366FF")
  })

  it("an unchanged colour calls nothing", () => {
    const m = make({ defaultValue: parseColor("#3366FF") })
    m.type("3366ff")
    m.enter()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("empty commits null; invalid keeps the text and the value", () => {
    const m = make({ defaultValue: parseColor("#3366FF") })
    m.type("")
    m.blur()
    expect(m.value()).toBeNull()
    const n = make({ defaultValue: parseColor("#3366FF") })
    n.type("#12345")
    n.enter()
    expect(n.state()).toBe("invalid")
    expect(n.text()).toBe("#12345")
    expect(n.onValueChange).not.toHaveBeenCalled()
    n.type("#123456")
    expect(n.state()).toBe("editing")
  })

  it("Escape restores the value's text", () => {
    const m = make({ defaultValue: parseColor("#3366FF") })
    m.type("#00")
    m.escape()
    expect(m.state()).toBe("idle")
    expect(m.text()).toBe("#3366FF")
  })

  it("flush commits a valid draft and discards an invalid or empty one (react-spectrum#9748)", () => {
    const m = make({ defaultValue: parseColor("#3366FF") })
    m.type("111111")
    m.flush()
    expect(formatColor(m.value() ?? makeColor("rgb", [0, 0, 0]), "hex")).toBe("#111111")
    m.type("")
    m.flush()
    expect(formatColor(m.value() ?? makeColor("rgb", [0, 0, 0]), "hex")).toBe("#111111")
    m.type("#12")
    m.flush()
    expect(m.state()).toBe("idle")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("a refused controlled commit shows the controlled value again", () => {
    const m = make({ value: parseColor("#112233") })
    m.type("#ABCDEF")
    m.enter()
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    m.setProps({ value: parseColor("#112233") })
    expect(m.text()).toBe("#112233")
  })

  it("alpha off never changes alpha; on, 6 digits keep it", () => {
    const m = make({ defaultValue: parseColor("#FF000080"), alpha: true })
    m.type("00FF00")
    m.enter()
    expect(m.value()?.alpha).toBeCloseTo(0.5, 2)
    m.type("00FF00FF")
    m.enter()
    expect(m.value()?.alpha).toBe(1)
  })

  it("a reset restores the default", () => {
    const m = make({ defaultValue: parseColor("#3366FF") })
    m.type("000000")
    m.enter()
    m.reset()
    expect(formatColor(m.value() ?? makeColor("rgb", [0, 0, 0]), "hex")).toBe("#3366FF")
  })

  it("read-only ignores edits", () => {
    const m = make({ defaultValue: parseColor("#3366FF"), readOnly: true })
    m.type("000000")
    expect(m.state()).toBe("idle")
  })
})

describe("channel field props", () => {
  it("ranges and formats per channel", () => {
    const red = parseColor("#FF0000")
    expect(colorChannelFieldProps(red, "hue")).toMatchObject({ value: 0, min: 0, max: 360 })
    expect(colorChannelFieldProps(red, "alpha")).toMatchObject({ value: 1, max: 1, step: 0.01 })
    expect(channelFieldFormat("saturation")).toMatchObject({ style: "unit", unit: "percent" })
    expect(new Intl.NumberFormat("en-US", channelFieldFormat("hue")).format(120)).toBe("120°")
    expect(new Intl.NumberFormat("en-US", channelFieldFormat("saturation")).format(50)).toBe("50%")
    expect(new Intl.NumberFormat("en-US", channelFieldFormat("alpha")).format(0.5)).toBe("50%")
  })
})
