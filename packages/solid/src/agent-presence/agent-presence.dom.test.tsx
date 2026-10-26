/** @jsxImportSource solid-js */
// Agent Presence's Solid parts: the state in words (composed or hidden), the announcements per
// transition, the level written by the loop outside rendering, and no loop under reduced
// motion or motion="off".
import type { AgentState, Scheduler } from "@rind-ui/core"
import { getAgentPresence, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { AgentPresence, RindProvider } from "../index"

/** Lets mount effects run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

/** A virtual clock whose animation frames run when the test says. */
function frames() {
  const clock = virtualClock()
  let queue: (() => void)[] = []
  const scheduler: Scheduler = {
    ...clock.scheduler,
    requestAnimationFrame: (cb) => {
      queue.push(() => cb())
      return queue.length as never
    },
    cancelAnimationFrame: () => {},
  }
  return {
    clock,
    scheduler,
    /** Runs `n` frames, `ms` apart. */
    run(n: number, ms = 300) {
      for (let i = 0; i < n; i++) {
        clock.advance(ms)
        const now = queue
        queue = []
        for (const f of now) f()
      }
    },
  }
}

interface Props {
  state: AgentState
  status?: boolean
}

function setup(initial: Props, env: { reducedMotion?: boolean; motion?: "off" } = {}) {
  const rec = recordingAnnouncer()
  const f = frames()
  let level = 0.9
  const m = mount(
    (p: Props) => (
      <RindProvider
        announcer={rec.announcer}
        environment={{
          scheduler: f.scheduler,
          clock: f.clock.clock,
          ...(env.reducedMotion === undefined ? {} : { reducedMotion: env.reducedMotion }),
        }}
      >
        <AgentPresence.Root
          state={p.state}
          getLevel={() => level}
          {...(env.motion ? { motion: env.motion } : {})}
        >
          <AgentPresence.Visual>●</AgentPresence.Visual>
          <AgentPresence.Label>Ada</AgentPresence.Label>
          {p.status === false ? null : <AgentPresence.Status />}
        </AgentPresence.Root>
      </RindProvider>
    ),
    initial,
  )
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  return {
    ...m,
    rec,
    f,
    q,
    setLevel: (v: number) => {
      level = v
    },
    d: () => getAgentPresence(document.body),
  }
}

describe("Solid AgentPresence", () => {
  it("says the state in words; the Visual is decoration", async () => {
    const t = setup({ state: "connecting" })
    await settle()
    const root = t.q('[data-part="root"]')
    expect(root.hasAttribute("role")).toBe(false)
    expect(root.dataset["state"]).toBe("connecting")
    expect(t.q('[data-part="visual"]').getAttribute("aria-hidden")).toBe("true")
    expect(await t.d().statusText()).toBe("Connecting")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("renders a hidden Status when none is composed", async () => {
    const t = setup({ state: "listening", status: false })
    await settle()
    const status = t.q('[data-part="status"]')
    expect(status.textContent).toBe("Listening")
    expect(status.getAttribute("style")).toContain("clip")
  })

  it("announces the first listening, never speaking", async () => {
    const t = setup({ state: "connecting" })
    await settle()
    await t.rerender({ state: "listening" })
    await t.rerender({ state: "speaking" })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Listening"])
    expect(t.q('[data-part="root"]').dataset["previousState"]).toBe("listening")
  })

  it("writes the level to the Root each frame while listening, not into state", async () => {
    const t = setup({ state: "listening" })
    await settle()
    t.f.run(20)
    const root = t.q('[data-part="root"]')
    expect(Number(root.style.getPropertyValue("--rind-agent-presence-level"))).toBeGreaterThan(0.5)
    expect(root.style.getPropertyValue("--rind-agent-presence-input-level")).not.toBe("")
    expect(await t.d().level()).toBe(3)
    await t.rerender({ state: "thinking" })
    expect(await t.d().level()).toBe(0)
  })

  it("runs no level loop under reduced motion or motion off", async () => {
    for (const env of [{ reducedMotion: true }, { motion: "off" as const }]) {
      const t = setup({ state: "listening" }, env)
      await settle()
      t.f.run(20)
      const root = t.q('[data-part="root"]')
      expect(root.style.getPropertyValue("--rind-agent-presence-level")).toBe("")
      expect(root.dataset["motion"]).toBe("reducedMotion" in env ? "reduced" : "off")
    }
  })
})
