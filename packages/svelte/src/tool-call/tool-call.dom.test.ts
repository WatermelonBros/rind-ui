// Tool Call's Svelte parts: the Header names the tool and the status over a disclosure; a
// request opens it and is announced; one decision, busy while submitting, the focus to the
// Receipt from inside; no buttons without onDecision; measured duration; DOM parity with React.
import type { ToolCallDecision } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getToolCall, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Call from "../../fixtures/tool-call/call.svelte"

const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
  flushSync()
}

function setup(root: Record<string, unknown>) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  const m = mount(Call, {
    root,
    provider: { announcer: rec.announcer, environment: { clock: clock.clock } },
  } as never)
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  const rerender = async (next: Record<string, unknown>) => {
    root = { ...root, ...next }
    m.rerender({ root } as never)
    await settle()
  }
  return { ...m, rerender, rec, clock, q, d: () => getToolCall(document.body) }
}

describe("Svelte ToolCall", () => {
  it("the Header is a disclosure named by the tool and its status", async () => {
    const t = setup({})
    await settle()
    const header = t.q('[data-part="header"]') as HTMLElement
    expect(header.getAttribute("aria-label")).toBe("search_flights, running")
    expect((t.q('[data-part="content"]') as HTMLElement).hidden).toBe(true)
    await t.d().via("keyboard").toggle()
    expect(await t.d().isOpen()).toBe(true)
    expect(t.q('[data-part="approval"]')).toBeNull()
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("a request opens the details and is announced; no buttons without onDecision", async () => {
    const t = setup({})
    await settle()
    await t.rerender({ status: "awaiting" })
    expect(await t.d().isOpen()).toBe(true)
    expect(t.rec.log.map((a) => a.message)).toEqual(["search_flights needs your approval"])
    expect(t.q('[data-part="approve"]')).toBeNull()
  })

  it("one decision, busy while submitting; the focus goes to the Receipt", async () => {
    const decisions: ToolCallDecision[] = []
    let finish: (() => void) | undefined
    const t = setup({
      status: "awaiting",
      onDecision: (d: ToolCallDecision) => {
        decisions.push(d)
        return new Promise<void>((res) => {
          finish = res
        })
      },
    })
    await settle()
    await t.d().via("keyboard").approve()
    await settle()
    const approve = t.q('[data-part="approve"]') as HTMLElement
    expect(approve.getAttribute("aria-busy")).toBe("true")
    approve.click()
    expect(decisions).toEqual([{ id: "call-1", approved: true }])
    finish?.()
    await settle()
    expect(await t.d().receiptText()).toBe("Approved")
    expect(document.activeElement).toBe(t.q('[data-part="receipt"]'))
  })

  it("measures the duration from the first live status", async () => {
    const t = setup({})
    await settle()
    t.clock.advance(1500)
    await t.rerender({ status: "done" })
    expect(t.q('[data-part="duration"]')?.textContent).toBe("1.5 seconds")
  })

  it("matches React", async () => {
    const react = r(
      R.ToolCall.Root,
      { id: "call-1", name: "search_flights", status: "running" },
      r(R.ToolCall.Header, { key: "h" }, r(R.ToolCall.Name)),
      r(R.ToolCall.Content, { key: "c" }, r(R.ToolCall.Output, null, "ok")),
    )
    await clientParity(react, Call, { full: false } as never)
  })
})
