/** @jsxImportSource solid-js */
// Tool Call's Solid parts: the Header names the tool and its status, opens the details; an
// approval request, one decision, busy while it is submitted, the Receipt taking the focus;
// no buttons without onDecision; the measured duration.
import type { ToolCallDecision, ToolCallStatus } from "@rind-ui/core"
import { getToolCall, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider, ToolCall } from "../index"

/** Lets mount effects and promise callbacks run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

interface Props {
  status: ToolCallStatus
  decides?: boolean
}

function setup(initial: Props) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  const decisions: ToolCallDecision[] = []
  let finish: (() => void) | undefined
  const m = mount(
    (p: Props) => (
      <RindProvider announcer={rec.announcer} environment={{ clock: clock.clock }}>
        <ToolCall.Root
          id="call-1"
          name="search_flights"
          status={p.status}
          onDecision={
            p.decides === false
              ? undefined
              : (d) => {
                  decisions.push(d)
                  return new Promise<void>((r) => {
                    finish = r
                  })
                }
          }
        >
          <ToolCall.Header>
            <ToolCall.Name /> <ToolCall.Status /> <ToolCall.Duration />
          </ToolCall.Header>
          <ToolCall.Content>
            <ToolCall.Input>{"{ from: 'MXP' }"}</ToolCall.Input>
            <ToolCall.Approval>
              <ToolCall.ApprovalTitle>Book this flight?</ToolCall.ApprovalTitle>
              <ToolCall.Approve />
              <ToolCall.Deny>Deny</ToolCall.Deny>
              <ToolCall.Receipt />
            </ToolCall.Approval>
          </ToolCall.Content>
        </ToolCall.Root>
      </RindProvider>
    ),
    initial,
  )
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement | null
  return {
    ...m,
    rec,
    clock,
    decisions,
    finish: () => finish?.(),
    q,
    d: () => getToolCall(document.body),
  }
}

describe("Solid ToolCall", () => {
  it("names the Header by the tool and the status, and opens the details", async () => {
    const t = setup({ status: "running" })
    await settle()
    const header = t.q('[data-part="header"]') as HTMLElement
    expect(header.getAttribute("aria-label")).toBe("search_flights, running")
    expect(header.getAttribute("aria-expanded")).toBe("false")
    const content = t.q('[data-part="content"]') as HTMLElement
    expect(content.hidden).toBe(true)
    expect(header.getAttribute("aria-controls")).toBe(content.id)
    expect(t.q('[data-part="status"]')?.getAttribute("aria-hidden")).toBe("true")
    expect(t.q('[data-part="approval"]')).toBeNull()
    await t.d().via("keyboard").toggle()
    expect(await t.d().isOpen()).toBe(true)
    expect(content.hidden).toBe(false)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("measures the duration from the first live status to the last", async () => {
    const t = setup({ status: "running" })
    await settle()
    t.clock.advance(2500)
    await t.rerender({ status: "done" })
    expect(t.q('[data-part="duration"]')?.textContent).toBe("2.5 seconds")
    expect(t.q('[data-part="header"]')?.getAttribute("aria-label")).toBe(
      "search_flights, done, 2.5 seconds",
    )
  })

  it("asks for approval, takes one decision, and lands the focus on the Receipt", async () => {
    const t = setup({ status: "running" })
    await settle()
    await t.rerender({ status: "awaiting" })
    expect(t.rec.log.map((a) => a.message)).toEqual(["search_flights needs your approval"])
    expect(await t.d().isOpen()).toBe(true)
    expect(await t.d().approvalState()).toBe("awaiting")
    await t.d().via("keyboard").approve()
    expect(t.decisions).toEqual([{ id: "call-1", approved: true }])
    const approve = t.q('[data-part="approve"]') as HTMLElement
    // No children: the button says its own text; the Deny's content wins.
    expect(approve.textContent).toBe("Approve")
    expect(t.q('[data-part="deny"]')?.textContent).toBe("Deny")
    expect(approve.getAttribute("aria-busy")).toBe("true")
    expect(approve.getAttribute("aria-disabled")).toBe("true")
    approve.click()
    expect(t.decisions).toHaveLength(1)
    t.finish()
    await vi.waitFor(async () => expect(await t.d().approvalState()).toBe("settled"))
    expect(await t.d().receiptText()).toBe("Approved")
    await vi.waitFor(() => expect(document.activeElement).toBe(t.q('[data-part="receipt"]')))
  })

  it("has no buttons without onDecision; a denial from the runtime is the receipt", async () => {
    const t = setup({ status: "awaiting", decides: false })
    await settle()
    expect(t.q('[data-part="approval"]')).not.toBeNull()
    expect(t.q('[data-part="approve"]')).toBeNull()
    expect(t.q('[data-part="deny"]')).toBeNull()
    await t.rerender({ status: "denied" })
    expect(await t.d().receiptText()).toBe("Denied")
  })
})
