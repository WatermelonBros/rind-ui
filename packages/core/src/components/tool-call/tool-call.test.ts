import { describe, expect, it, vi } from "vitest"
import { platforms } from "../../dom/platform"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { toolCallConnect } from "./tool-call.connect"
import { toolCallContract } from "./tool-call.contract"
import { type ToolCallProps, toolCallMachine } from "./tool-call.machine"
import { toolCallMessages } from "./tool-call.messages"
import { toolCallMeta } from "./tool-call.meta"

function make(over: Partial<ToolCallProps> = {}) {
  const announced: Announcement[] = []
  let now = 0
  let inside = false
  const focusReceipt = vi.fn()
  const focusApprove = vi.fn()
  let props: ToolCallProps = { id: "call_1", name: "delete_file", status: "running", ...over }
  const env = {
    clock: { now: () => now },
    focusInside: () => inside,
    focusReceipt,
    focusApprove,
    announcer: {
      announce: (a: Announcement) => {
        announced.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en-US", dir: () => "ltr" as const, subscribe: () => () => {} },
  }
  const s = createService(toolCallMachine, props, env)
  s.start()
  return {
    s,
    announced,
    focusReceipt,
    focusApprove,
    said: () => announced.map((a) => a.message),
    view: () => s.view(props),
    set: (p: Partial<ToolCallProps>) => {
      props = { ...props, ...p }
      s.setProps(props)
    },
    tick: (ms: number) => {
      now += ms
    },
    setInside: (v: boolean) => {
      inside = v
    },
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe("tool call machine", () => {
  it("awaiting opens the details, announces, and keeps the focus unless asked", () => {
    const t = make({ onDecision: () => {} })
    t.set({ status: "awaiting" })
    expect(t.view().values.open).toBe(true)
    expect(t.view().context.approval).toBe("awaiting")
    expect(t.said()).toEqual(["delete_file needs your approval"])
    expect(t.focusApprove).not.toHaveBeenCalled()
    t.set({ status: "done" })
    expect(t.view().values.open).toBe(true)
  })

  it("focusOnRequest=approval focuses Approve", () => {
    const t = make({ focusOnRequest: "approval" })
    t.set({ status: "awaiting" })
    expect(t.focusApprove).toHaveBeenCalledTimes(1)
  })

  it("one decision; the focus moves to the Receipt only from inside", async () => {
    let resolve = () => {}
    const onDecision = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const t = make({ status: "awaiting", onDecision })
    t.setInside(true)
    t.s.send({ type: "APPROVE" })
    t.s.send({ type: "APPROVE" })
    t.s.send({ type: "DENY" })
    expect(onDecision).toHaveBeenCalledTimes(1)
    expect(onDecision).toHaveBeenCalledWith({ id: "call_1", approved: true })
    expect(t.view().context.approval).toBe("submitting")
    resolve()
    await flush()
    expect(t.view().context.approval).toBe("settled")
    expect(t.view().context.decision).toBe("approved")
    expect(t.focusReceipt).toHaveBeenCalledTimes(1)
  })

  it("a failed decision can be retried", async () => {
    const t = make({ status: "awaiting", onDecision: () => Promise.reject(new Error("net")) })
    t.s.send({ type: "DENY", reason: "no" })
    await flush()
    expect(t.view().context.approval).toBe("failed")
    expect(t.view().context.decision).toBeNull()
  })

  it("without onDecision nothing is decided (assistant-ui#6094)", () => {
    const t = make({ status: "awaiting" })
    t.s.send({ type: "APPROVE" })
    expect(t.view().context.approval).toBe("awaiting")
  })

  it("cancelled while awaiting is expired, not an answer (CopilotKit#5554)", () => {
    const onDecision = vi.fn()
    const t = make({ status: "awaiting", onDecision })
    t.set({ status: "cancelled" })
    expect(t.view().context.approval).toBe("expired")
    expect(onDecision).not.toHaveBeenCalled()
  })

  it("error is announced; done is silent", () => {
    const t = make()
    t.set({ status: "done" })
    expect(t.said()).toEqual([])
    const u = make()
    u.set({ status: "error" })
    expect(u.said()).toEqual(["delete_file failed"])
  })

  it("duration measured from the first live status to the first final one", () => {
    const t = make({ status: "pending" })
    t.tick(400)
    t.set({ status: "running" })
    t.tick(2000)
    t.set({ status: "done" })
    expect(t.view().context.measured).toBeCloseTo(2.4)
    const final = make({ status: "done" })
    expect(final.view().context.measured).toBeNull()
  })
})

const env = { platform: platforms.linux } as unknown as Parameters<typeof toolCallConnect>[1] // only platform is read
const api = (over: Partial<Parameters<typeof toolCallConnect>[0]> = {}) =>
  toolCallConnect(
    {
      instance: "t",
      name: "search_flights",
      status: "running",
      open: true,
      approval: "submitting",
      decision: "approved",
      duration: 2.4,
      risk: "high",
      decides: true,
      messages: toolCallMessages,
      ids: { header: "h", content: "c" },
      ...over,
    },
    env,
  )
const b = { tag: "button", focused: true, modality: "keyboard" as const }
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("tool call connect", () => {
  it("the Header is named by the tool and the status (assistant-ui#7957)", () => {
    expect(api().header(b)).toMatchObject({
      "aria-label": "search_flights, running",
      "aria-expanded": "true",
      "aria-controls": "c",
    })
    expect(api().status()["aria-hidden"]).toBe("true")
  })

  it("buttons stay focusable while submitting; the Receipt is a status", () => {
    const approve = api().approve(b)
    expect(approve).toMatchObject({ "aria-disabled": "true", "aria-busy": "true" })
    expect(approve["disabled"]).toBeUndefined()
    expect(api().receipt()).toMatchObject({ role: "status", tabindex: -1 })
    expect(api({ approval: "settled" }).receiptText).toBe("Approved")
    expect(api({ approval: "expired", decision: null }).receiptText).toBe("Request expired")
    expect(api().durationText).toBe("2.4 seconds")
  })

  it("meta matches the code", () => {
    const a = api({ approval: "awaiting" })
    const bad = api()
    const parts = {
      root: a.root(),
      header: a.header(b),
      name: a.name(),
      status: a.status(),
      duration: a.duration(),
      content: a.content(),
      input: a.input(),
      output: a.output(),
      error: a.error(),
      approval: a.approval(),
      "approval-title": a.approvalTitle(),
      "approval-description": a.approvalDescription(),
      approve: bad.approve(b),
      deny: bad.deny(b),
      receipt: a.receipt(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = toolCallMeta.dataAttributes[part as keyof typeof toolCallMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(toolCallMeta.contract.queries).toEqual(Object.keys(toolCallContract.queries))
  })
})
