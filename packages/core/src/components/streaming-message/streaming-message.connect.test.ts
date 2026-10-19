import { describe, expect, it } from "vitest"
import { streamingMessageConnect } from "./streaming-message.connect"
import { streamingMessageContract } from "./streaming-message.contract"
import { streamingMessageMachine } from "./streaming-message.machine"
import { streamingMessageMeta } from "./streaming-message.meta"

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("streaming-message meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(streamingMessageContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(streamingMessageMeta.contract.actions).toEqual(actions)
    expect(streamingMessageMeta.contract.queries).toEqual(
      Object.keys(streamingMessageContract.queries),
    )
    expect(Object.keys(streamingMessageMeta.states)).toEqual(
      Object.keys(streamingMessageMachine.def.states),
    )
  })

  it("data attributes", () => {
    const a = streamingMessageConnect({ instance: "m", state: "streaming", plain: true })
    const parts = { root: a.root(), content: a.content(), caret: a.caret() }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        streamingMessageMeta.dataAttributes[
          part as keyof typeof streamingMessageMeta.dataAttributes
        ]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("streaming-message connect", () => {
  it("busy only while streaming or settling; never a live region", () => {
    for (const state of ["streaming", "settling"] as const) {
      const c = streamingMessageConnect({ instance: "m", state, plain: false }).content()
      expect(c["aria-busy"]).toBe("true")
      expect(c["aria-live"]).toBeUndefined()
    }
    for (const state of ["pending", "complete", "cancelled", "error"] as const) {
      const a = streamingMessageConnect({ instance: "m", state, plain: false })
      expect(a.busy).toBe(false)
      expect(a.content()["aria-busy"]).toBeUndefined()
      expect(a.content()["data-busy"]).toBeUndefined()
    }
  })

  it("plain text keeps its line breaks; the caret is hidden", () => {
    const a = streamingMessageConnect({ instance: "m", state: "complete", plain: true })
    expect(a.content()["style"]).toEqual({ whiteSpace: "pre-wrap" })
    expect(a.caret()["aria-hidden"]).toBe("true")
  })
})
