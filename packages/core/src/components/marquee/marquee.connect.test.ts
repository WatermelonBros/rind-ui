import { describe, expect, it } from "vitest"
import { type MarqueeConnectInput, marqueeConnect } from "./marquee.connect"
import { marqueeContract } from "./marquee.contract"
import { marqueeMachine } from "./marquee.machine"
import { marqueeMessages } from "./marquee.messages"
import { marqueeMeta } from "./marquee.meta"

const input = (over: Partial<MarqueeConnectInput> = {}): MarqueeConnectInput => ({
  instance: "m",
  state: "running",
  paused: false,
  orientation: "horizontal",
  reverse: true,
  autoFill: false,
  duration: 5,
  ids: { viewport: "v" },
  messages: marqueeMessages,
  ...over,
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("marquee meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(marqueeContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(marqueeMeta.contract.actions).toEqual(actions)
    expect(marqueeMeta.contract.queries).toEqual(Object.keys(marqueeContract.queries))
    expect(marqueeMeta.contract.traits).toEqual(marqueeContract.traits)
    expect(Object.keys(marqueeMeta.states)).toEqual(Object.keys(marqueeMachine.def.states))
  })

  it("data attributes", () => {
    const a = marqueeConnect(input({ paused: true }))
    const parts = {
      root: a.root(),
      "pause-trigger": a.pauseTrigger({ focused: true, modality: "keyboard" }),
      viewport: a.viewport(),
      content: a.content(1),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = marqueeMeta.dataAttributes[part as keyof typeof marqueeMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("marquee connect", () => {
  it("the trigger is named by the pause, never pressed, hidden in static", () => {
    expect(
      marqueeConnect(input()).pauseTrigger({ focused: false, modality: "pointer" }),
    ).toMatchObject({
      type: "button",
      "aria-label": "Pause animation",
    })
    const paused = marqueeConnect(input({ paused: true })).pauseTrigger({
      focused: false,
      modality: "pointer",
    })
    expect(paused["aria-label"]).toBe("Play animation")
    expect(paused["aria-pressed"]).toBeUndefined()
    expect(
      marqueeConnect(input({ state: "static" })).pauseTrigger({
        focused: false,
        modality: "pointer",
      })["hidden"],
    ).toBe(true)
  })

  it("only copies are hidden; the duration rides on the viewport", () => {
    const a = marqueeConnect(input())
    expect(a.content(0)["aria-hidden"]).toBeUndefined()
    expect(a.content(1)).toMatchObject({ "aria-hidden": "true", "data-copy": "" })
    expect(a.viewport()["style"]).toMatchObject({
      overflow: "clip",
      contain: "inline-size",
      "--rind-marquee-duration": "5s",
    })
  })

  it("static wraps and stops clipping; vertical lays out a column", () => {
    const still = marqueeConnect(input({ state: "static" }))
    expect(still.viewport()["style"]).toMatchObject({ overflow: "visible" })
    expect(still.content(0)["style"]).toMatchObject({ flexWrap: "wrap", flexShrink: 1 })
    const v = marqueeConnect(input({ orientation: "vertical" }))
    expect(v.content(0)["style"]).toMatchObject({ flexDirection: "column", minBlockSize: "100%" })
  })
})
