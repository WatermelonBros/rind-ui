// Tool Call (React): the Header names the tool and the status, a disclosure over the details; a
// request opens it and is announced; one decision, busy while submitting, the focus to the
// Receipt only from inside; no buttons without onDecision; measured duration; server HTML.
import type { ToolCallDecision, ToolCallStatus } from "@rind-ui/core"
import { RindProvider, ToolCall, type ToolCallRootProps } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import axe from "axe-core"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getToolCall, recordingAnnouncer, virtualClock } from "../index"

afterEach(() => vi.restoreAllMocks())

/** Lets effects, microtasks and promise callbacks run (no elapsed time). */
const settle = () => act(async () => {})

function setup(initial: Partial<ToolCallRootProps> & { status: ToolCallStatus }) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  const ui = (p: Partial<ToolCallRootProps> & { status: ToolCallStatus }) => (
    <RindProvider announcer={rec.announcer} environment={{ clock: clock.clock }}>
      <ToolCall.Root id="call-1" name="search_flights" {...p}>
        <ToolCall.Header>
          <ToolCall.Name /> <ToolCall.Status /> <ToolCall.Duration />
        </ToolCall.Header>
        <ToolCall.Content>
          <ToolCall.Input>{'{ "to": "LIS" }'}</ToolCall.Input>
          <ToolCall.Approval>
            <ToolCall.ApprovalTitle>Book this flight?</ToolCall.ApprovalTitle>
            <ToolCall.Approve>Approve</ToolCall.Approve>
            <ToolCall.Deny>Deny</ToolCall.Deny>
            <ToolCall.Receipt />
          </ToolCall.Approval>
        </ToolCall.Content>
      </ToolCall.Root>
    </RindProvider>
  )
  let props = initial
  const r = render(ui(props))
  const q = (sel: string) => r.container.querySelector<HTMLElement>(sel)
  return {
    host: r.container,
    rec,
    clock,
    q,
    rerender: async (next: Partial<ToolCallRootProps>) => {
      props = { ...props, ...next }
      r.rerender(ui(props))
      await settle()
    },
    d: () => getToolCall(document.body),
  }
}

describe("React ToolCall", () => {
  it("the Header is a disclosure named by the tool and its status", async () => {
    const t = setup({ status: "running" })
    await settle()
    const header = t.q('[data-part="header"]') as HTMLElement
    expect(header.getAttribute("aria-label")).toBe("search_flights, running")
    expect(header.getAttribute("aria-expanded")).toBe("false")
    const content = t.q('[data-part="content"]') as HTMLElement
    expect(header.getAttribute("aria-controls")).toBe(content.id)
    expect(content.hidden).toBe(true)
    expect(t.q('[data-part="status"]')?.getAttribute("aria-hidden")).toBe("true")
    await t.d().via("keyboard").toggle()
    expect(await t.d().isOpen()).toBe(true)
    expect(content.hidden).toBe(false)
    expect(t.q('[data-part="approval"]')).toBeNull()
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("a request opens the details and is announced; no buttons without onDecision", async () => {
    const t = setup({ status: "running" })
    await settle()
    await t.rerender({ status: "awaiting" })
    expect(await t.d().isOpen()).toBe(true)
    expect(await t.d().approvalState()).toBe("awaiting")
    expect(t.rec.log.map((a) => a.message)).toEqual(["search_flights needs your approval"])
    expect(t.q('[data-part="approve"]')).toBeNull()
    expect(t.q('[data-part="approval"]')?.getAttribute("role")).toBe("group")
  })

  it("one decision, busy while submitting; the focus goes to the Receipt", async () => {
    const decisions: ToolCallDecision[] = []
    let finish: (() => void) | undefined
    const t = setup({
      status: "awaiting",
      onDecision: (d) => {
        decisions.push(d)
        return new Promise<void>((r) => {
          finish = r
        })
      },
    })
    await settle()
    await t.d().via("keyboard").approve()
    const approve = t.q('[data-part="approve"]') as HTMLElement
    expect(await t.d().approvalState()).toBe("submitting")
    expect(approve.getAttribute("aria-busy")).toBe("true")
    expect(approve.getAttribute("aria-disabled")).toBe("true")
    expect(document.activeElement).toBe(approve)
    act(() => approve.click())
    expect(decisions).toEqual([{ id: "call-1", approved: true }])
    await act(async () => finish?.())
    await settle()
    expect(await t.d().approvalState()).toBe("settled")
    expect(await t.d().receiptText()).toBe("Approved")
    expect(document.activeElement).toBe(t.q('[data-part="receipt"]'))
  })

  it("a deny that fails can be tried again", async () => {
    const t = setup({
      status: "awaiting",
      onDecision: () => Promise.reject(new Error("offline")),
    })
    await settle()
    await t.d().via("pointer").deny()
    await settle()
    expect(await t.d().approvalState()).toBe("failed")
    expect(t.q('[data-part="deny"]')?.hasAttribute("aria-disabled")).toBe(false)
  })

  it("measures the duration from the first live status", async () => {
    const t = setup({ status: "running" })
    await settle()
    act(() => t.clock.advance(1500))
    await t.rerender({ status: "done" })
    expect(t.q('[data-part="duration"]')?.textContent).toBe("1.5 seconds")
    await t.rerender({ duration: 3 })
    expect(t.q('[data-part="duration"]')?.textContent).toBe("3 seconds")
  })

  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <ToolCall.Root id="c" name="search" status="done" duration={2}>
            <ToolCall.Header>
              <ToolCall.Name />
            </ToolCall.Header>
            <ToolCall.Content>
              <ToolCall.Output>ok</ToolCall.Output>
            </ToolCall.Content>
          </ToolCall.Root>
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector('[data-part="header"]')?.getAttribute("aria-label")).toBe(
      "search, done, 2 seconds",
    )
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
