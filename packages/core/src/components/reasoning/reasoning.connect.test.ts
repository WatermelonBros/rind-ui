import { describe, expect, it } from "vitest"
import { type ReasoningConnectInput, reasoningConnect } from "./reasoning.connect"
import { reasoningContract } from "./reasoning.contract"
import { reasoningMachine } from "./reasoning.machine"
import { reasoningMessages } from "./reasoning.messages"
import { reasoningMeta } from "./reasoning.meta"

const input = (over: Partial<ReasoningConnectInput> = {}): ReasoningConnectInput => ({
  instance: "r",
  open: true,
  thinking: true,
  duration: null,
  ids: { content: "c" },
  messages: reasoningMessages,
  locale: "en",
  ...over,
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("reasoning meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(reasoningContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(reasoningMeta.contract.actions).toEqual(actions)
    expect(reasoningMeta.contract.queries).toEqual(Object.keys(reasoningContract.queries))
    expect(reasoningMeta.contract.traits).toEqual(reasoningContract.traits)
    expect(Object.keys(reasoningMeta.states)).toEqual(Object.keys(reasoningMachine.def.states))
  })

  it("data attributes", () => {
    const a = reasoningConnect(input())
    const parts = {
      root: a.root(),
      trigger: a.trigger({ focused: true, modality: "keyboard" }),
      content: a.content(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = reasoningMeta.dataAttributes[part as keyof typeof reasoningMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("reasoning connect", () => {
  it("aria-controls only while open; busy while thinking", () => {
    const closed = reasoningConnect(input({ open: false, thinking: false }))
    expect(closed.trigger({ focused: false, modality: "pointer" })).toMatchObject({
      type: "button",
      "aria-expanded": "false",
    })
    expect(closed.trigger({ focused: false, modality: "pointer" })["aria-controls"]).toBeUndefined()
    expect(closed.content()["aria-busy"]).toBeUndefined()
    expect(reasoningConnect(input()).content()["aria-busy"]).toBe("true")
  })

  it("the label follows the lifecycle and the duration", () => {
    expect(reasoningConnect(input()).label).toBe("Thinking…")
    expect(reasoningConnect(input({ thinking: false, duration: 12 })).label).toBe(
      "Thought for 12 seconds",
    )
    expect(reasoningConnect(input({ thinking: false, duration: 1 })).label).toBe(
      "Thought for 1 second",
    )
    expect(reasoningConnect(input({ thinking: false })).label).toBe("Thought for a few seconds")
  })
})
