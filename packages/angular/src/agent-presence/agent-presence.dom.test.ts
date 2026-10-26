// Agent Presence's Angular parts: the state in words (composed or hidden), the announcements per
// transition, the level written by the loop outside rendering, and no loop under reduced
// motion or motion="off".
import { Component, input } from "@angular/core"
import type { AgentState, Scheduler } from "@rind-ui/core"
import { getAgentPresence, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { AgentPresence } from "./agent-presence"

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

/** The fixture's configuration and environment, for the next mount. */
let current: {
  provider: { announcer: unknown; environment: unknown }
  status: boolean
  motion: "auto" | "off"
  level: () => number
} = { provider: { announcer: null, environment: {} }, status: true, motion: "auto", level: () => 0 }

@Component({
  selector: "rind-f",
  imports: [RindProvider, AgentPresence],
  template: `<ng-container
    rindProvider
    [announcer]="$any(cfg.provider.announcer)"
    [environment]="$any(cfg.provider.environment)"
  >
    <div rindAgentPresenceRoot [state]="state()" [getLevel]="cfg.level" [motion]="cfg.motion">
      <div rindAgentPresenceVisual>●</div>
      <span rindAgentPresenceLabel>Ada</span>
      @if (cfg.status) {<span rindAgentPresenceStatus></span>}
    </div>
  </ng-container>`,
})
class Tree {
  readonly cfg = current
  readonly state = input<AgentState>("idle")
}

async function setup(
  state: AgentState,
  o: { status?: boolean; reducedMotion?: boolean; motion?: "off" } = {},
) {
  const rec = recordingAnnouncer()
  const f = frames()
  current = {
    provider: {
      announcer: rec.announcer,
      environment: {
        scheduler: f.scheduler,
        clock: f.clock.clock,
        ...(o.reducedMotion === undefined ? {} : { reducedMotion: o.reducedMotion }),
      },
    },
    status: o.status ?? true,
    motion: o.motion ?? "auto",
    level: () => 0.9,
  }
  const m = await mount(Tree, { state })
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  return { ...m, rec, f, q, d: () => getAgentPresence(document.body) }
}

describe("Angular AgentPresence", () => {
  it("says the state in words; the Visual is decoration", async () => {
    const t = await setup("connecting")
    const root = t.q('[data-part="root"]')
    expect(root.hasAttribute("role")).toBe(false)
    expect(root.dataset["state"]).toBe("connecting")
    expect(t.q('[data-part="visual"]').getAttribute("aria-hidden")).toBe("true")
    expect((await t.d().statusText()).trim()).toBe("Connecting")
    expect(t.host.querySelectorAll('[data-part="status"]')).toHaveLength(1)
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("renders a hidden Status when none is composed", async () => {
    const t = await setup("listening", { status: false })
    const status = t.q('[data-part="status"]')
    expect(status.textContent?.trim()).toBe("Listening")
    expect(status.getAttribute("style")).toContain("clip")
  })

  it("announces the first listening, never speaking", async () => {
    const t = await setup("connecting")
    await t.rerender({ state: "listening" })
    await t.rerender({ state: "speaking" })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Listening"])
    expect(t.q('[data-part="root"]').dataset["previousState"]).toBe("listening")
  })

  it("writes the level to the Root each frame while listening, not into state", async () => {
    const t = await setup("listening")
    t.f.run(20)
    const root = t.q('[data-part="root"]')
    expect(Number(root.style.getPropertyValue("--rind-agent-presence-level"))).toBeGreaterThan(0.5)
    expect(await t.d().level()).toBe(3)
    await t.rerender({ state: "thinking" })
    expect(await t.d().level()).toBe(0)
  })

  it("runs no level loop under reduced motion or motion off", async () => {
    for (const o of [{ motion: "off" as const }, { reducedMotion: true }]) {
      const t = await setup("listening", o)
      const root = t.q('[data-part="root"]')
      t.f.run(20)
      expect(root.style.getPropertyValue("--rind-agent-presence-level")).toBe("")
      expect(root.dataset["motion"]).toBe("reducedMotion" in o ? "reduced" : "off")
    }
  })
})
