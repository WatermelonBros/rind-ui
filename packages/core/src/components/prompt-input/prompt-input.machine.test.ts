// The Prompt Input machine in Node: lifecycle per fixture (promise, status, plain), failed
// sends, stop, double submit, stale settles, composition, attachments, history. No DOM.
import { describe, expect, it, vi } from "vitest"
import { matchesAccept } from "../../dom/file-intake"
import { createService } from "../../machine/service"
import {
  type PromptAttachment,
  type PromptInputProps,
  promptInputMachine,
} from "./prompt-input.machine"
import { promptInputMessages } from "./prompt-input.messages"

function make(over: Partial<PromptInputProps> = {}) {
  const announce = vi.fn()
  const env = { announcer: { announce, prepare: () => () => {}, cancel: () => {} } }
  const onSubmit = vi.fn()
  const onStop = vi.fn()
  let props: PromptInputProps = {
    id: "p",
    locale: "en",
    messages: promptInputMessages,
    onSubmit,
    onStop,
    ...over,
  }
  const s = createService(promptInputMachine, props as never, env as never)
  s.start()
  const send = (e: Parameters<typeof s.send>[0]) => s.send(e)
  return {
    s,
    send,
    onSubmit,
    onStop,
    announce,
    said: () => announce.mock.calls.map(([a]) => a as { message: string; priority: string }),
    setProps: (p: Partial<PromptInputProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    type: (value: string, composing = false) => send({ type: "INPUT", value, composing }),
    submit: () => send({ type: "SUBMIT", event: null, formData: null }),
    value: () => s.view().values.value as string,
    files: () => s.view().values.attachments as readonly PromptAttachment[],
    state: () => s.getSnapshot().state,
    ctx: () => s.getSnapshot().context,
  }
}

const file = (name: string, size = 10, type = "text/plain") =>
  new File([new Uint8Array(size)], name, { type })

describe("Prompt Input machine", () => {
  it("a plain onSubmit: one call with text and attachments, cleared at once, back to idle", () => {
    const m = make()
    m.type("hi")
    m.send({ type: "FILES.ADD", files: [file("a.txt")], via: "picker" })
    m.submit()
    expect(m.onSubmit).toHaveBeenCalledTimes(1)
    const [message] = m.onSubmit.mock.calls[0] ?? []
    expect(message.text).toBe("hi")
    expect(message.attachments.map((a: PromptAttachment) => a.name)).toEqual(["a.txt"])
    expect(m.value()).toBe("")
    expect(m.files()).toEqual([])
    expect(m.state()).toBe("idle")
  })

  it("not submittable: empty, whitespace, pending attachment, over the limit, disabled", () => {
    const m = make()
    m.submit()
    m.type("   ")
    m.submit()
    expect(m.onSubmit).not.toHaveBeenCalled()
    const p = make({ defaultAttachments: [{ id: "x", name: "x.png", pending: true }] })
    p.type("go")
    p.submit()
    expect(p.onSubmit).not.toHaveBeenCalled()
    const l = make({ limit: 3 })
    l.type("toolong")
    l.submit()
    expect(l.onSubmit).not.toHaveBeenCalled()
    const d = make({ disabled: true, defaultValue: "x" })
    d.submit()
    expect(d.onSubmit).not.toHaveBeenCalled()
  })

  it("a promise: submitting until it resolves; text typed meanwhile is kept (ai-elements#518)", async () => {
    let resolve = () => {}
    const m = make({ onSubmit: () => new Promise<void>((r) => (resolve = r)) })
    m.type("first")
    m.submit()
    expect(m.state()).toBe("submitting")
    m.type("second")
    m.submit()
    expect(m.state()).toBe("submitting")
    resolve()
    await vi.waitFor(() => expect(m.state()).toBe("idle"))
    expect(m.value()).toBe("second")
  })

  it("a rejected promise restores into an empty draft and announces assertively (ai-elements#126)", async () => {
    let reject = () => {}
    const m = make({ onSubmit: () => new Promise<void>((_, r) => (reject = () => r(new Error()))) })
    m.type("look")
    m.send({ type: "FILES.ADD", files: [file("photo.jpg")], via: "drop" })
    m.submit()
    reject()
    await vi.waitFor(() => expect(m.state()).toBe("idle"))
    expect(m.value()).toBe("look")
    expect(m.files().map((f) => f.name)).toEqual(["photo.jpg"])
    expect(m.said().filter((a) => a.message === "Message not sent")).toEqual([
      expect.objectContaining({ priority: "assertive" }),
    ])
  })

  it("a failure after a new draft keeps the new draft (assistant-ui#8242)", async () => {
    let reject = () => {}
    const m = make({ onSubmit: () => new Promise<void>((_, r) => (reject = () => r(new Error()))) })
    m.type("old")
    m.send({ type: "FILES.ADD", files: [file("a.txt")], via: "picker" })
    m.submit()
    m.type("other")
    reject()
    await vi.waitFor(() => expect(m.state()).toBe("idle"))
    expect(m.value()).toBe("other")
    expect(m.files()).toEqual([])
  })

  it("status drives the lifecycle; a status change in idle starts it (initial too)", () => {
    const m = make({ status: "idle" })
    m.type("q")
    m.submit()
    expect(m.state()).toBe("submitting")
    m.setProps({ status: "submitting" })
    m.setProps({ status: "streaming" })
    expect(m.state()).toBe("streaming")
    m.setProps({ status: "idle" })
    expect(m.state()).toBe("idle")
    expect(make({ status: "streaming" }).state()).toBe("streaming")
    expect(make().state()).toBe("idle")
  })

  it("status error while submitting fails the send; while streaming it only announces", () => {
    const m = make({ status: "idle" })
    m.type("q")
    m.submit()
    m.setProps({ status: "error" })
    expect(m.state()).toBe("idle")
    expect(m.value()).toBe("q")
    m.submit()
    m.setProps({ status: "streaming" })
    m.setProps({ status: "error" })
    expect(m.state()).toBe("idle")
    expect(m.value()).toBe("")
  })

  it("stop: once, announced; a double click's second click does not stop", () => {
    const m = make({ status: "idle" })
    m.type("q")
    m.submit()
    m.send({ type: "STOP", clickCount: 2 })
    expect(m.onStop).not.toHaveBeenCalled()
    m.setProps({ status: "streaming" })
    m.send({ type: "STOP", clickCount: 1 })
    m.send({ type: "STOP", clickCount: 1 })
    expect(m.onStop).toHaveBeenCalledTimes(1)
    expect(m.state()).toBe("stopped")
    expect(m.said().map((a) => a.message)).toContain("Response stopped")
    m.setProps({ status: "idle" })
    expect(m.state()).toBe("idle")
  })

  it("stop with a pending promise and no status: stopped until it settles", async () => {
    let resolve = () => {}
    const m = make({ onSubmit: () => new Promise<void>((r) => (resolve = r)) })
    m.type("q")
    m.submit()
    m.send({ type: "STOP", clickCount: 0 })
    expect(m.state()).toBe("stopped")
    resolve()
    await vi.waitFor(() => expect(m.state()).toBe("idle"))
  })

  it("a settle of an older submit is ignored", async () => {
    const resolvers: (() => void)[] = []
    const m = make({
      status: "idle",
      onSubmit: () => new Promise<void>((r) => resolvers.push(r)),
    })
    m.type("a")
    m.submit()
    m.setProps({ status: "submitting" })
    m.setProps({ status: "idle" })
    m.type("b")
    m.submit()
    resolvers[0]?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(m.state()).toBe("submitting")
  })

  it("a synchronous throw is a failed send, and the error is not swallowed", () => {
    const boom = new Error("boom")
    const m = make({
      onSubmit: () => {
        throw boom
      },
    })
    // The machine re-raises it as a rejected promise; caught here so the run stays clean.
    const reject = vi.spyOn(Promise, "reject").mockImplementation(() => Promise.resolve() as never)
    m.type("x")
    m.submit()
    expect(m.state()).toBe("idle")
    expect(m.value()).toBe("x")
    expect(reject).toHaveBeenCalledWith(boom)
    reject.mockRestore()
  })

  it("composition: no submit while composing; a dead key without compositionend does not freeze (assistant-ui#3923)", () => {
    const m = make()
    m.send({ type: "COMPOSITION.START" })
    m.type("に", true)
    expect(m.state()).toBe("composing")
    m.submit()
    expect(m.onSubmit).not.toHaveBeenCalled()
    m.type("a")
    expect(m.state()).toBe("idle")
    expect(m.value()).toBe("a")
    m.submit()
    expect(m.onSubmit).toHaveBeenCalledTimes(1)
    m.send({ type: "COMPOSITION.START" })
    m.send({ type: "BLUR" })
    expect(m.state()).toBe("idle")
    expect(m.ctx().composing).toBe(false)
  })

  it("files: accept with extensions, size and count limits, every rejection reported", () => {
    const onReject = vi.fn()
    const m = make({ accept: ".xlsx,image/*", maxFileSize: 100, maxFiles: 2, onReject })
    m.send({
      type: "FILES.ADD",
      files: [
        file("q3.xlsx"),
        file("a.txt"),
        file("p.png", 10, "image/png"),
        file("big.png", 500, "image/png"),
      ],
      via: "drop",
    })
    expect(m.files().map((f) => f.name)).toEqual(["q3.xlsx", "p.png"])
    expect(onReject.mock.calls[0]?.[0].map((r: { reason: string }) => r.reason)).toEqual([
      "ACCEPT",
      "MAX_SIZE",
    ])
    m.send({ type: "FILES.ADD", files: [file("c.xlsx")], via: "picker" })
    expect(onReject.mock.calls[1]?.[0][0].reason).toBe("MAX_FILES")
    expect(m.said().map((a) => a.message)).toContain("2 files attached")
    expect(m.said().filter((a) => a.priority === "assertive").length).toBe(2)
  })

  it("matchesAccept follows the input grammar", () => {
    expect(matchesAccept({ name: "A.XLSX", type: "" }, ".xlsx")).toBe(true)
    expect(matchesAccept({ name: "a.png", type: "image/png" }, "image/*")).toBe(true)
    expect(matchesAccept({ name: "a.pdf", type: "application/pdf" }, "image/*, .txt")).toBe(false)
    expect(matchesAccept({ name: "a", type: "" }, undefined)).toBe(true)
  })

  it("removal: once by id, announced; Backspace arms then removes; disabled stays", () => {
    const m = make({
      defaultAttachments: [
        { id: "1", name: "q1.pdf" },
        { id: "2", name: "q2.pdf", disabled: true },
        { id: "3", name: "q3.pdf" },
      ],
    })
    m.send({ type: "CHIP.REMOVE", key: "1" })
    m.send({ type: "CHIP.REMOVE", key: "1" })
    m.send({ type: "CHIP.REMOVE", key: "2" })
    expect(m.files().map((f) => f.id)).toEqual(["2", "3"])
    expect(m.said().filter((a) => a.message === "q1.pdf removed").length).toBe(1)
    m.send({ type: "BACKSPACE_EMPTY" })
    expect(m.ctx().armedChip).toBe("3")
    m.send({ type: "BACKSPACE_EMPTY" })
    expect(m.files().map((f) => f.id)).toEqual(["2"])
  })

  it("history: ArrowUp recalls older entries from an empty draft; ArrowDown returns", () => {
    const m = make({ history: ["one", "two"] })
    const up = () => m.send({ type: "RECALL", direction: "older" })
    const down = () => m.send({ type: "RECALL", direction: "newer" })
    up()
    expect(m.value()).toBe("two")
    up()
    expect(m.value()).toBe("one")
    up()
    expect(m.value()).toBe("one")
    down()
    expect(m.value()).toBe("two")
    down()
    expect(m.value()).toBe("")
    m.type("draft")
    up()
    expect(m.value()).toBe("draft")
  })

  it("busy states keep the draft editable and attachments addable", () => {
    const m = make({ status: "streaming" })
    m.type("next")
    m.send({ type: "FILES.ADD", files: [file("n.txt")], via: "paste" })
    expect(m.value()).toBe("next")
    expect(m.files().length).toBe(1)
    m.submit()
    expect(m.onSubmit).not.toHaveBeenCalled()
  })

  it("count announcements wait for the commit and need focus", () => {
    const m = make({ limit: 10, threshold: 5 })
    m.send({ type: "FOCUS", modality: "keyboard" })
    m.send({ type: "COMPOSITION.START" })
    m.type("abcdefgh", true)
    expect(m.said()).toEqual([])
    m.send({ type: "COMPOSITION.END", value: "abcdefgh" })
    expect(m.said().map((a) => a.message)).toEqual(["2 characters remaining"])
  })
})
