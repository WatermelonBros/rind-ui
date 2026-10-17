// color-model "Controlled Colour Value" (task 1.6): the Echo rule, hue memory, no callback for
// an unchanged emitted colour, commits, refused proposals.
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../../machine/service"
import { type Color, makeColor } from "./color"
import { isEqualColor } from "./equal"
import { formatColor } from "./format"
import { parseColor } from "./parse"
import {
  type ColorValueProps,
  colorValueMachine,
  colorValueOf,
  resolveWorking,
  workingOf,
} from "./value"

const hsb = (h: number, s: number, b: number) => makeColor("hsb", [h, s, b])

function make(over: Partial<ColorValueProps> = {}) {
  const onValueChange = vi.fn()
  const onValueCommit = vi.fn()
  let props: ColorValueProps = {
    space: "hsb",
    fallback: hsb(0, 100, 100),
    onValueChange,
    onValueCommit,
    ...over,
  }
  const s = createService(colorValueMachine, props, {})
  s.start()
  const view = () => s.view(props)
  return {
    onValueChange,
    onValueCommit,
    value: () => colorValueOf(props, view().values.value),
    working: () => workingOf(props, view().context, colorValueOf(props, view().values.value)),
    set: (color: Color) => s.send({ type: "SET", color, reason: "SLIDER" }),
    commit: () => s.send({ type: "COMMIT", reason: "SLIDER" }),
    setProps: (p: Partial<ColorValueProps>) => {
      props = { ...props, ...p }
      s.setProps(props)
    },
  }
}

describe("resolveWorking (Echo rule)", () => {
  it("keeps the working colour for its sRGB echo in another space", () => {
    const working = hsb(120, 0, 0)
    expect(resolveWorking(parseColor("#000000"), working, "hsb")).toBe(working)
  })
  it("adopts a different colour in the working space (external set)", () => {
    const next = hsb(200, 0, 0)
    expect(resolveWorking(next, hsb(10, 0, 0), "hsb")).toBe(next)
  })
  it("converts a genuinely different colour with memory", () => {
    expect(resolveWorking(parseColor("#FFFFFF"), hsb(10, 50, 50), "hsb", { hue: 33 })).toEqual(
      hsb(33, 0, 100),
    )
  })
})

describe("colorValueMachine", () => {
  it("emits in the space the consumer gave, working in the control's space", () => {
    const m = make({ defaultValue: parseColor("#FF0000") })
    m.set(hsb(1, 100, 100))
    const [emitted] = m.onValueChange.mock.calls[0] ?? []
    expect(emitted.space).toBe("rgb")
    expect(m.working()).toEqual(hsb(1, 100, 100))
  })

  it("a fresh sRGB object every render keeps hue 360 (zag#2503)", () => {
    let value: Color = parseColor("#FF0000")
    const m = make({ value })
    m.setProps({
      // The parent stores a string and re-parses it: a new rgb object every render.
      onValueChange: (c: Color) => {
        value = parseColor(formatColor(c, "rgb"))
        m.setProps({ value })
      },
    })
    m.set(hsb(360, 100, 100))
    // Same red in sRGB: nothing emitted, the working hue stays at 360.
    expect(m.working().channels[0]).toBe(360)
    m.setProps({ value: parseColor("#FF0000") })
    expect(m.working().channels[0]).toBe(360)
  })

  it("hue at black emits nothing (react-spectrum#9509)", () => {
    const m = make({ value: parseColor("#000000") })
    m.set(hsb(120, 100, 0))
    expect(m.onValueChange).not.toHaveBeenCalled()
    expect(m.working().channels[0]).toBe(120)
    m.set(hsb(120, 100, 50))
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("an external set in the working space is adopted", () => {
    const m = make({ value: hsb(10, 0, 0) })
    m.setProps({ value: hsb(200, 0, 0) })
    expect(m.working().channels[0]).toBe(200)
  })

  it("commits once per interaction that changed the emitted colour", () => {
    const m = make({ defaultValue: hsb(10, 50, 50) })
    m.commit()
    expect(m.onValueCommit).not.toHaveBeenCalled()
    m.set(hsb(20, 50, 50))
    m.set(hsb(30, 50, 50))
    m.commit()
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    expect(isEqualColor(m.onValueCommit.mock.calls[0]?.[0], hsb(30, 50, 50))).toBe(true)
  })

  it("a refused controlled proposal keeps the controls on the controlled value", () => {
    const m = make({ value: hsb(10, 50, 50) })
    m.set(hsb(40, 50, 50))
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    // The parent keeps its value: re-rendered with the same colour.
    m.setProps({ value: hsb(10, 50, 50) })
    expect(m.working().channels[0]).toBe(10)
    m.commit()
    expect(m.onValueCommit).not.toHaveBeenCalled()
  })

  it("a controlled commit waits for the value to arrive", () => {
    const m = make({ value: hsb(10, 50, 50) })
    m.set(hsb(40, 50, 50))
    m.commit()
    expect(m.onValueCommit).not.toHaveBeenCalled()
    m.setProps({ value: hsb(40, 50, 50) })
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })
})
