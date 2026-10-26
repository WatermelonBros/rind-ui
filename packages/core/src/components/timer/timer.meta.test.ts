import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { timerConnect } from "./timer.connect"
import { timerContract } from "./timer.contract"
import { timerConfig, timerMachine } from "./timer.machine"
import { timerMessages } from "./timer.messages"
import { timerMeta } from "./timer.meta"

const env = { platform: platforms.linux } as unknown as Parameters<typeof timerConnect>[1] // only platform is read

const api = (over: Partial<Parameters<typeof timerConnect>[0]> = {}) =>
  timerConnect(
    {
      instance: "i",
      state: "running",
      value: 15_000,
      config: timerConfig({ id: "i", countdown: true, startMs: 60_000 }),
      locale: "en-US",
      messages: timerMessages,
      ...over,
    },
    env,
  )

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

const trigger = {
  action: "pause" as const,
  tag: "button",
  focused: true,
  modality: "keyboard" as const,
}

describe("timer meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(timerContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(timerMeta.contract.actions).toEqual(actions)
    expect(timerMeta.contract.queries).toEqual(Object.keys(timerContract.queries))
    expect(timerMeta.contract.traits).toEqual(timerContract.traits)
    expect(Object.keys(timerMeta.states)).toEqual(Object.keys(timerMachine.def.states))
  })

  it("data attributes", () => {
    const a = api()
    const parts = {
      root: a.root(),
      area: a.area(),
      control: a.control(),
      item: a.item("seconds"),
      "item-value": a.itemValue("seconds"),
      "item-label": a.itemLabel("seconds"),
      separator: a.separator(),
      "action-trigger": a.actionTrigger({ ...trigger, action: "start" }),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = timerMeta.dataAttributes[part as keyof typeof timerMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("timer connect", () => {
  it("the Area is a timer region named in words, never live", () => {
    const area = api().area()
    expect(area).toMatchObject({ role: "timer", "aria-atomic": "true", "aria-label": "15 seconds" })
    expect(area["aria-live"]).toBeUndefined()
  })

  it("a countdown is displayed rounded up", () => {
    expect(
      api({ value: 9400, config: timerConfig({ id: "i", countdown: true, startMs: 10_000 }) }).text(
        "seconds",
      ),
    ).toBe("10")
    expect(
      api({
        value: 600,
        config: timerConfig({ id: "i", countdown: true, startMs: 10_000 }),
      }).area()["aria-label"],
    ).toBe("1 second")
  })

  it("localised digits", () => {
    expect(api({ locale: "ar-EG", value: 5000 }).text("seconds")).toBe("٠٥")
  })

  it("progress on the Root", () => {
    expect(api().root()["style"]).toEqual({ "--rind-timer-progress": "0.75" })
    expect(api().root()["data-countdown"]).toBe("")
  })

  it("an inapplicable action is disabled but focusable, never hidden", () => {
    const start = api().actionTrigger({ ...trigger, action: "start" })
    expect(start["aria-disabled"]).toBe("true")
    expect(start["disabled"]).toBeUndefined()
    expect(start["hidden"]).toBeUndefined()
    expect(start["data-disabled"]).toBe("")
    expect(api().actionTrigger(trigger)["aria-disabled"]).toBeUndefined()
  })

  it("the separator is hidden from assistive technology", () => {
    expect(api().separator()["aria-hidden"]).toBe("true")
  })

  it("the toggle's word follows the state", () => {
    expect(api({ state: "idle" }).toggleLabel()).toBe("Start")
    expect(api({ state: "running" }).toggleLabel()).toBe("Pause")
    expect(api({ state: "paused" }).toggleLabel()).toBe("Resume")
  })
})
