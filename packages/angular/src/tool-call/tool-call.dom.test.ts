// Tool Call's Angular parts: the Header names the tool and its status, opens the details; an
// approval request, one decision, busy while it is submitted, the Receipt taking the focus;
// no buttons without onDecision; the measured duration.
import { Component, input } from "@angular/core"
import type { ToolCallDecision, ToolCallStatus } from "@rind-ui/core"
import { getToolCall, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { ToolCall } from "./tool-call"

/** The fixture's configuration and environment, for the next mount. */
let current: {
  provider: { announcer: unknown; environment: unknown }
  decide: ((d: ToolCallDecision) => Promise<void>) | undefined
} = { provider: { announcer: null, environment: {} }, decide: undefined }

@Component({
  selector: "rind-f",
  imports: [RindProvider, ToolCall],
  template: `<ng-container
    rindProvider
    [announcer]="$any(cfg.provider.announcer)"
    [environment]="$any(cfg.provider.environment)"
  >
    <div rindToolCallRoot callId="call-1" name="search_flights" [status]="status()" [onDecision]="cfg.decide">
      <button rindToolCallHeader>
        <span rindToolCallName></span>{{ " " }}<span rindToolCallStatus></span>
        <span rindToolCallDuration></span>
      </button>
      <div rindToolCallContent>
        <div rindToolCallInput>{{ "{ from: 'MXP' }" }}</div>
        <div rindToolCallApproval>
          <div rindToolCallApprovalTitle>Book this flight?</div>
          <button rindToolCallApprove>Approve</button>
          <button rindToolCallDeny>Deny</button>
          <div rindToolCallReceipt></div>
        </div>
      </div>
    </div>
  </ng-container>`,
})
class Tree {
  readonly cfg = current
  readonly status = input<ToolCallStatus>("running")
}

async function setup(status: ToolCallStatus, decides = true) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  const decisions: ToolCallDecision[] = []
  let finish: (() => void) | undefined
  current = {
    provider: { announcer: rec.announcer, environment: { clock: clock.clock } },
    decide: decides
      ? (d) => {
          decisions.push(d)
          return new Promise<void>((r) => {
            finish = r
          })
        }
      : undefined,
  }
  const m = await mount(Tree, { status })
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  return {
    ...m,
    rec,
    clock,
    decisions,
    finish: () => finish?.(),
    q,
    stable: () => m.rerender({}),
    d: () => getToolCall(document.body),
  }
}

describe("Angular ToolCall", () => {
  it("names the Header by the tool and the status, and opens the details", async () => {
    const t = await setup("running")
    const header = t.q('[data-part="header"]')
    expect(header.getAttribute("aria-label")).toBe("search_flights, running")
    expect(header.getAttribute("aria-expanded")).toBe("false")
    const content = t.q('[data-part="content"]')
    expect(content.hidden).toBe(true)
    expect(header.getAttribute("aria-controls")).toBe(content.id)
    expect(t.q('[data-part="approval"]').hidden).toBe(true)
    await t.d().via("keyboard").toggle()
    await t.stable()
    expect(await t.d().isOpen()).toBe(true)
    expect(content.hidden).toBe(false)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("measures the duration from the first live status to the last", async () => {
    const t = await setup("running")
    t.clock.advance(2500)
    await t.rerender({ status: "done" })
    expect(t.q('[data-part="duration"]').textContent?.trim()).toBe("2.5 seconds")
  })

  it("asks for approval, takes one decision, and lands the focus on the Receipt", async () => {
    const t = await setup("running")
    await t.rerender({ status: "awaiting" })
    expect(t.rec.log.map((a) => a.message)).toEqual(["search_flights needs your approval"])
    expect(await t.d().isOpen()).toBe(true)
    await t.d().via("keyboard").approve()
    await t.stable()
    expect(t.decisions).toEqual([{ id: "call-1", approved: true }])
    const approve = t.q('[data-part="approve"]')
    expect(approve.getAttribute("aria-busy")).toBe("true")
    approve.click()
    expect(t.decisions).toHaveLength(1)
    t.finish()
    await vi.waitFor(async () => {
      await t.stable()
      expect(await t.d().approvalState()).toBe("settled")
    })
    expect((await t.d().receiptText()).trim()).toBe("Approved")
    await vi.waitFor(() => expect(document.activeElement).toBe(t.q('[data-part="receipt"]')))
  })

  it("hides the buttons without onDecision; a denial from the runtime is the receipt", async () => {
    const t = await setup("awaiting", false)
    expect(t.q('[data-part="approval"]').hidden).toBe(false)
    expect(t.q('[data-part="approve"]').hidden).toBe(true)
    expect(t.q('[data-part="deny"]').hidden).toBe(true)
    await t.rerender({ status: "denied" })
    expect((await t.d().receiptText()).trim()).toBe("Denied")
  })
})
