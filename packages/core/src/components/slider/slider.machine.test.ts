// The Slider machine in Node (task 1.3): keys, track press, thumb press without a jump,
// stacks, cancel, commit counts, controlled proposals, assistive-technology adjustment and
// reset — with a recording drag capability and recording inputs.
import { describe, expect, it, vi } from "vitest"
import type { DragMessage } from "../../dom/pointer-drag"
import { createService } from "../../machine/service"
import {
  type SliderEvent,
  type SliderKey,
  type SliderMachineProps,
  sliderMachine,
} from "./slider.machine"

function make(over: SliderMachineProps = {}) {
  const onValueChange = vi.fn()
  const onValueCommit = vi.fn()
  const syncs: { values: number[]; dispatch: boolean[] }[] = []
  const focused: [number, string][] = []
  let drag: ((m: DragMessage) => void) | null = null
  let props: SliderMachineProps = { onValueChange, onValueCommit, ...over }
  const env = {
    inputs: {
      sync: (values: readonly number[], dispatch: readonly boolean[]) =>
        syncs.push({ values: [...values], dispatch: [...dispatch] }),
    },
    drag: {
      track: (send: (m: DragMessage) => void) => {
        drag = send
        return () => {
          drag = null
        }
      },
    },
    focusThumb: (i: number, modality: string) => focused.push([i, modality]),
  }
  const s = createService(sliderMachine, props as never, env as never)
  s.start()
  const value = () => s.view(props as never).values.value
  return {
    s,
    syncs,
    focused,
    onValueChange,
    onValueCommit,
    state: () => s.getSnapshot().state,
    value,
    context: () => s.getSnapshot().context,
    send: (e: SliderEvent) => s.send(e as never),
    key: (type: SliderKey, thumb = 0, shift = false) =>
      s.send({ type, thumb, shift, modality: "keyboard" } as never),
    down: (fraction: number | null, thumb: number | null = null) =>
      s.send({ type: "POINTER.DOWN", fraction, thumb, modality: "pointer" } as never),
    /** The drag capability's messages, as pointer-drag sends them. */
    move: (fraction: number) => drag?.({ type: "move", fraction }),
    up: () => drag?.({ type: "up" }),
    cancel: () => drag?.({ type: "cancel" }),
    dragging: () => drag !== null,
    setProps: (p: Partial<SliderMachineProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    commits: () => onValueCommit.mock.calls.map((c) => c[0]),
  }
}

describe("keyboard", () => {
  it("steps, large steps, pages and edges, committing each step (RX#3619)", () => {
    const m = make({ defaultValue: [10] })
    m.key("INCREASE")
    expect(m.value()).toEqual([11])
    m.key("INCREASE", 0, true)
    expect(m.value()).toEqual([21])
    m.key("PAGE_PREV")
    expect(m.value()).toEqual([31])
    m.key("PAGE_NEXT")
    m.key("DECREASE")
    expect(m.value()).toEqual([20])
    m.key("LAST")
    expect(m.value()).toEqual([100])
    m.key("FIRST")
    expect(m.value()).toEqual([0])
    expect(m.onValueCommit).toHaveBeenCalledTimes(7)
    expect(m.onValueCommit.mock.calls[0]?.[1]).toEqual({ reason: "INCREASE" })
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("INCREASE")
  })

  it("PageUp increases by largeStep (RX#715)", () => {
    const m = make({ defaultValue: [10], largeStep: 10 })
    m.key("PAGE_PREV")
    expect(m.value()).toEqual([20])
  })

  it("stops at the neighbour", () => {
    const m = make({ defaultValue: [20, 21] })
    m.key("INCREASE")
    m.key("INCREASE")
    expect(m.value()).toEqual([21, 21])
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
  })

  it("does nothing disabled, read-only, or on a disabled thumb", () => {
    for (const p of [{ disabled: true }, { readOnly: true }, { thumbDisabled: [true] }]) {
      const m = make({ defaultValue: [50], ...p })
      m.key("INCREASE")
      expect(m.value()).toEqual([50])
      expect(m.onValueChange).not.toHaveBeenCalled()
    }
  })

  it("dispatches input/change on the changed input only", () => {
    const m = make({ defaultValue: [20, 80] })
    m.key("INCREASE", 1)
    expect(m.syncs.at(-1)).toEqual({ values: [20, 81], dispatch: [false, true] })
  })
})

describe("pointer", () => {
  it("a track press moves the nearest thumb, focuses it without a ring, and commits on release (BU#5772)", () => {
    const m = make({ defaultValue: [10] })
    m.down(0.75)
    expect(m.state()).toBe("dragging")
    expect(m.value()).toEqual([75])
    expect(m.focused).toEqual([[0, "pointer"]])
    expect(m.onValueChange.mock.calls[0]?.[1].reason).toBe("POINTER.DOWN")
    m.up()
    expect(m.state()).toBe("idle")
    expect(m.commits()).toEqual([[75]])
    expect(m.onValueCommit.mock.calls[0]?.[1]).toEqual({ reason: "POINTER.UP" })
  })

  it("a thumb press does not move it; release without a move commits nothing (ZG#541)", () => {
    const m = make({ defaultValue: [40] })
    m.down(0.4, 0)
    expect(m.value()).toEqual([40])
    m.up()
    expect(m.onValueChange).not.toHaveBeenCalled()
    expect(m.onValueCommit).not.toHaveBeenCalled()
  })

  it("drags and commits the last value once (RX#4154, KB#322)", () => {
    const m = make({ defaultValue: [20, 80] })
    m.down(0.2, 0)
    m.move(0.3)
    m.move(0.5)
    m.up()
    expect(m.value()).toEqual([50, 80])
    expect(m.commits()).toEqual([[50, 80]])
    expect(m.dragging()).toBe(false)
  })

  it("a range narrowed to one value commits once (RX#3698)", () => {
    const m = make({ defaultValue: [20, 60] })
    m.down(0.2, 0)
    m.move(0.65)
    m.up()
    expect(m.commits()).toEqual([[60, 60]])
  })

  it("stacked at the maximum: the first move decides (BU#1602, RA#6408)", () => {
    const m = make({ defaultValue: [100, 100] })
    m.down(1, 1)
    expect(m.context().stacked).toEqual([0, 1])
    m.move(0.9)
    expect(m.value()).toEqual([90, 100])
    expect(m.context().dragging).toBe(0)
  })

  it("skips a disabled thumb (RA#942)", () => {
    const m = make({ defaultValue: [20, 80], thumbDisabled: [true, false] })
    m.down(0.1)
    expect(m.value()).toEqual([20, 20])
  })

  it("Escape (DRAG.CANCEL) and pointercancel restore the press value and commit nothing", () => {
    const m = make({ defaultValue: [20] })
    m.down(0.2, 0)
    m.move(0.6)
    expect(m.value()).toEqual([60])
    m.send({ type: "DRAG.CANCEL" })
    expect(m.state()).toBe("idle")
    expect(m.value()).toEqual([20])
    expect(m.dragging()).toBe(false)
    m.down(0.5)
    m.cancel()
    expect(m.value()).toEqual([20])
    expect(m.onValueCommit).not.toHaveBeenCalled()
    expect(m.onValueChange.mock.calls.at(-1)?.[1].reason).toBe("DRAG.CANCEL")
  })

  it("becoming disabled mid-drag cancels it", () => {
    const m = make({ defaultValue: [20], disabled: false })
    m.down(0.2, 0)
    m.move(0.6)
    m.setProps({ disabled: true })
    expect(m.state()).toBe("idle")
    expect(m.value()).toEqual([20])
  })

  it("swap moves the drag and focus to the other thumb (RX#730)", () => {
    const m = make({ defaultValue: [20, 60], thumbCollision: "swap" })
    m.down(0.2, 0)
    m.move(0.7)
    expect(m.value()).toEqual([60, 70])
    expect(m.context().dragging).toBe(1)
    expect(m.focused.at(-1)).toEqual([1, "pointer"])
    m.move(0.8)
    expect(m.value()).toEqual([60, 80])
  })

  it("push moves the neighbour", () => {
    const m = make({ defaultValue: [20, 60], thumbCollision: "push" })
    m.down(0.2, 0)
    m.move(0.7)
    expect(m.value()).toEqual([70, 70])
  })

  it("a press without layout proposes nothing (BU#4303)", () => {
    const m = make({ defaultValue: [20] })
    m.down(null)
    expect(m.onValueChange).not.toHaveBeenCalled()
    m.up()
    expect(m.state()).toBe("idle")
  })

  it("ignores presses while disabled or read-only", () => {
    for (const p of [{ disabled: true }, { readOnly: true }]) {
      const m = make({ defaultValue: [20], ...p })
      m.down(0.5)
      expect(m.state()).toBe("idle")
    }
  })
})

describe("controlled", () => {
  it("a refused drag stays at the controlled value and commits nothing (ARK#3270)", () => {
    const m = make({ value: [30] })
    m.down(0.3, 0)
    m.move(0.6)
    expect(m.value()).toEqual([30])
    m.setProps({ value: [30] })
    m.up()
    m.setProps({ value: [30] })
    expect(m.onValueCommit).not.toHaveBeenCalled()
    expect(m.context().pending).toBeNull()
  })

  it("an applied drag commits the applied value, and dispatches when it arrives", () => {
    const m = make({ value: [30] })
    m.down(0.3, 0)
    m.move(0.6)
    m.setProps({ value: [60] })
    expect(m.syncs.at(-1)).toEqual({ values: [60], dispatch: [true] })
    m.up()
    expect(m.commits()).toEqual([[60]])
  })

  it("a release before the parent applies commits when it does (fast drag)", () => {
    const m = make({ value: [30] })
    m.down(0.3, 0)
    m.move(0.6)
    m.up()
    expect(m.onValueCommit).not.toHaveBeenCalled()
    m.setProps({ value: [60] })
    expect(m.commits()).toEqual([[60]])
  })

  it("an external change then a step proposes from it (RA#5644)", () => {
    const m = make({ value: [10] })
    m.setProps({ value: [70] })
    m.key("INCREASE")
    expect(m.onValueChange.mock.calls[0]?.[0]).toEqual([71])
  })

  it("a native input + change pair proposes once while the parent re-renders", () => {
    const m = make({ value: [20] })
    m.send({ type: "INPUT.CHANGE", thumb: 0, value: 35 })
    m.send({ type: "INPUT.CHANGE", thumb: 0, value: 35 })
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    m.setProps({ value: [35] })
    expect(m.commits()).toEqual([[35]])
  })

  it("a cancelled proposal reverts the inputs", () => {
    const m = make({ defaultValue: [10], onValueChange: (_v, d) => d.cancel() })
    m.key("INCREASE")
    expect(m.value()).toEqual([10])
    expect(m.onValueCommit).not.toHaveBeenCalled()
    expect(m.syncs.at(-1)).toEqual({ values: [10], dispatch: [] })
  })
})

describe("assistive technology and reset", () => {
  it("adopts a native change and commits once, without dispatching again (BU#2575)", () => {
    const m = make({ defaultValue: [20, 80] })
    m.send({ type: "INPUT.CHANGE", thumb: 0, value: 35 })
    expect(m.value()).toEqual([35, 80])
    expect(m.commits()).toEqual([[35, 80]])
    expect(m.onValueCommit.mock.calls[0]?.[1]).toEqual({ reason: "INPUT.CHANGE" })
    expect(m.syncs.every((s) => s.dispatch.every((d) => !d))).toBe(true)
  })

  it("bounds a native change by the neighbour, and re-syncs the input", () => {
    const m = make({ defaultValue: [20, 50] })
    m.send({ type: "INPUT.CHANGE", thumb: 0, value: 70.4 })
    expect(m.value()).toEqual([50, 50])
    expect(m.syncs.at(-1)?.values).toEqual([50, 50])
  })

  it("read-only re-syncs and reports nothing", () => {
    const m = make({ defaultValue: [20], readOnly: true })
    m.send({ type: "INPUT.CHANGE", thumb: 0, value: 35 })
    expect(m.value()).toEqual([20])
    expect(m.syncs.at(-1)).toEqual({ values: [20], dispatch: [] })
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("a reset restores the current defaultValue without a commit", () => {
    const m = make({ defaultValue: [30] })
    m.key("LAST")
    m.setProps({ defaultValue: [50] })
    expect(m.value()).toEqual([100])
    m.send({ type: "RESET" })
    expect(m.value()).toEqual([50])
    expect(m.onValueChange.mock.calls.at(-1)?.[1].reason).toBe("RESET")
    expect(m.onValueCommit).toHaveBeenCalledTimes(1)
    expect(m.syncs.at(-1)?.dispatch).toEqual([false])
  })

  it("tracks focus per thumb", () => {
    const m = make({ defaultValue: [20, 80] })
    m.send({ type: "FOCUS", thumb: 1, modality: "keyboard", cause: "key" })
    expect(m.context().focused).toBe(1)
    m.send({ type: "BLUR", thumb: 1, modality: "keyboard" })
    expect(m.context().focused).toBeNull()
  })
})
