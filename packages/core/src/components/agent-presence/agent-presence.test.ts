import { describe, expect, it, vi } from "vitest"
import { levelBand, smoothLevel, startLevelLoop } from "../../dom/level-loop"
import type { Announcement, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import { agentPresenceConnect } from "./agent-presence.connect"
import { agentPresenceContract } from "./agent-presence.contract"
import { type AgentPresenceProps, agentPresenceMachine } from "./agent-presence.machine"
import { agentPresenceMessages } from "./agent-presence.messages"
import { agentPresenceMeta } from "./agent-presence.meta"

function make(over: Partial<AgentPresenceProps> = {}) {
  const announced: Announcement[] = []
  let now = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  let seq = 1
  const scheduler: Scheduler = {
    setTimeout: (fn, ms) => {
      timers.set(seq, { at: now + ms, fn })
      return seq++
    },
    clearTimeout: (h) => {
      timers.delete(h as number)
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  }
  let props: AgentPresenceProps = { id: "a", state: "idle", ...over }
  const env = {
    scheduler,
    clock: { now: () => now },
    announcer: {
      announce: (a: Announcement) => {
        announced.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en-US", dir: () => "ltr" as const, subscribe: () => () => {} },
  }
  const s = createService(agentPresenceMachine, props, env)
  s.start()
  return {
    s,
    announced,
    said: () => announced.map((a) => `${a.priority}:${a.message}`),
    ctx: () => s.getSnapshot().context,
    set: (p: Partial<AgentPresenceProps>) => {
      props = { ...props, ...p }
      s.setProps(props)
    },
    advance: (ms: number) => {
      now += ms
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id)
          t.fn()
        }
      }
    },
  }
}

describe("agent presence machine", () => {
  it("announces the first listening, a long think, the end; never speaking", () => {
    const t = make()
    for (const state of ["connecting", "listening", "thinking"] as const) t.set({ state })
    t.advance(800)
    t.set({ state: "speaking" })
    t.set({ state: "thinking" })
    t.advance(1500)
    t.set({ state: "listening" })
    t.set({ state: "idle" })
    expect(t.said()).toEqual(["polite:Listening", "polite:Thinking", "polite:Conversation ended"])
  })

  it("an error is assertive with its reason", () => {
    const t = make({ state: "connecting" })
    t.set({ state: "error", reason: "network" })
    expect(t.said()).toEqual(["assertive:Connection error: network"])
  })

  it("any to any, reported with from (livekit/agents#3007)", () => {
    const onStateChange = vi.fn()
    const t = make({ onStateChange, state: "listening" })
    t.set({ state: "speaking" })
    expect(onStateChange).toHaveBeenCalledWith("speaking", { from: "listening" })
  })

  it("a stuck state becomes stale once (livekit/agents#8027)", () => {
    const onStale = vi.fn()
    const t = make({ staleAfter: { thinking: 10_000 }, onStale })
    t.set({ state: "thinking" })
    t.advance(10_000)
    expect(t.ctx().stale).toBe(true)
    expect(onStale).toHaveBeenCalledWith("thinking")
    t.set({ state: "speaking" })
    expect(t.ctx().stale).toBe(false)
  })

  it("announce off is silent", () => {
    const t = make({ announce: "off" })
    t.set({ state: "listening" })
    t.set({ state: "error" })
    expect(t.said()).toEqual([])
  })
})

describe("level loop", () => {
  it("smooths: fast attack, slow release; bands", () => {
    expect(smoothLevel(0, 1)).toBe(0.5)
    expect(smoothLevel(1, 0)).toBeCloseTo(0.85)
    expect([0, 0.2, 0.5, 0.9].map(levelBand)).toEqual([0, 1, 2, 3])
  })

  it("writes the level to the element each frame and resets on stop", () => {
    const frames: (() => void)[] = []
    const scheduler: Scheduler = {
      setTimeout: () => 0,
      clearTimeout: () => {},
      requestAnimationFrame: (fn) => frames.push(fn),
      cancelAnimationFrame: () => {},
    }
    const props = new Map<string, string>()
    const dataset: Record<string, string> = {}
    const root = {
      style: { setProperty: (k: string, v: string) => props.set(k, v) },
      dataset,
    } as unknown as HTMLElement // only style.setProperty and dataset are used
    let t = 0
    const stop = startLevelLoop(root, {
      getLevel: () => 2,
      channel: "output",
      scheduler,
      now: () => (t += 300),
    })
    frames.shift()?.()
    frames.shift()?.()
    expect(Number(props.get("--rind-agent-presence-level"))).toBeCloseTo(0.75)
    expect(props.has("--rind-agent-presence-output-level")).toBe(true)
    expect(dataset["level"]).toBe("3")
    stop()
    expect(props.get("--rind-agent-presence-level")).toBe("0.000")
    expect(dataset["level"]).toBe("0")
  })
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("agent presence connect", () => {
  const api = (over: Partial<Parameters<typeof agentPresenceConnect>[0]> = {}) =>
    agentPresenceConnect({
      instance: "a",
      state: "speaking",
      previous: "thinking",
      stale: true,
      muted: true,
      motion: "full",
      reason: "x",
      messages: agentPresenceMessages,
      ...over,
    })

  it("the visual is hidden, the status is words, the level runs only with motion", () => {
    expect(api().visual()["aria-hidden"]).toBe("true")
    expect(api().root()["role"]).toBeUndefined()
    expect(api().statusText).toBe("Speaking")
    expect(api().levelChannel).toBe("output")
    expect(api({ motion: "reduced" }).levelChannel).toBeNull()
    expect(api({ state: "thinking" }).levelChannel).toBeNull()
  })

  it("meta matches the code", () => {
    const a = api()
    const parts = {
      root: a.root(),
      visual: a.visual(),
      status: a.status(),
      label: a.label(),
      detail: a.detail(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        agentPresenceMeta.dataAttributes[part as keyof typeof agentPresenceMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(agentPresenceMeta.contract.queries).toEqual(Object.keys(agentPresenceContract.queries))
  })
})
