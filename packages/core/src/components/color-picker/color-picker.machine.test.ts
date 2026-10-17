// The Color Picker coordinator in Node (task 7.2): one commit path, emission in the format's
// space, format changes without emission, close on select, flush before close, eye dropper.
import { describe, expect, it, vi } from "vitest"
import { isEyeDropperSupported, pickScreenColor } from "../../dom/eye-dropper"
import { createService } from "../../machine/service"
import { makeColor } from "../shared/color/color"
import { parseColor } from "../shared/color/parse"
import { colorPickerContract } from "./color-picker.contract"
import {
  type ColorPickerMachineProps,
  colorPickerMachine,
  pickerValueOf,
  pickerWorking,
} from "./color-picker.machine"
import { colorPickerMeta } from "./color-picker.meta"
import { createFlushRegistry } from "./flush-registry"

function make(over: Partial<ColorPickerMachineProps> = {}) {
  const onValueChange = vi.fn()
  const onValueCommit = vi.fn()
  const onOpenChange = vi.fn()
  const onFormatChange = vi.fn()
  let props: ColorPickerMachineProps = {
    defaultValue: parseColor("#336699"),
    defaultFormat: "hex",
    onValueChange,
    onValueCommit,
    onOpenChange,
    onFormatChange,
    ...over,
  }
  const s = createService(colorPickerMachine, props, {})
  s.start()
  const view = () => s.view(props)
  return {
    onValueChange,
    onValueCommit,
    onOpenChange,
    onFormatChange,
    state: () => s.getSnapshot().state,
    value: () => pickerValueOf(props, view().values.value),
    working: () => pickerWorking(props, view().context, view().values.value),
    format: () => view().values.format,
    send: (e: Parameters<typeof s.send>[0]) => s.send(e),
    setProps: (p: Partial<ColorPickerMachineProps>) => {
      props = { ...props, ...p }
      s.setProps(props)
    },
  }
}

describe("color picker machine", () => {
  it("emits in the format's space and commits once per interaction", () => {
    const m = make({ defaultFormat: "hsl" })
    m.send({ type: "COLOR.SET", color: makeColor("hsb", [10, 50, 50]), reason: "AREA" })
    m.send({ type: "COLOR.SET", color: makeColor("hsb", [20, 50, 50]), reason: "AREA" })
    m.send({ type: "COLOR.COMMIT", reason: "AREA" })
    expect(m.onValueChange).toHaveBeenCalledTimes(2)
    expect(m.onValueChange.mock.calls[0]?.[0].space).toBe("hsl")
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    m.send({ type: "COLOR.COMMIT", reason: "AREA" })
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("a format change does not emit", () => {
    const m = make()
    m.send({ type: "FORMAT.SET", format: "hsl" })
    expect(m.onFormatChange).toHaveBeenCalledWith("hsl", expect.anything())
    expect(m.onValueChange).not.toHaveBeenCalled()
    expect(m.format()).toBe("hsl")
  })

  it("hue at black emits nothing; the working colour keeps the hue", () => {
    const m = make({ defaultValue: parseColor("#000000"), defaultFormat: "rgb" })
    m.send({ type: "COLOR.SET", color: makeColor("hsb", [120, 100, 0]), reason: "SLIDER" })
    expect(m.onValueChange).not.toHaveBeenCalled()
    expect(m.working().channels[0]).toBe(120)
  })

  it("open, close on select, disabled while open", () => {
    const m = make({ closeOnSelect: true })
    m.send({ type: "OPEN", reason: "trigger" })
    expect(m.state()).toBe("open")
    m.send({ type: "COLOR.SET", color: parseColor("#FF0000"), reason: "SWATCH" })
    m.send({ type: "COLOR.COMMIT", reason: "SWATCH" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("select")
    m.send({ type: "OPEN", reason: "trigger" })
    m.setProps({ disabled: true })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls.at(-1)?.[1].reason).toBe("api")
  })

  it("inline never opens; read-only never opens", () => {
    for (const over of [{ inline: true }, { readOnly: true }]) {
      const m = make(over)
      m.send({ type: "OPEN", reason: "trigger" })
      expect(m.state()).toBe("closed")
    }
  })

  it("the eye dropper's colour is opaque and committed (zag#2782)", () => {
    const m = make({ defaultValue: parseColor("#33669966") })
    m.send({ type: "EYEDROPPER.RESULT", hex: "#112233" })
    expect(m.value().alpha).toBe(1)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("a reset restores the default; a cancelled change keeps the colour", () => {
    const m = make()
    m.setProps({ onValueChange: (_c, d) => d.cancel() })
    m.send({ type: "COLOR.SET", color: parseColor("#FF0000"), reason: "SWATCH" })
    expect(m.value()).toEqual(parseColor("#336699"))
    m.setProps({ onValueChange: m.onValueChange })
    m.send({ type: "COLOR.SET", color: parseColor("#FF0000"), reason: "SWATCH" })
    m.send({ type: "RESET" })
    expect(m.value()).toEqual(parseColor("#336699"))
  })

  it("flush registry runs every field's flush once", () => {
    const r = createFlushRegistry()
    const a = vi.fn()
    const b = vi.fn()
    r.register(a)
    const off = r.register(b)
    off()
    r.flushAll()
    expect(a).toHaveBeenCalledOnce()
    expect(b).not.toHaveBeenCalled()
  })

  it("eye dropper module: unsupported, picked, aborted", async () => {
    expect(isEyeDropperSupported({})).toBe(false)
    expect(await pickScreenColor({})).toBeNull()
    const ok = {
      EyeDropper: class {
        open = async () => ({ sRGBHex: "#336699" })
      },
    }
    expect(isEyeDropperSupported(ok)).toBe(true)
    expect(await pickScreenColor(ok)).toBe("#336699")
    const abort = {
      EyeDropper: class {
        open = async () => {
          throw new DOMException("x", "AbortError")
        }
      },
    }
    expect(await pickScreenColor(abort)).toBeNull()
  })

  it("meta matches the contract", () => {
    expect(Object.keys(colorPickerMeta.contract.actions)).toEqual(
      Object.keys(colorPickerContract.actions),
    )
    expect(colorPickerMeta.contract.queries).toEqual(Object.keys(colorPickerContract.queries))
    expect(Object.keys(colorPickerMeta.states)).toEqual(Object.keys(colorPickerContract.states))
  })
})
