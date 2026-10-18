// Prompt Input connect in Node: the derived attributes and the rethrow of a synchronous
// `onSubmit` throw to whatever submitted.
import { describe, expect, it, vi } from "vitest"
import { platforms } from "../../dom/platform"
import { type PromptInputConnectView, promptInputConnect } from "./prompt-input.connect"
import type { PromptInputContext } from "./prompt-input.machine"
import { promptInputMessages } from "./prompt-input.messages"

const context: PromptInputContext = {
  focusedChip: null,
  focusedChipModality: null,
  armedChip: null,
  focused: false,
  composing: false,
  committed: "",
  dragging: false,
  token: 0,
  pending: false,
  snapshot: null,
  historyIndex: null,
  savedDraft: "",
  nextId: 0,
}

const env = {
  dom: { getById: () => null },
  modality: { modality: () => "keyboard" as const },
  platform: platforms.linux,
  scheduler: {
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  },
}

function view(over: Partial<PromptInputConnectView> = {}): PromptInputConnectView {
  return {
    instance: "p",
    state: "idle",
    context,
    value: "hi",
    attachments: [],
    props: {},
    submitKey: "enter",
    touchPrimary: false,
    multiple: true,
    name: "message",
    filesName: "files",
    textareaId: "t",
    countMounted: false,
    modality: "keyboard",
    dir: "ltr",
    locale: "en",
    messages: promptInputMessages,
    focusedButton: null,
    setFocusedButton: () => {},
    nativeAction: false,
    takeThrown: () => null,
    takeReason: () => undefined,
    send: () => {},
    ...over,
  }
}

const submitEvent = () => ({ currentTarget: null, preventDefault: vi.fn() })

describe("Prompt Input connect", () => {
  it("a synchronous throw of onSubmit is rethrown to the submitter after the send", () => {
    const boom = new Error("boom")
    const send = vi.fn()
    let thrown: { error: unknown } | null = null
    const api = promptInputConnect(
      view({
        send: (e) => {
          send(e)
          thrown = { error: boom }
        },
        takeThrown: () => {
          const t = thrown
          thrown = null
          return t
        },
      }),
      env as never,
    )
    const onSubmit = api.root()["onSubmit"] as (e: unknown) => void
    expect(() => onSubmit(submitEvent())).toThrow(boom)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "SUBMIT" }))
  })

  it("a coarse pointer makes Enter a newline (enterkeyhint); a fine one sends", () => {
    expect(promptInputConnect(view(), env as never).textarea()["enterKeyHint"]).toBe("send")
    expect(
      promptInputConnect(view({ touchPrimary: true }), env as never).textarea()["enterKeyHint"],
    ).toBe("enter")
  })

  it("while composing, the count, the limit and aria-invalid stay at the committed draft", () => {
    const api = promptInputConnect(
      view({
        value: "abcdef",
        props: { limit: 3 },
        context: { ...context, composing: true, committed: "ab" },
        state: "composing",
      }),
      env as never,
    )
    expect(api.derived.used).toBe(2)
    expect(api.textarea()["aria-invalid"]).toBeUndefined()
    expect(api.root()["data-over-limit"]).toBeUndefined()
  })
})
