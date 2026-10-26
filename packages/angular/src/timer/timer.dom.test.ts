// Timer's Angular parts: anatomy and the timer role, a toggle on a virtual clock, a disabled
// action that keeps the focus, and the completion announcement.
import { Component } from "@angular/core"
import { recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { Timer } from "./timer"

/** The fixture's configuration and environment, for the next mount. */
let current: {
  countdown: boolean
  startMs?: number
  autoStart: boolean
  locale?: string
  provider: { announcer: unknown; environment: unknown }
  completed: () => void
} = {
  countdown: false,
  autoStart: false,
  provider: { announcer: null, environment: {} },
  completed: () => {},
}

@Component({
  selector: "rind-f",
  imports: [RindProvider, Timer],
  template: `<ng-container
      rindProvider
      locale="en-US"
      [announcer]="$any(cfg.provider.announcer)"
      [environment]="$any(cfg.provider.environment)"
    >
      <div
        rindTimerRoot
        [countdown]="cfg.countdown"
        [startMs]="cfg.startMs"
        [autoStart]="cfg.autoStart"
        [locale]="cfg.locale"
        (complete)="cfg.completed()"
      >
        <div rindTimerArea>
          <div rindTimerItem type="minutes">
            <span rindTimerItemValue type="minutes"></span>
            <span rindTimerItemLabel type="minutes">min</span>
          </div>
          <span rindTimerSeparator>:</span>
          <div rindTimerItem type="seconds">
            <span rindTimerItemValue type="seconds"></span>
          </div>
        </div>
        <div rindTimerControl>
          <button rindTimerActionTrigger action="toggle" #t="rindTimerActionTrigger">
            {{ t.state().label }}
          </button>
          <button rindTimerActionTrigger action="pause">Pause</button>
          <button rindTimerActionTrigger action="reset">Reset</button>
        </div>
      </div>
    </ng-container>`,
})
class Tree {
  readonly cfg = current
}

async function setup(
  p: { countdown?: boolean; startMs?: number; autoStart?: boolean; locale?: string } = {},
) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  const completed: number[] = []
  current = {
    countdown: p.countdown ?? false,
    ...(p.startMs === undefined ? {} : { startMs: p.startMs }),
    autoStart: p.autoStart ?? false,
    ...(p.locale === undefined ? {} : { locale: p.locale }),
    provider: {
      announcer: rec.announcer,
      environment: { scheduler: clock.scheduler, clock: clock.clock },
    },
    completed: () => completed.push(1),
  }
  const m = await mount(Tree)
  // Zoneless: signal writes render on the next stable point.
  const stable = () => m.rerender({})
  await stable()
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const trigger = (action: string) => q(`[data-part="action-trigger"][data-action="${action}"]`)
  const text = (type: string) =>
    q(`[data-part="item-value"][data-type="${type}"]`).textContent?.trim()
  const state = () => q('[data-part="root"]').dataset["state"]
  return { clock, rec, completed, host: m.host, q, trigger, text, state, stable }
}

describe("Angular Timer", () => {
  it("renders the anatomy: a named timer region and typed units", async () => {
    const t = await setup({ countdown: true, startMs: 65_000 })
    const area = t.q('[data-part="area"]')
    expect(area.getAttribute("role")).toBe("timer")
    expect(area.getAttribute("aria-label")).toBe("1 minute, 5 seconds")
    expect(t.q('[data-part="root"]').dataset["countdown"]).toBe("")
    expect(t.state()).toBe("idle")
    expect(t.text("minutes")).toBe("01")
    expect(t.text("seconds")).toBe("05")
    expect(t.q('[data-part="separator"]').getAttribute("aria-hidden")).toBe("true")
    expect(t.q('[data-part="item"][data-type="minutes"]').hasAttribute("type")).toBe(false)
    expect(t.trigger("toggle").textContent?.trim()).toBe("Start")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("toggles on the virtual clock: start, tick, pause", async () => {
    const t = await setup()
    t.trigger("toggle").click()
    await t.stable()
    expect(t.state()).toBe("running")
    expect(t.trigger("toggle").textContent?.trim()).toBe("Pause")
    t.clock.advance(3000)
    await t.stable()
    expect(t.text("seconds")).toBe("03")
    expect(t.q('[data-part="area"]').getAttribute("aria-label")).toBe("3 seconds")
    t.trigger("toggle").click()
    await t.stable()
    expect(t.state()).toBe("paused")
    expect(t.trigger("toggle").textContent?.trim()).toBe("Resume")
    t.clock.advance(5000)
    await t.stable()
    expect(t.text("seconds")).toBe("03")
  })

  it("keeps the focus on an action that does nothing now", async () => {
    const t = await setup()
    const pause = t.trigger("pause")
    expect(pause.getAttribute("aria-disabled")).toBe("true")
    expect(pause.hasAttribute("disabled")).toBe(false)
    expect(pause.dataset["disabled"]).toBe("")
    pause.focus()
    pause.click()
    await t.stable()
    expect(document.activeElement).toBe(pause)
    expect(t.state()).toBe("idle")
    t.trigger("toggle").click()
    await t.stable()
    expect(pause.hasAttribute("aria-disabled")).toBe(false)
    pause.click()
    await t.stable()
    expect(t.state()).toBe("paused")
  })

  it("announces the completion once and reports it", async () => {
    const t = await setup({ countdown: true, startMs: 2000, autoStart: true, locale: "fr-FR" })
    expect(t.state()).toBe("running")
    t.clock.advance(2000)
    await t.stable()
    expect(t.state()).toBe("completed")
    expect(t.text("seconds")).toBe("00")
    expect(t.rec.log.map((a) => a.message)).toEqual(["Time's up"])
    expect(t.rec.log[0]?.lang).toBe("fr-FR")
    expect(t.completed).toHaveLength(1)
    t.clock.advance(5000)
    await t.stable()
    expect(t.rec.log).toHaveLength(1)
  })
})
