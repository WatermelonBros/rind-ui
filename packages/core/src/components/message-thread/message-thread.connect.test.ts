import { describe, expect, it } from "vitest"
import {
  feedKeyAction,
  type MessageThreadConnectInput,
  messageThreadConnect,
} from "./message-thread.connect"
import { messageThreadContract } from "./message-thread.contract"
import { messageThreadMachine } from "./message-thread.machine"
import { messageThreadMessages } from "./message-thread.messages"
import { messageThreadMeta } from "./message-thread.meta"

const input = (over: Partial<MessageThreadConnectInput> = {}): MessageThreadConnectInput => ({
  instance: "t",
  state: "detached",
  anchor: "bottom",
  count: 3,
  unread: 2,
  atBottom: true,
  loadingOlder: true,
  messages: messageThreadMessages,
  locale: "en",
  ...over,
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("message-thread meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(messageThreadContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(messageThreadMeta.contract.actions).toEqual(actions)
    expect(messageThreadMeta.contract.queries).toEqual(Object.keys(messageThreadContract.queries))
    expect(Object.keys(messageThreadMeta.states)).toEqual(
      Object.keys(messageThreadMachine.def.states),
    )
  })

  it("data attributes", () => {
    const a = messageThreadConnect(input())
    const parts = {
      root: a.root(),
      viewport: a.viewport(false, { focused: true, modality: "keyboard" }),
      message: a.message({
        index: 0,
        from: "user",
        named: false,
        focus: { focused: true, modality: "keyboard" },
      }),
      "jump-to-latest": a.jumpToLatest(false),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        messageThreadMeta.dataAttributes[part as keyof typeof messageThreadMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("message-thread connect", () => {
  it("a named, focusable feed of positioned articles; never live", () => {
    const a = messageThreadConnect(input({ loadingOlder: false }))
    expect(a.viewport(false)).toMatchObject({
      role: "feed",
      "aria-label": "Conversation",
      tabindex: 0,
    })
    expect(a.viewport(false)["aria-live"]).toBeUndefined()
    expect(a.viewport(false)["aria-busy"]).toBeUndefined()
    expect(a.message({ index: 1, from: "assistant", named: false })).toMatchObject({
      role: "article",
      "aria-label": "Assistant",
      "aria-posinset": 2,
      "aria-setsize": 3,
    })
  })

  it("jump: shown only detached, named with the unread count", () => {
    expect(messageThreadConnect(input()).jumpToLatest(false)["aria-label"]).toBe(
      "2 new messages, jump to latest",
    )
    expect(messageThreadConnect(input({ unread: 0 })).jumpToLatest(false)["aria-label"]).toBe(
      "Jump to latest message",
    )
    expect(messageThreadConnect(input({ state: "following" })).showJump).toBe(false)
  })

  it("feed keys; a text field keeps them", () => {
    const k = (key: string, ctrlKey = false, targetOwnsKeys = false) =>
      feedKeyAction({ key, ctrlKey, metaKey: false, targetOwnsKeys })
    expect(k("PageDown")).toBe("next")
    expect(k("PageUp")).toBe("previous")
    expect(k("End", true)).toBe("after")
    expect(k("Home", true)).toBe("before")
    expect(k("PageDown", false, true)).toBeNull()
    expect(k("End")).toBeNull()
  })
})
