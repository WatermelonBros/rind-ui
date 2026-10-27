// Agent Presence (React): the state in words (a hidden Status when none is composed), the
// transitions announced, a long think, staleness, the level loop on the Root (never state; off
// under reduced motion or motion="off"), server HTML and hydration.
import type { AgentState, Scheduler, TimerHandle } from "@rind-ui/core"
import { AgentPresence, type AgentPresenceRootProps, RindProvider } from "@rind-ui/react"
import { act, render } from "@testing-library/react"
import axe from "axe-core"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getAgentPresence, recordingAnnouncer, virtualClock } from "../index"

afterEach(() => vi.restoreAllMocks())

const settle = () => act(async () => {})

/** The virtual clock's timers with animation frames run by hand. */
function frames() {
  const clock = virtualClock()
  const queue = new Map<number, () => void>()
  let seq = 0
  const scheduler: Scheduler = {
    setTimeout: clock.scheduler.setTimeout,
    clearTimeout: clock.scheduler.clearTimeout,
    requestAnimationFrame: (cb) => {
      queue.set(++seq, () => cb())
      return seq as TimerHandle
    },
    cancelAnimationFrame: (h) => {
      queue.delete(h as number)
    },
  }
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const due = [...queue.values()]
      queue.clear()
      clock.advance(16)
      for (const cb of due) cb()
    }
  }
  return { clock, scheduler, step, pending: () => queue.size }
}

function setup(
  initial: Partial<AgentPresenceRootProps> & { state: AgentState },
  options: { status?: boolean; reducedMotion?: boolean } = {},
) {
  const rec = recordingAnnouncer()
  const f = frames()
  const ui = (p: Partial<AgentPresenceRootProps> & { state: AgentState }) => (
    <RindProvider
      announcer={rec.announcer}
      environment={{
        scheduler: f.scheduler,
        clock: f.clock.clock,
        reducedMotion: options.reducedMotion === true,
      }}
    >
      <AgentPresence.Root {...p}>
        <AgentPresence.Visual />
        <AgentPresence.Label>Ada</AgentPresence.Label>
        {options.status === false ? null : <AgentPresence.Status />}
        <AgentPresence.Detail />
      </AgentPresence.Root>
    </RindProvider>
  )
  let props = initial
  const r = render(ui(props))
  const q = (sel: string) => r.container.querySelector<HTMLElement>(sel)
  return {
    host: r.container,
    rec,
    ...f,
    q,
    rerender: async (next: Partial<AgentPresenceRootProps>) => {
      props = { ...props, ...next }
      r.rerender(ui(props))
      await settle()
    },
    d: () => getAgentPresence(document.body),
  }
}

describe("React AgentPresence", () => {
  it("shows the state in words; the Visual is decoration; no live region", async () => {
    const t = setup({ state: "idle" })
    await settle()
    expect(await t.d().statusText()).toBe("Idle")
    expect(t.q('[data-part="visual"]')?.getAttribute("aria-hidden")).toBe("true")
    expect(t.q('[data-part="root"]')?.hasAttribute("role")).toBe(false)
    expect(t.q("[aria-live]")).toBeNull()
    expect(t.host.querySelectorAll('[data-part="status"]')).toHaveLength(1)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("renders a visually hidden Status when none is composed", async () => {
    const t = setup({ state: "thinking" }, { status: false })
    await settle()
    const status = t.host.querySelectorAll<HTMLElement>('[data-part="status"]')
    expect(status).toHaveLength(1)
    expect(status[0]?.textContent).toBe("Thinking")
    expect(status[0]?.style.position).not.toBe("")
  })

  it("announces the first listening, a long think, the end and errors", async () => {
    const onStateChange = vi.fn()
    const t = setup({ state: "idle", onStateChange })
    await settle()
    await t.rerender({ state: "listening" })
    await t.rerender({ state: "thinking" })
    act(() => t.clock.advance(1500))
    await t.rerender({ state: "speaking" })
    await t.rerender({ state: "error", reason: "offline" })
    await t.rerender({ state: "idle" })
    expect(t.rec.log.map((a) => [a.message, a.priority])).toEqual([
      ["Listening", "polite"],
      ["Thinking", "polite"],
      ["Connection error: offline", "assertive"],
      ["Conversation ended", "polite"],
    ])
    expect(onStateChange.mock.calls.map((c) => c[0])).toEqual([
      "listening",
      "thinking",
      "speaking",
      "error",
      "idle",
    ])
    expect(t.q('[data-part="root"]')?.dataset["previousState"]).toBe("error")
  })

  it("marks a state stale after its limit", async () => {
    const onStale = vi.fn()
    const t = setup({ state: "connecting", staleAfter: { connecting: 5000 }, onStale })
    await settle()
    act(() => t.clock.advance(5000))
    expect(await t.d().isStale()).toBe(true)
    expect(onStale).toHaveBeenCalledWith("connecting")
  })

  it("runs the level loop on the Root while listening, never through state", async () => {
    let level = 0.9
    const t = setup({ state: "listening", getLevel: () => level })
    await settle()
    const root = t.q('[data-part="root"]') as HTMLElement
    act(() => t.step(30))
    expect(Number(root.style.getPropertyValue("--rind-agent-presence-level"))).toBeGreaterThan(0.8)
    expect(
      Number(root.style.getPropertyValue("--rind-agent-presence-input-level")),
    ).toBeGreaterThan(0.8)
    expect(await t.d().level()).toBe(3)
    level = 0
    await t.rerender({ state: "thinking" })
    expect(t.pending()).toBe(0)
    expect(root.style.getPropertyValue("--rind-agent-presence-level")).toBe("0.000")
    expect(await t.d().level()).toBe(0)
  })

  it("no loop with motion off or reduced motion", async () => {
    const off = setup({ state: "speaking", getLevel: () => 1, motion: "off" })
    await settle()
    expect(off.pending()).toBe(0)
    expect(off.q('[data-part="root"]')?.dataset["motion"]).toBe("off")
    const reduced = setup({ state: "speaking", getLevel: () => 1 }, { reducedMotion: true })
    await settle()
    expect(reduced.pending()).toBe(0)
    expect(reduced.q('[data-part="root"]')?.dataset["motion"]).toBe("reduced")
  })

  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <AgentPresence.Root state="listening">
            <AgentPresence.Visual />
          </AgentPresence.Root>
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector('[data-part="status"]')?.textContent).toBe("Listening")
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
