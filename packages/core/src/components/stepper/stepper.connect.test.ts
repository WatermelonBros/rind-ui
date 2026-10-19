import { describe, expect, it } from "vitest"
import { type StepperConnectInput, stepperConnect } from "./stepper.connect"
import { stepperContract } from "./stepper.contract"
import { stepperMachine } from "./stepper.machine"
import { stepperMessages } from "./stepper.messages"
import { stepperMeta } from "./stepper.meta"

const titles = ["Cart", "Shipping", "Payment", "Review"]
const input = (over: Partial<StepperConnectInput> = {}): StepperConnectInput => ({
  instance: "s",
  step: 1,
  count: 4,
  orientation: "horizontal",
  status: (i) => (i < 1 ? "completed" : i === 1 ? "current" : "upcoming"),
  reachable: (i) => i === 0,
  disabled: (i) => i === 3,
  title: (i) => titles[i] ?? "",
  hasNext: true,
  hasPrev: true,
  ids: { content: (i) => `c${i}`, description: (i) => `d${i}` },
  messages: stepperMessages,
  locale: "en",
  ...over,
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("stepper meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(stepperContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(stepperMeta.contract.actions).toEqual(actions)
    expect(stepperMeta.contract.queries).toEqual(Object.keys(stepperContract.queries))
    expect(Object.keys(stepperMeta.states)).toEqual(Object.keys(stepperMachine.def.states))
  })

  it("data attributes", () => {
    const a = stepperConnect(input())
    const kb = { focused: true, modality: "keyboard" as const }
    const parts = {
      root: a.root(),
      list: a.list(),
      item: a.item(3),
      trigger: a.trigger(3, false, kb),
      indicator: a.indicator(3),
      title: a.title(3),
      description: a.description(3),
      separator: a.separator(3),
      content: a.content(3, kb),
      "prev-trigger": a.prevTrigger(kb),
      "next-trigger": a.nextTrigger(kb),
      progress: a.progress(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = stepperMeta.dataAttributes[part as keyof typeof stepperMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("stepper connect", () => {
  it("current item, reachable steps as buttons, status in the name", () => {
    const a = stepperConnect(input())
    expect(a.item(1)["aria-current"]).toBe("step")
    expect(a.item(0)["aria-current"]).toBeUndefined()
    expect(a.triggerIsButton(0)).toBe(true)
    expect(a.trigger(0, false)["type"]).toBe("button")
    expect(a.triggerIsButton(2)).toBe(false)
    expect(a.trigger(2, false)["type"]).toBeUndefined()
    expect(a.statusText(0)).toBe(" (completed)")
    expect(a.statusText(2)).toBe(" (not started)")
  })

  it("content: a labelled region, hidden unless current; progress text", () => {
    const a = stepperConnect(input())
    expect(a.content(1)).toMatchObject({
      role: "region",
      tabindex: -1,
      "aria-label": "Step 2 of 4: Shipping",
    })
    expect(a.content(1)["hidden"]).toBeUndefined()
    expect(a.content(0)["hidden"]).toBe(true)
    expect(a.progressText).toBe("Step 2 of 4")
    expect(stepperConnect(input({ hasNext: false })).nextTrigger()["disabled"]).toBe(true)
  })
})
