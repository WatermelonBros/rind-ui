// Agent Presence's Svelte parts: the state in words (a hidden Status when none is composed), the
// transitions announced, staleness, the level loop on the Root (off with motion="off" or
// reduced motion), DOM parity with React.
import type { AgentState, Scheduler, TimerHandle } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getAgentPresence, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Presence from "../../fixtures/agent-presence/presence.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

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
  root: Record<string, unknown> & { state: AgentState },
  options: { status?: boolean; reducedMotion?: boolean } = {},
) {
  const rec = recordingAnnouncer()
  const f = frames()
  const m = mount(Presence, {
    root,
    status: options.status !== false,
    provider: {
      announcer: rec.announcer,
      environment: {
        scheduler: f.scheduler,
        clock: f.clock.clock,
        reducedMotion: options.reducedMotion === true,
      },
    },
  } as never)
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  const rerender = (next: Record<string, unknown>) => {
    root = { ...root, ...next }
    m.rerender({ root } as never)
    flushSync()
  }
  return { ...m, rerender, rec, ...f, q, d: () => getAgentPresence(document.body) }
}

describe("Svelte AgentPresence", () => {
  it("shows the state in words; a hidden Status when none is composed", async () => {
    const t = setup({ state: "idle" })
    expect(await t.d().statusText()).toBe("Idle")
    expect(t.q('[data-part="visual"]')?.getAttribute("aria-hidden")).toBe("true")
    expect(t.host.querySelectorAll('[data-part="status"]')).toHaveLength(1)
    const bare = setup({ state: "thinking" }, { status: false })
    flushSync()
    expect(bare.host.querySelectorAll('[data-part="status"]')).toHaveLength(1)
    expect(bare.q('[data-part="status"]')?.textContent).toBe("Thinking")
  })

  it("announces the transitions and marks a stale state", async () => {
    const onStale = vi.fn()
    const t = setup({ state: "idle", staleAfter: { listening: 5000 }, onStale })
    t.rerender({ state: "listening" })
    t.clock.advance(5000)
    flushSync()
    expect(await t.d().isStale()).toBe(true)
    expect(onStale).toHaveBeenCalledWith("listening")
    t.rerender({ state: "error", reason: "offline" })
    expect(t.rec.log.map((a) => [a.message, a.priority])).toEqual([
      ["Listening", "polite"],
      ["Connection error: offline", "assertive"],
    ])
  })

  it("runs the level loop on the Root while listening; none with motion off or reduced", async () => {
    const t = setup({ state: "listening", getLevel: () => 0.9 })
    const root = t.q('[data-part="root"]') as HTMLElement
    t.step(30)
    expect(Number(root.style.getPropertyValue("--rind-agent-presence-level"))).toBeGreaterThan(0.8)
    expect(await t.d().level()).toBe(3)
    t.rerender({ state: "thinking" })
    expect(t.pending()).toBe(0)
    expect(await t.d().level()).toBe(0)
    const off = setup({ state: "speaking", getLevel: () => 1, motion: "off" })
    expect(off.pending()).toBe(0)
    const reduced = setup({ state: "speaking", getLevel: () => 1 }, { reducedMotion: true })
    expect(reduced.pending()).toBe(0)
    expect(reduced.q('[data-part="root"]')?.dataset["motion"]).toBe("reduced")
  })

  it("matches React", async () => {
    const react = r(R.AgentPresence.Root, { state: "listening" }, r(R.AgentPresence.Visual))
    await clientParity(react, Presence, { status: false, label: false } as never)
  })
})
