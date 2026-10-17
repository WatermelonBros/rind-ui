// The Color Area machine in Node (tasks 2.1–2.3): keys on both axes, focus following a
// cross-axis key, press jump in one write, thumb grab without a jump, cancel and double tap,
// commit counts, assistive-technology adjustment, read-only, reset, echo and hue at black.
import { describe, expect, it, vi } from "vitest"
import type { DragMessage2D } from "../../dom/pointer-drag"
import { createService } from "../../machine/service"
import { type Color, makeColor } from "../shared/color/color"
import { isEqualColor } from "../shared/color/equal"
import { formatColor } from "../shared/color/format"
import { parseColor } from "../shared/color/parse"
import { areaAxes, colorAtPoint } from "./color-area.axes"
import { colorAreaConnect, colorAreaKeyEvent } from "./color-area.connect"
import {
  areaWorking,
  type ColorAreaEvent,
  type ColorAreaMachineProps,
  colorAreaMachine,
} from "./color-area.machine"
import { colorAreaMessages } from "./color-area.messages"

const hsb = (h: number, s: number, b: number, a = 1) => makeColor("hsb", [h, s, b], a)

function make(over: Partial<ColorAreaMachineProps> = {}) {
  const onValueChange = vi.fn()
  const onValueCommit = vi.fn()
  const syncs: { x: number; y: number; dispatch: readonly boolean[] }[] = []
  const focused: [string, string][] = []
  let drag: ((m: DragMessage2D) => void) | null = null
  let props: ColorAreaMachineProps = {
    axes: areaAxes("hsb"),
    fallback: hsb(0, 0, 100),
    onValueChange,
    onValueCommit,
    ...over,
  }
  const env = {
    inputs: {
      sync: (x: number, y: number, dispatch: readonly [boolean, boolean]) =>
        syncs.push({ x, y, dispatch }),
    },
    drag: {
      track: (send: (m: DragMessage2D) => void) => {
        drag = send
        return () => {
          drag = null
        }
      },
    },
    focusAxis: (axis: string, modality: string) => focused.push([axis, modality]),
  }
  const s = createService(colorAreaMachine, props, env)
  s.start()
  const view = () => s.view(props)
  return {
    onValueChange,
    onValueCommit,
    syncs,
    focused,
    state: () => s.getSnapshot().state,
    context: () => s.getSnapshot().context,
    working: () => areaWorking(props, view().context, view().values.value),
    send: (e: ColorAreaEvent) => s.send(e),
    step: (axis: "x" | "y", steps: 1 | -1, page = false) =>
      s.send({ type: "STEP", axis, steps, page, modality: "keyboard" }),
    down: (point: { x: number; y: number } | null, onThumb = false) =>
      s.send({ type: "POINTER.DOWN", point, onThumb, modality: "pointer" }),
    move: (x: number, y: number) => drag?.({ type: "move", x, y }),
    up: () => drag?.({ type: "up" }),
    cancel: () => drag?.({ type: "cancel" }),
    focus: (axis: "x" | "y") =>
      s.send({ type: "FOCUS", axis, modality: "keyboard", cause: "tab" } as never),
    setProps: (p: Partial<ColorAreaMachineProps>) => {
      props = { ...props, ...p }
      s.setProps(props)
    },
  }
}

describe("keys", () => {
  it("each arrow steps its axis by one step, Up increases y", () => {
    const m = make({ defaultValue: hsb(200, 50, 80) })
    m.step("x", 1)
    expect(m.working()).toEqual(hsb(200, 51, 80))
    m.step("y", -1)
    expect(m.working()).toEqual(hsb(200, 51, 79))
    expect(m.onValueChange).toHaveBeenCalledTimes(2)
    expect(m.onValueCommit).toHaveBeenCalledTimes(2)
  })

  it("Shift and PageUp move by the page step", () => {
    const m = make({ defaultValue: hsb(200, 50, 50) })
    m.step("x", 1, true)
    m.step("y", 1, true)
    expect(m.working()).toEqual(hsb(200, 60, 60))
  })

  it("a vertical key moves focus to the y input; same-axis steps never move focus", () => {
    const m = make({ defaultValue: hsb(200, 50, 50) })
    m.focus("x")
    m.step("x", 1)
    m.step("x", 1)
    expect(m.focused).toEqual([])
    m.step("y", 1)
    expect(m.focused).toEqual([["y", "keyboard"]])
    expect(m.context().tabStop).toBe("y")
  })

  it("Home and End on a hue axis", () => {
    const m = make({ axes: areaAxes("hsb", "hue", "saturation"), defaultValue: hsb(100, 50, 50) })
    m.send({ type: "EDGE", axis: "x", edge: "min" })
    expect(m.working().channels[0]).toBe(0)
    m.send({ type: "EDGE", axis: "x", edge: "max" })
    expect(m.working().channels[0]).toBe(360)
  })

  it("read-only and disabled ignore keys and native adjustments", () => {
    for (const over of [{ readOnly: true }, { disabled: true }]) {
      const m = make({ defaultValue: hsb(200, 50, 50), ...over })
      m.step("x", 1)
      m.send({ type: "INPUT.CHANGE", axis: "x", value: 70 })
      expect(m.onValueChange).not.toHaveBeenCalled()
      expect(m.working()).toEqual(hsb(200, 50, 50))
      // The refused native value is written back.
      expect(m.syncs.at(-1)).toMatchObject({ x: 50, y: 50 })
    }
  })

  it("key mapping: RTL mirrors Left/Right; Escape only while dragging", () => {
    const k = (key: string, shift = false) => ({
      key,
      code: key,
      shift,
      alt: false,
      ctrl: false,
      meta: false,
      repeat: false,
      composing: false,
    })
    expect(colorAreaKeyEvent(k("ArrowRight"), { dir: "rtl", dragging: false })).toMatchObject({
      axis: "x",
      steps: -1,
    })
    expect(colorAreaKeyEvent(k("PageUp"), { dir: "ltr", dragging: false })).toMatchObject({
      axis: "y",
      page: true,
    })
    expect(colorAreaKeyEvent(k("Escape"), { dir: "ltr", dragging: false })).toBeNull()
    expect(colorAreaKeyEvent(k("Escape"), { dir: "ltr", dragging: true })).toEqual({
      type: "DRAG.CANCEL",
    })
  })
})

describe("pointer", () => {
  it("a press jumps both channels in one write and focuses x without a ring (kobalte#592)", () => {
    const m = make({ defaultValue: hsb(200, 10, 10) })
    m.down({ x: 1, y: 1 })
    expect(m.working()).toEqual(hsb(200, 100, 100))
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.focused).toEqual([["x", "pointer"]])
    m.up()
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    expect(m.state()).toBe("idle")
  })

  it("grabbing the thumb does not move the value", () => {
    const m = make({ defaultValue: hsb(200, 50, 50) })
    m.down({ x: 0.53, y: 0.5 }, true)
    expect(m.onValueChange).not.toHaveBeenCalled()
    m.move(0.6, 0.5)
    expect(m.working()).toEqual(hsb(200, 60, 50))
  })

  it("pointer values snap to the resolution, not the step (react-spectrum#7553)", () => {
    const area = areaAxes("hsb")
    const c = colorAtPoint(hsb(200, 0, 0), area, { x: 1 / 360, y: 0.5 })
    expect(c.channels[1]).toBe(0.3)
  })

  it("a cancelled drag restores the press colour and commits nothing (react-spectrum#2252)", () => {
    const m = make({ defaultValue: hsb(200, 50, 50) })
    m.down({ x: 0.2, y: 0.2 })
    m.move(0.9, 0.9)
    m.send({ type: "DRAG.CANCEL" })
    expect(m.working()).toEqual(hsb(200, 50, 50))
    expect(m.onValueCommit).not.toHaveBeenCalled()
    expect(m.state()).toBe("idle")
  })

  it("a tap and a double tap leave no stuck state (react-spectrum#2814)", () => {
    const m = make({ defaultValue: hsb(200, 50, 50) })
    m.down({ x: 0.5, y: 0.5 }, true)
    m.up()
    m.down({ x: 0.5, y: 0.5 }, true)
    m.up()
    expect(m.state()).toBe("idle")
    expect(m.onValueCommit).not.toHaveBeenCalled()
  })

  it("read-only: a press focuses x and changes nothing", () => {
    const m = make({ defaultValue: hsb(200, 50, 50), readOnly: true })
    m.down({ x: 1, y: 1 })
    expect(m.state()).toBe("idle")
    expect(m.focused).toEqual([["x", "pointer"]])
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("disabled mid-drag cancels without a commit", () => {
    const m = make({ defaultValue: hsb(200, 50, 50) })
    m.down({ x: 0.9, y: 0.9 })
    m.setProps({ disabled: true })
    expect(m.state()).toBe("idle")
    expect(m.working()).toEqual(hsb(200, 50, 50))
    expect(m.onValueCommit).not.toHaveBeenCalled()
  })

  it("alpha is kept by every edit", () => {
    const m = make({ defaultValue: hsb(10, 50, 50, 0.3) })
    m.down({ x: 0.7, y: 0.7 })
    m.move(0.2, 0.4)
    for (const [c] of m.onValueChange.mock.calls) expect((c as Color).alpha).toBe(0.3)
  })
})

describe("native adjustment, reset, controlled", () => {
  it("assistive technology sets an axis: one change and one commit", () => {
    const m = make({ defaultValue: hsb(200, 50, 50) })
    m.send({ type: "INPUT.CHANGE", axis: "x", value: 70 })
    expect(m.working()).toEqual(hsb(200, 70, 50))
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("a form reset restores the default without a commit", () => {
    const m = make({ defaultValue: hsb(200, 50, 50) })
    m.step("x", 1)
    m.send({ type: "RESET" })
    expect(m.working()).toEqual(hsb(200, 50, 50))
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("a controlled echo as fresh rgb keeps hue and saturation (react-spectrum#9509)", () => {
    let value: Color = parseColor(formatColor(hsb(200, 50, 50), "rgb"))
    const m = make({ value })
    m.setProps({
      onValueChange: (c: Color) => {
        value = parseColor(formatColor(c, "rgb"))
        m.setProps({ value })
      },
    })
    const [hue, sat] = m.working().channels
    m.down({ x: 0.5, y: 0.5 }, true)
    m.move(sat / 100, 0)
    m.move(sat / 100, 0.5)
    m.up()
    expect(m.working().channels[0]).toBe(hue)
    expect(m.working().channels[1]).toBe(sat)
  })

  it("a refused controlled step leaves the controls on the value", () => {
    const m = make({ value: hsb(200, 50, 50) })
    m.step("x", 1)
    m.setProps({ value: hsb(200, 50, 50) })
    expect(m.working()).toEqual(hsb(200, 50, 50))
    expect(m.onValueCommit).not.toHaveBeenCalled()
  })

  it("a controlled commit waits for the value", () => {
    const m = make({ value: hsb(200, 50, 50) })
    m.step("x", 1)
    expect(m.onValueCommit).not.toHaveBeenCalled()
    m.setProps({ value: hsb(200, 51, 50) })
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    expect(isEqualColor(m.onValueCommit.mock.calls[0]?.[0], hsb(200, 51, 50))).toBe(true)
  })
})

describe("connect", () => {
  const api = (over: Partial<Parameters<typeof colorAreaConnect>[0]> = {}) =>
    colorAreaConnect({
      instance: "a",
      color: hsb(220, 80, 60),
      axes: areaAxes("hsb"),
      dir: "ltr",
      disabled: false,
      readOnly: false,
      dragging: false,
      focused: null,
      tabStop: "x",
      changed: null,
      modality: "keyboard",
      messages: colorAreaMessages,
      locale: "en-US",
      ids: { root: "a", input: (axis) => `a-${axis}` },
      defaultColor: hsb(0, 0, 100),
      ...over,
    })

  it("names, orientations and one tab stop", () => {
    const a = api({ ariaLabel: "Fill" })
    expect(a.root()["aria-label"]).toBe("Fill")
    expect(a.input("x")["aria-label"]).toBe("Fill Saturation")
    expect(a.input("y")["aria-label"]).toBe("Fill Brightness")
    expect(a.input("x")["aria-orientation"]).toBe("horizontal")
    expect(a.input("y")["aria-orientation"]).toBe("vertical")
    expect(a.input("x")["tabindex"]).toBeUndefined()
    expect(a.input("y")["tabindex"]).toBe(-1)
    expect(a.input("x")["aria-roledescription"]).toBe("2D slider")
    expect(api().input("x")["aria-label"]).toBe("Saturation")
  })

  it("first focus lists all channels, then only the change (react-spectrum#4110)", () => {
    const first = String(api().input("x")["aria-valuetext"])
    expect(first).toMatch(/^Saturation 80%, Brightness 60%, Hue 220°, /)
    const then = String(api({ changed: "x" }).input("x")["aria-valuetext"])
    expect(then).toMatch(/^Saturation 80%, [a-z ]+$/)
  })

  it("variables and gradient (LTR and RTL)", () => {
    const style = (p: Record<string, unknown>) => p["style"] as Record<string, string>
    const t = style(api({ color: hsb(10, 50, 25) }).thumb())
    expect(t["--rind-color-area-x"]).toBe("50")
    expect(t["--rind-color-area-y"]).toBe("25")
    expect(t["left"]).toBe("50%")
    const rtl = style(api({ color: hsb(10, 100, 25), dir: "rtl" }).thumb())
    expect(rtl["left"]).toBe("0%")
    expect(style(api().background())["background-image"]).toContain("linear-gradient")
    expect(style(api().background())["forced-color-adjust"]).toBe("none")
    expect(style(api().root())["touch-action"]).toBe("none")
  })

  it("no live region", () => {
    const a = api()
    for (const p of [a.root(), a.background(), a.thumb(), a.input("x"), a.input("y")]) {
      expect(p["aria-live"]).toBeUndefined()
    }
  })
})
