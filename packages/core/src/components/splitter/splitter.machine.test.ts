// The Splitter machine in Node (task 1.3): every transition with a recording drag capability.
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import {
  type SplitterDragMessage,
  type SplitterEvent,
  type SplitterMachineProps,
  splitterMachine,
  splitterSizes,
} from "./splitter.machine"

function make(over: Partial<SplitterMachineProps> = {}) {
  const onSizesChange = vi.fn()
  const onSizesCommit = vi.fn()
  const focused: [number, string][] = []
  let drag: ((m: SplitterDragMessage) => void) | null = null
  let props: SplitterMachineProps = { panels: [{}, {}], onSizesChange, onSizesCommit, ...over }
  const env = {
    drag: {
      track: (send: (m: SplitterDragMessage) => void) => {
        drag = send
        return () => {
          drag = null
        }
      },
    },
    focusHandle: (i: number, modality: string) => focused.push([i, modality]),
  }
  const s = createService(splitterMachine, props as never, env as never)
  s.start()
  return {
    focused,
    onSizesChange,
    onSizesCommit,
    state: () => s.getSnapshot().state,
    sizes: () => splitterSizes(props, s.view(props as never).values.sizes),
    send: (e: SplitterEvent) => s.send(e as never),
    down: (handle = 0) => s.send({ type: "POINTER.DOWN", handle, modality: "pointer" } as never),
    move: (delta: number) => drag?.({ type: "move", delta }),
    up: () => drag?.({ type: "up" }),
    cancel: () => drag?.({ type: "cancel" }),
    setProps: (p: Partial<SplitterMachineProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}

describe("keyboard", () => {
  it("steps, edges and toggles commit once each", () => {
    const m = make({ panels: [{ collapsible: true, min: 10 }, {}], defaultSizes: [30, 70] })
    m.send({ type: "STEP", handle: 0, direction: 1 })
    expect(m.sizes()).toEqual([35, 65])
    m.send({ type: "TO_EDGE", handle: 0, edge: "max" })
    expect(m.sizes()).toEqual([100, 0])
    m.send({ type: "STEP", handle: 0, direction: -1 })
    m.send({ type: "TOGGLE", handle: 0 })
    expect(m.sizes()).toEqual([0, 100])
    m.send({ type: "TOGGLE", handle: 0 })
    expect(m.sizes()).toEqual([95, 5])
    expect(m.onSizesCommit.mock.calls.map((c) => c[1].reason)).toEqual([
      "STEP",
      "TO_EDGE",
      "STEP",
      "TOGGLE",
      "TOGGLE",
    ])
  })

  it("a step that changes nothing commits nothing", () => {
    const m = make({ defaultSizes: [100, 0] })
    m.send({ type: "STEP", handle: 0, direction: 1 })
    expect(m.onSizesCommit).not.toHaveBeenCalled()
  })

  it("guards: disabled Root or handle, unknown handle (no focus state: zag#3223)", () => {
    const m = make({ disabled: true })
    m.send({ type: "STEP", handle: 0, direction: 1 })
    m.setProps({ disabled: false, handleDisabled: [true] })
    m.send({ type: "STEP", handle: 0, direction: 1 })
    m.send({ type: "STEP", handle: 1, direction: 1 })
    expect(m.sizes()).toEqual([50, 50])
    m.setProps({ handleDisabled: [] })
    m.send({ type: "STEP", handle: 0, direction: 1 })
    expect(m.sizes()).toEqual([55, 45])
  })
})

describe("pointer", () => {
  it("drags from the press sizes and commits once at the release", () => {
    const m = make()
    m.down()
    expect(m.state()).toBe("dragging")
    expect(m.focused).toEqual([[0, "pointer"]])
    for (let d = 1; d <= 10; d++) m.move(d)
    expect(m.sizes()).toEqual([60, 40])
    m.up()
    expect(m.state()).toBe("idle")
    expect(m.onSizesChange).toHaveBeenCalledTimes(10)
    expect(m.onSizesCommit).toHaveBeenCalledTimes(1)
    expect(m.onSizesCommit).toHaveBeenCalledWith([60, 40], { reason: "POINTER.UP" })
  })

  it("a release without movement commits nothing", () => {
    const m = make()
    m.down()
    m.up()
    expect(m.onSizesCommit).not.toHaveBeenCalled()
  })

  it("cancel and disabled mid-drag restore the press sizes", () => {
    const m = make()
    m.down()
    m.move(20)
    m.cancel()
    expect(m.sizes()).toEqual([50, 50])
    m.down()
    m.move(20)
    m.setProps({ disabled: true })
    expect(m.state()).toBe("idle")
    expect(m.sizes()).toEqual([50, 50])
    expect(m.onSizesCommit).not.toHaveBeenCalled()
  })
})

describe("constraints", () => {
  it("new constraints clamp the sizes without a commit (RRP#720)", () => {
    const m = make({ defaultSizes: [30, 70] })
    m.send({ type: "STEP", handle: 0, direction: -1 })
    m.setProps({ panels: [{ min: 40 }, {}] })
    expect(m.sizes()).toEqual([40, 60])
    expect(m.onSizesCommit).toHaveBeenCalledTimes(1)
  })

  it("a controlled parent's change commits nothing", () => {
    const m = make({ sizes: [30, 70] })
    m.setProps({ sizes: [40, 60] })
    expect(m.sizes()).toEqual([40, 60])
    expect(m.onSizesCommit).not.toHaveBeenCalled()
    expect(m.onSizesChange).not.toHaveBeenCalled()
  })
})
