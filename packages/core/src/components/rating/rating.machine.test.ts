// The Rating machine in Node: grid and bounds, presses (half, clear), keys, the hover preview,
// controlled proposals, assistive-technology adjustment and reset — with recording inputs.
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import {
  normalizeRating,
  type RatingEvent,
  type RatingKey,
  type RatingMachineProps,
  ratingAt,
  ratingKeyTarget,
  ratingMachine,
  ratingRange,
} from "./rating.machine"

function make(over: RatingMachineProps = {}) {
  const onValueChange = vi.fn()
  const syncs: [number, boolean][] = []
  const focused: string[] = []
  let props: RatingMachineProps = { onValueChange, ...over }
  const env = {
    inputs: { sync: (v: number, dispatch: boolean) => syncs.push([v, dispatch]) },
    focusInput: (m: string) => focused.push(m),
  }
  const s = createService(ratingMachine, props as never, env as never)
  s.start()
  return {
    syncs,
    focused,
    onValueChange,
    state: () => s.getSnapshot().state,
    value: () => s.view(props as never).values.value,
    preview: () => s.getSnapshot().context.preview,
    send: (e: RatingEvent) => s.send(e as never),
    key: (type: RatingKey) => s.send({ type, modality: "keyboard" } as never),
    press: (index: number, fraction = 0.5) =>
      s.send({ type: "PRESS", index, fraction, modality: "pointer" } as never),
    setProps: (p: Partial<RatingMachineProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}

describe("grid", () => {
  it("normalises to [0, count] on the step grid", () => {
    const whole = ratingRange({})
    const half = ratingRange({ allowHalf: true, count: 10 })
    expect(normalizeRating(3.4, whole)).toBe(3)
    expect(normalizeRating(3.6, whole)).toBe(4)
    expect(normalizeRating(3.3, half)).toBe(3.5)
    expect(normalizeRating(-1, whole)).toBe(0)
    expect(normalizeRating(99, whole)).toBe(5)
    expect(normalizeRating(Number.NaN, whole)).toBe(0)
    expect(ratingRange({ count: 0 }).count).toBe(5)
  })

  it("a star's first half is a half value only with allowHalf", () => {
    expect(ratingAt(3, 0.2, ratingRange({}))).toBe(3)
    expect(ratingAt(3, 0.2, ratingRange({ allowHalf: true }))).toBe(2.5)
    expect(ratingAt(3, 0.5, ratingRange({ allowHalf: true }))).toBe(3)
  })

  it("keys stop at the floor unless allowClear; unrated stays unrated going down", () => {
    const r = ratingRange({})
    expect(ratingKeyTarget("DECREASE", 1, r)).toBe(1)
    expect(ratingKeyTarget("DECREASE", 0, r)).toBe(0)
    expect(ratingKeyTarget("INCREASE", 0, r)).toBe(1)
    expect(ratingKeyTarget("INCREASE", 5, r)).toBe(5)
    expect(ratingKeyTarget("FIRST", 4, r)).toBe(1)
    expect(ratingKeyTarget("LAST", 0, r)).toBe(5)
    const c = ratingRange({ allowClear: true, allowHalf: true })
    expect(ratingKeyTarget("DECREASE", 0.5, c)).toBe(0)
    expect(ratingKeyTarget("FIRST", 4, c)).toBe(0)
    expect(ratingKeyTarget("PAGE_PREV", 2.5, c)).toBe(3.5)
    expect(ratingKeyTarget("PAGE_NEXT", 0.5, c)).toBe(0)
  })
})

describe("presses", () => {
  it("a press sets its star, focuses the input without a ring, and dispatches", () => {
    const m = make()
    m.press(4)
    expect(m.value()).toBe(4)
    expect(m.onValueChange).toHaveBeenCalledWith(4, expect.objectContaining({ reason: "PRESS" }))
    expect(m.syncs.at(-1)).toEqual([4, true])
    expect(m.focused).toEqual(["pointer"])
  })

  it("half stars: the first half of star 3 is 2.5", () => {
    const m = make({ allowHalf: true })
    m.press(3, 0.1)
    expect(m.value()).toBe(2.5)
  })

  it("pressing the current value clears only when allowClear (MUI#25533)", () => {
    const fixed = make({ defaultValue: 3 })
    fixed.press(3)
    expect(fixed.value()).toBe(3)
    expect(fixed.onValueChange).not.toHaveBeenCalled()
    const c = make({ defaultValue: 3, allowClear: true })
    c.press(3)
    expect(c.value()).toBe(0)
  })

  it("read-only and disabled ignore presses; read-only still focuses", () => {
    const ro = make({ defaultValue: 2, readOnly: true })
    ro.press(5)
    expect(ro.value()).toBe(2)
    expect(ro.focused).toEqual(["pointer"])
    const off = make({ defaultValue: 2, disabled: true })
    off.press(5)
    off.key("INCREASE")
    expect(off.value()).toBe(2)
  })
})

describe("hover preview", () => {
  it("previews without changing the value; leaving ends it", () => {
    const m = make({ defaultValue: 1, allowHalf: true })
    m.send({ type: "POINTER.MOVE", index: 4, fraction: 0.3 })
    expect(m.state()).toBe("previewing")
    expect(m.preview()).toBe(3.5)
    expect(m.value()).toBe(1)
    expect(m.onValueChange).not.toHaveBeenCalled()
    m.send({ type: "POINTER.LEAVE" })
    expect(m.state()).toBe("idle")
    expect(m.preview()).toBeNull()
  })

  it("no preview while read-only; becoming read-only ends one", () => {
    const ro = make({ readOnly: true })
    ro.send({ type: "POINTER.MOVE", index: 4, fraction: 0.9 })
    expect(ro.state()).toBe("idle")
    const m = make()
    m.send({ type: "POINTER.MOVE", index: 4, fraction: 0.9 })
    m.setProps({ readOnly: true })
    expect(m.state()).toBe("idle")
  })

  it("a key ends the preview, so the stars show the value it set", () => {
    const m = make({ defaultValue: 2 })
    m.send({ type: "POINTER.MOVE", index: 5, fraction: 0.9 })
    m.key("INCREASE")
    expect(m.state()).toBe("idle")
    expect(m.value()).toBe(3)
  })
})

describe("controlled", () => {
  it("a refused proposal leaves the value and re-syncs the inputs", () => {
    const m = make({ value: 2 })
    m.key("INCREASE")
    expect(m.onValueChange).toHaveBeenCalledWith(3, expect.anything())
    m.setProps({ value: 2 })
    expect(m.value()).toBe(2)
    expect(m.syncs.at(-1)).toEqual([2, false])
  })

  it("an applied proposal dispatches once the prop arrives", () => {
    const m = make({ value: 2 })
    m.key("INCREASE")
    expect(m.syncs.some(([, d]) => d)).toBe(false)
    m.setProps({ value: 3 })
    expect(m.syncs.at(-1)).toEqual([3, true])
  })
})

describe("assistive technology and reset", () => {
  it("adopts a native change on the grid; the carrier dispatches it", () => {
    const m = make({ defaultValue: 1, allowHalf: true })
    m.send({ type: "INPUT.CHANGE", value: 3.4 })
    expect(m.value()).toBe(3.5)
    expect(m.syncs).toContainEqual([3.5, true])
  })

  it("refuses a native 0 when not allowClear", () => {
    const m = make({ defaultValue: 2 })
    m.send({ type: "INPUT.CHANGE", value: 0 })
    expect(m.value()).toBe(2)
    expect(m.syncs.at(-1)).toEqual([2, false])
  })

  it("reset restores the current defaultValue silently", () => {
    const m = make({ defaultValue: 2 })
    m.setProps({ defaultValue: 4 })
    m.key("LAST")
    m.send({ type: "RESET" })
    expect(m.value()).toBe(4)
    expect(m.syncs.at(-1)).toEqual([4, false])
    expect(m.onValueChange).toHaveBeenLastCalledWith(
      4,
      expect.objectContaining({ reason: "RESET" }),
    )
  })
})
