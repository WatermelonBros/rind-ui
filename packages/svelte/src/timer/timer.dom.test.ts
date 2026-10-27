// Timer (Svelte) through its driver: anatomy and role=timer, a disabled trigger keeps focus,
// toggle and completion on a virtual clock, and DOM parity with React.
import * as R from "@rind-ui/react"
import { getTimer, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Countdown from "../../fixtures/timer/countdown.svelte"

const reactCountdown = (p: Record<string, unknown> = {}) =>
  r(
    R.Timer.Root,
    { countdown: true, startMs: 65_000, ...p },
    r(
      R.Timer.Area,
      { key: "a" },
      r(
        R.Timer.Item,
        { type: "minutes", key: "m" },
        r(R.Timer.ItemValue, { key: "v" }),
        r(R.Timer.ItemLabel, { key: "l" }, "min"),
      ),
      r(R.Timer.Separator, { key: "s" }, ":"),
      r(R.Timer.Item, { type: "seconds", key: "x" }, r(R.Timer.ItemValue)),
    ),
    r(
      R.Timer.Control,
      { key: "c" },
      r(
        R.Timer.ActionTrigger,
        { action: "toggle", key: "t" },
        // A render function child: React types children as ReactNode.
        (({ label }: { label: string }) => label) as never,
      ),
      r(R.Timer.ActionTrigger, { action: "pause", key: "p" }),
      r(R.Timer.ActionTrigger, { action: "reset", key: "r" }, "Reset"),
    ),
  )

function setup(root: Record<string, unknown> = {}) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  mount(Countdown, {
    root,
    provider: {
      announcer: rec.announcer,
      environment: { scheduler: clock.scheduler, clock: clock.clock },
    },
  } as never)
  const advance = (ms: number) => {
    clock.advance(ms)
    flushSync()
  }
  return { log: rec.log, advance, d: getTimer(document.body) }
}

const trigger = (action: string) =>
  document.querySelector(`[data-action="${action}"]`) as HTMLButtonElement

describe("svelte timer", () => {
  it("one role=timer named by the duration in words; units in two digits", async () => {
    const { d } = setup()
    const area = document.querySelector('[role="timer"]')
    expect(area?.getAttribute("aria-label")).toBe("1 minute, 5 seconds")
    expect(area?.getAttribute("aria-atomic")).toBe("true")
    expect(await d.text()).toBe("01min:05")
    expect(document.querySelector('[data-part="separator"]')?.getAttribute("aria-hidden")).toBe(
      "true",
    )
    expect(trigger("toggle").textContent).toBe("Start")
    expect(trigger("pause").textContent).toBe("Pause")
    expect(trigger("toggle").getAttribute("type")).toBe("button")
  })

  it("toggle runs and pauses on the virtual clock; the snippet's label follows", async () => {
    const onStateChange = vi.fn()
    const { d, advance } = setup({ onStateChange })
    await d.toggle()
    expect(await d.state()).toBe("running")
    expect(trigger("toggle").textContent).toBe("Pause")
    advance(3000)
    expect(await d.text()).toBe("01min:02")
    await d.toggle()
    expect(await d.state()).toBe("paused")
    advance(5000)
    expect(await d.text()).toBe("01min:02")
    expect(trigger("toggle").textContent).toBe("Resume")
    expect(onStateChange.mock.calls.map((c) => c[0])).toEqual(["running", "paused"])
  })

  it("a trigger whose action does nothing is aria-disabled and keeps focus", async () => {
    const { d } = setup()
    const pause = trigger("pause")
    expect(pause.getAttribute("aria-disabled")).toBe("true")
    expect(pause.disabled).toBe(false)
    pause.focus()
    pause.click()
    flushSync()
    expect(document.activeElement).toBe(pause)
    expect(await d.state()).toBe("idle")
  })

  it("completion announces Time's up once, politely", async () => {
    const onComplete = vi.fn()
    const { d, advance, log } = setup({ startMs: 2000, onComplete })
    await d.toggle()
    advance(2000)
    expect(await d.state()).toBe("completed")
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(log.map((a) => [a.message, a.priority])).toEqual([["Time's up", "polite"]])
    await d.reset()
    expect(await d.text()).toBe("00min:02")
  })

  it("matches React", async () => {
    await clientParity(reactCountdown(), Countdown, {} as never)
  })
})
