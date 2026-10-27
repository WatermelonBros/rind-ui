// Tool Call's Vue parts: the Header names the tool and the status over a disclosure; a request
// opens it and is announced; one decision, busy while submitting, the focus to the Receipt from
// inside; no buttons without onDecision; measured duration; markup parity with React.
import type { ToolCallDecision, ToolCallStatus } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getToolCall, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RindProvider, ToolCall } from "../index"

const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
  await nextTick()
}

type Props = Record<string, unknown> & { status: ToolCallStatus }

function setup(initial: Props) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  const m = mount(
    (p: Props) =>
      h(RindProvider, { announcer: rec.announcer, environment: { clock: clock.clock } }, () =>
        h(ToolCall.Root, { id: "call-1", name: "search_flights", ...p }, () => [
          h(ToolCall.Header, null, () => [
            h(ToolCall.Name),
            " ",
            h(ToolCall.Status),
            " ",
            h(ToolCall.Duration),
          ]),
          h(ToolCall.Content, null, () => [
            h(ToolCall.Input, null, () => '{ "to": "LIS" }'),
            h(ToolCall.Approval, null, () => [
              h(ToolCall.ApprovalTitle, null, () => "Book this flight?"),
              // No children: the buttons show their default labels.
              h(ToolCall.Approve),
              h(ToolCall.Deny),
              h(ToolCall.Receipt),
            ]),
          ]),
        ]),
      ),
    initial,
  )
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return { ...m, rec, clock, q, d: () => getToolCall(document.body) }
}

describe("Vue ToolCall", () => {
  it("the Header is a disclosure named by the tool and its status", async () => {
    const t = setup({ status: "running" })
    await settle()
    const header = t.q('[data-part="header"]') as HTMLElement
    expect(header.getAttribute("aria-label")).toBe("search_flights, running")
    expect(header.getAttribute("aria-expanded")).toBe("false")
    expect((t.q('[data-part="content"]') as HTMLElement).hidden).toBe(true)
    await t.d().via("keyboard").toggle()
    expect(await t.d().isOpen()).toBe(true)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("a request opens the details and is announced; no buttons without onDecision", async () => {
    const t = setup({ status: "running" })
    await settle()
    await t.rerender({ status: "awaiting" })
    await settle()
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

  it("an Approve and a Deny with no children show their default labels", async () => {
    const t = setup({ status: "awaiting", onDecision: () => {} })
    await settle()
    expect(t.q('[data-part="approve"]')?.textContent).toBe("Approve")
    expect(t.q('[data-part="deny"]')?.textContent).toBe("Deny")
  })

  it("measures the duration from the first live status", async () => {
    const t = setup({ status: "running" })
    await settle()
    t.clock.advance(1500)
    await t.rerender({ status: "done" })
    await settle()
    expect(t.q('[data-part="duration"]')?.textContent).toBe("1.5 seconds")
  })

  it("matches React's markup, server and client", async () => {
    const react = r(
      R.ToolCall.Root,
      { id: "c", name: "search", status: "done", duration: 2 },
      r(R.ToolCall.Header, { key: "h" }, r(R.ToolCall.Name)),
      r(R.ToolCall.Content, { key: "c" }, r(R.ToolCall.Output, null, "ok")),
    )
    const vue = () =>
      h(ToolCall.Root, { id: "c", name: "search", status: "done", duration: 2 }, () => [
        h(ToolCall.Header, null, () => h(ToolCall.Name)),
        h(ToolCall.Content, null, () => h(ToolCall.Output, null, () => "ok")),
      ])
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
