// Stepper's rules in Node: next / prev / select, the linear rules, disabled and completed
// steps, refusal, controlled landing, focus and announcement only for the user's moves.
import { describe, expect, it } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type StepperProps, stepperMachine, stepReachable, stepStatus } from "./stepper.machine"
import { stepperMessages } from "./stepper.messages"

function make(over: Partial<StepperProps> = {}) {
  const log: Announcement[] = []
  const focused: number[] = []
  const changes: { step: number; reason: string }[] = []
  let props: StepperProps = {
    id: "s",
    count: 4,
    messages: stepperMessages,
    titles: new Map([
      [0, "Cart"],
      [1, "Shipping"],
      [2, "Payment"],
      [3, "Review"],
    ]),
    onStepChange: (step, d) => changes.push({ step, reason: d.reason }),
    ...over,
  }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    focusContent: (i: number) => focused.push(i),
  }
  const s = createService(stepperMachine, props, env)
  s.start()
  const set = (next: Partial<StepperProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  const step = () => s.view(props as never).values.step
  const reachable = (i: number) => stepReachable(props, s.getSnapshot().context, step(), i)
  return { s, set, step, reachable, changes, focused, said: () => log.map((a) => a.message) }
}

describe("stepper machine", () => {
  it("next and prev; disabled at the ends", () => {
    const m = make()
    m.s.send({ type: "PREV" })
    expect(m.step()).toBe(0)
    m.s.send({ type: "NEXT" })
    m.s.send({ type: "NEXT" })
    m.s.send({ type: "NEXT" })
    m.s.send({ type: "NEXT" })
    expect(m.step()).toBe(3)
    m.s.send({ type: "PREV" })
    expect(m.step()).toBe(2)
    expect(m.changes.map((c) => c.reason)).toEqual(["next", "next", "next", "prev"])
  })

  it("linear: back to any visited step, never beyond by select (reka#2437)", () => {
    const m = make()
    expect(m.reachable(1)).toBe(false)
    m.s.send({ type: "SELECT", index: 1 })
    expect(m.step()).toBe(0)
    m.s.send({ type: "NEXT" })
    m.s.send({ type: "NEXT" })
    m.s.send({ type: "SELECT", index: 0 })
    expect(m.step()).toBe(0)
    expect(m.reachable(2)).toBe(true)
    expect(m.reachable(3)).toBe(false)
  })

  it("non-linear: any step that is not disabled", () => {
    const m = make({ linear: false, disabledSteps: new Set([2]) })
    expect(m.reachable(3)).toBe(true)
    expect(m.reachable(2)).toBe(false)
    m.s.send({ type: "SELECT", index: 3 })
    expect(m.step()).toBe(3)
  })

  it("next and prev skip disabled steps; an unmounted disabled step stops counting", () => {
    const m = make({ disabledSteps: new Set([1]) })
    m.s.send({ type: "NEXT" })
    expect(m.step()).toBe(2)
    m.s.send({ type: "PREV" })
    expect(m.step()).toBe(0)
    m.set({ disabledSteps: new Set() })
    m.s.send({ type: "NEXT" })
    expect(m.step()).toBe(1)
  })

  it("a cancelled change does not move, focus or announce", () => {
    const m = make({ onStepChange: (_s, d) => d.cancel() })
    m.s.send({ type: "NEXT" })
    expect(m.step()).toBe(0)
    expect(m.focused).toEqual([])
    expect(m.said()).toEqual([])
  })

  it("the user's move focuses and announces; a parent's change does not", () => {
    const m = make()
    m.s.send({ type: "NEXT" })
    expect(m.focused).toEqual([1])
    expect(m.said()).toEqual(["Step 2 of 4: Shipping"])
    const c = make({ step: 0 })
    c.set({ step: 2 })
    expect(c.focused).toEqual([])
    c.s.send({ type: "NEXT" })
    expect(c.focused).toEqual([])
    c.set({ step: 3 })
    expect(c.focused).toEqual([3])
  })

  it("status: before current completed unless an item says otherwise", () => {
    const props = {
      id: "s",
      count: 4,
      messages: stepperMessages,
      completedSteps: new Map([[0, false]]),
    }
    expect(stepStatus(props, 2, 0)).toBe("upcoming")
    expect(stepStatus(props, 2, 1)).toBe("completed")
    expect(stepStatus(props, 2, 2)).toBe("current")
    expect(stepStatus(props, 2, 3)).toBe("upcoming")
  })
})
