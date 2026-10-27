/** @jsxImportSource solid-js */
// Timer's Solid parts: anatomy and the timer role, a toggle on a virtual clock, a disabled
// action that keeps the focus, and the completion announcement.
import { recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider, Timer, type TimerRootProps } from "../index"

/** Lets mount effects and promise callbacks run (no elapsed time). */
const settle = () => Promise.resolve()

function setup(props: Partial<TimerRootProps> = {}) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  const completed: number[] = []
  const { host } = mount(() => (
    <RindProvider
      locale="en-US"
      announcer={rec.announcer}
      environment={{ scheduler: clock.scheduler, clock: clock.clock }}
    >
      <Timer.Root onComplete={() => completed.push(1)} {...props}>
        <Timer.Area>
          <Timer.Item type="minutes">
            <Timer.ItemValue type="minutes" />
            <Timer.ItemLabel type="minutes">min</Timer.ItemLabel>
          </Timer.Item>
          <Timer.Separator>:</Timer.Separator>
          <Timer.Item type="seconds">
            <Timer.ItemValue type="seconds" />
          </Timer.Item>
        </Timer.Area>
        <Timer.Control>
          <Timer.ActionTrigger action="toggle">{(s) => s.label}</Timer.ActionTrigger>
          <Timer.ActionTrigger action="pause">Pause</Timer.ActionTrigger>
          <Timer.ActionTrigger action="reset">Reset</Timer.ActionTrigger>
        </Timer.Control>
      </Timer.Root>
    </RindProvider>
  ))
  const q = (sel: string) => host.querySelector(sel) as HTMLElement
  const trigger = (action: string) => q(`[data-part="action-trigger"][data-action="${action}"]`)
  const text = (type: string) => q(`[data-part="item-value"][data-type="${type}"]`).textContent
  return { clock, rec, completed, host, q, trigger, text }
}

describe("Solid Timer", () => {
  it("renders the anatomy: a named timer region and typed units", async () => {
    const t = setup({ countdown: true, startMs: 65_000 })
    await settle()
    const area = t.q('[data-part="area"]')
    expect(area.getAttribute("role")).toBe("timer")
    expect(area.getAttribute("aria-label")).toBe("1 minute, 5 seconds")
    expect(t.q('[data-part="root"]').dataset["countdown"]).toBe("")
    expect(t.q('[data-part="root"]').dataset["state"]).toBe("idle")
    expect(t.text("minutes")).toBe("01")
    expect(t.text("seconds")).toBe("05")
    expect(t.q('[data-part="separator"]').getAttribute("aria-hidden")).toBe("true")
    expect(t.q('[data-part="item-label"][data-type="minutes"]').textContent).toBe("min")
    expect(t.trigger("toggle").textContent).toBe("Start")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("toggles on the virtual clock: start, tick, pause", async () => {
    const t = setup()
    await settle()
    t.trigger("toggle").click()
    expect(t.q('[data-part="root"]').dataset["state"]).toBe("running")
    expect(t.trigger("toggle").textContent).toBe("Pause")
    t.clock.advance(3000)
    expect(t.text("seconds")).toBe("03")
    expect(t.q('[data-part="area"]').getAttribute("aria-label")).toBe("3 seconds")
    t.trigger("toggle").click()
    expect(t.q('[data-part="root"]').dataset["state"]).toBe("paused")
    expect(t.trigger("toggle").textContent).toBe("Resume")
    t.clock.advance(5000)
    expect(t.text("seconds")).toBe("03")
  })

  it("keeps the focus on an action that does nothing now", async () => {
    const t = setup()
    await settle()
    const pause = t.trigger("pause")
    expect(pause.getAttribute("aria-disabled")).toBe("true")
    expect(pause.hasAttribute("disabled")).toBe(false)
    expect(pause.dataset["disabled"]).toBe("")
    pause.focus()
    pause.click()
    expect(document.activeElement).toBe(pause)
    expect(t.q('[data-part="root"]').dataset["state"]).toBe("idle")
    t.trigger("toggle").click()
    expect(pause.hasAttribute("aria-disabled")).toBe(false)
    pause.click()
    expect(t.q('[data-part="root"]').dataset["state"]).toBe("paused")
  })

  it("announces the completion once and reports it", async () => {
    const t = setup({ countdown: true, startMs: 2000, autoStart: true, locale: "fr-FR" })
    await settle()
    expect(t.q('[data-part="root"]').dataset["state"]).toBe("running")
    t.clock.advance(2000)
    expect(t.q('[data-part="root"]').dataset["state"]).toBe("completed")
    expect(t.text("seconds")).toBe("00")
    expect(t.rec.log.map((a) => a.message)).toEqual(["Time's up"])
    expect(t.rec.log[0]?.lang).toBe("fr-FR")
    expect(t.completed).toHaveLength(1)
    t.clock.advance(5000)
    expect(t.rec.log).toHaveLength(1)
  })
})
