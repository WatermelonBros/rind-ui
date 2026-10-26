import { describe, expect, it, vi } from "vitest"
import { angleOf } from "../../dom/pointer-angle"
import { createService } from "../../machine/service"
import { angleSliderConnect, angleSliderKeyEvent } from "./angle-slider.connect"
import { angleSliderContract } from "./angle-slider.contract"
import { type AngleSliderProps, angleSliderMachine } from "./angle-slider.machine"
import { angleMax, normalizeAngle, stepAngle } from "./angle-slider.math"
import { angleSliderMessages } from "./angle-slider.messages"
import { angleSliderMeta } from "./angle-slider.meta"

describe("angle math", () => {
  it("snaps to the nearest step; 360 is 0 (regression: Zag snaps up)", () => {
    expect(normalizeAngle(37, 15)).toBe(30)
    expect(normalizeAngle(359.6, 1)).toBe(0)
    expect(normalizeAngle(-90, 1)).toBe(270)
  })

  it("the announced max is reachable", () => {
    expect([angleMax(1), angleMax(15), angleMax(7)]).toEqual([359, 345, 357])
  })

  it("wraps or clamps by steps", () => {
    expect(stepAngle(359, 1, 1, true)).toBe(0)
    expect(stepAngle(0, -1, 1, true)).toBe(359)
    expect(stepAngle(359, 1, 1, false)).toBe(359)
    expect(stepAngle(357, 1, 7, true)).toBe(0)
  })

  it("angles are clockwise from the top", () => {
    expect([angleOf(0, -1), angleOf(1, 0), angleOf(0, 1), angleOf(-1, 0)]).toEqual([
      0, 90, 180, 270,
    ])
  })
})

function make(over: Partial<AngleSliderProps> = {}) {
  const onValueCommit = vi.fn()
  let send:
    | ((m: { type: "move"; angle: number } | { type: "up" } | { type: "cancel" }) => void)
    | null = null
  const env = {
    drag: {
      track: (s: typeof send & object) => {
        send = s
        return () => {
          send = null
        }
      },
    },
    focusInput: vi.fn(),
  }
  const props: AngleSliderProps = { onValueCommit, ...over }
  const s = createService(angleSliderMachine, props, env)
  s.start()
  return {
    s,
    env,
    onValueCommit,
    value: () => s.view(props).values.value,
    drag: (m: Parameters<NonNullable<typeof send>>[0]) => send?.(m),
  }
}

describe("angle slider machine", () => {
  it("a press sets the angle, a drag commits once on release", () => {
    const t = make()
    t.s.send({ type: "POINTER.DOWN", angle: 90, onThumb: false, modality: "pointer" })
    expect(t.value()).toBe(90)
    expect(t.env.focusInput).toHaveBeenCalled()
    for (const angle of [100, 110, 120]) t.drag({ type: "move", angle })
    t.drag({ type: "up" })
    expect(t.value()).toBe(120)
    expect(t.onValueCommit).toHaveBeenCalledTimes(1)
    expect(t.onValueCommit).toHaveBeenCalledWith(120, { reason: "drag" })
    t.s.send({ type: "POINTER.DOWN", angle: 180, onThumb: false, modality: "pointer" })
    t.drag({ type: "up" })
    expect(t.onValueCommit).toHaveBeenLastCalledWith(180, { reason: "press" })
  })

  it("a cancel restores the angle at the press and does not commit", () => {
    const t = make({ defaultValue: 10 })
    t.s.send({ type: "POINTER.DOWN", angle: null, onThumb: true, modality: "pointer" })
    t.drag({ type: "move", angle: 200 })
    t.s.send({ type: "DRAG.CANCEL" })
    expect(t.value()).toBe(10)
    expect(t.onValueCommit).not.toHaveBeenCalled()
  })

  it("keys: up increases (regression: Zag), pages, edges, wrap", () => {
    const t = make({ defaultValue: 10 })
    t.s.send({ type: "STEP", steps: 1, page: false })
    expect(t.value()).toBe(11)
    t.s.send({ type: "STEP", steps: 1, page: true })
    expect(t.value()).toBe(26)
    t.s.send({ type: "EDGE", edge: "max" })
    t.s.send({ type: "STEP", steps: 1, page: false })
    expect(t.value()).toBe(0)
    expect(t.onValueCommit).toHaveBeenLastCalledWith(0, { reason: "keyboard" })
  })

  it("read-only and disabled never change", () => {
    for (const over of [{ readOnly: true }, { disabled: true }]) {
      const t = make(over)
      t.s.send({ type: "POINTER.DOWN", angle: 90, onThumb: false, modality: "pointer" })
      t.s.send({ type: "STEP", steps: 1, page: false })
      expect(t.value()).toBe(0)
    }
  })

  it("keys map without mirroring; Escape only while dragging", () => {
    const k = (key: string, shift = false) =>
      angleSliderKeyEvent(
        { key, shift, alt: false, ctrl: false, meta: false, composing: false } as never,
        { dragging: false },
      )
    expect(k("ArrowUp")).toEqual({ type: "STEP", steps: 1, page: false })
    expect(k("ArrowLeft", true)).toEqual({ type: "STEP", steps: -1, page: true })
    expect(k("Escape")).toBeNull()
  })
})

const api = (over: Partial<Parameters<typeof angleSliderConnect>[0]> = {}) =>
  angleSliderConnect({
    instance: "a",
    value: 90,
    defaultValue: 0,
    step: 1,
    dragging: true,
    disabled: true,
    readOnly: true,
    invalid: true,
    focused: true,
    modality: "keyboard",
    locale: "en-US",
    messages: angleSliderMessages,
    ids: { label: "l", input: "i" },
    rendered: { label: true },
    ...over,
  })
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("angle slider connect", () => {
  it("a native range input with the reachable max and the value text", () => {
    expect(api().input()).toMatchObject({
      type: "range",
      min: 0,
      max: 359,
      "aria-valuetext": "90 degrees",
      "aria-labelledby": "l",
    })
    expect((api().root()["style"] as Record<string, string>)["--rind-angle-slider-angle"]).toBe(
      "90deg",
    )
    expect(api().marker(45)["data-state"]).toBe("under-value")
  })

  it("meta matches the code", () => {
    const a = api()
    const parts = {
      root: a.root(),
      label: a.label(),
      control: a.control(),
      thumb: a.thumb(),
      input: a.input(),
      value: a.valuePart(),
      "marker-group": a.markerGroup(),
      marker: a.marker(10),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        angleSliderMeta.dataAttributes[part as keyof typeof angleSliderMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(angleSliderMeta.contract.queries).toEqual(Object.keys(angleSliderContract.queries))
    expect(Object.keys(angleSliderMeta.states)).toEqual(Object.keys(angleSliderMachine.def.states))
  })
})
