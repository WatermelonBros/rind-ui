// Timer (Vue) through its driver: anatomy and role=timer, a disabled trigger keeps focus,
// toggle and completion on a virtual clock, and markup parity with React (server and client).
import * as R from "@rind-ui/react"
import { getTimer, recordingAnnouncer, virtualClock } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RindProvider, Timer } from "../index"

const countdown = (p: Record<string, unknown> = {}) =>
  h(Timer.Root, { countdown: true, startMs: 65_000, ...p }, () => [
    h(Timer.Area, null, () => [
      h(Timer.Item, { type: "minutes" }, () => [
        h(Timer.ItemValue),
        h(Timer.ItemLabel, null, () => "min"),
      ]),
      h(Timer.Separator, null, () => ":"),
      h(Timer.Item, { type: "seconds" }, () => h(Timer.ItemValue)),
    ]),
    h(Timer.Control, null, () => [
      h(
        Timer.ActionTrigger,
        { action: "toggle" },
        { default: ({ label }: { label: string }) => label },
      ),
      h(Timer.ActionTrigger, { action: "pause" }),
      h(Timer.ActionTrigger, { action: "reset" }, () => "Reset"),
    ]),
  ])

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

function setup(p: Record<string, unknown> = {}) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  mount(() =>
    h(
      RindProvider,
      { announcer: rec.announcer, environment: { scheduler: clock.scheduler, clock: clock.clock } },
      () => countdown(p),
    ),
  )
  const advance = async (ms: number) => {
    clock.advance(ms)
    await nextTick()
  }
  return { log: rec.log, advance, d: getTimer(document.body) }
}

const trigger = (action: string) =>
  document.querySelector(`[data-action="${action}"]`) as HTMLButtonElement

describe("vue timer", () => {
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

  it("toggle runs and pauses on the virtual clock; the slot's label follows", async () => {
    const onStateChange = vi.fn()
    const { d, advance } = setup({ onStateChange })
    await d.toggle()
    expect(await d.state()).toBe("running")
    expect(trigger("toggle").textContent).toBe("Pause")
    await advance(3000)
    expect(await d.text()).toBe("01min:02")
    await d.toggle()
    expect(await d.state()).toBe("paused")
    await advance(5000)
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
    await nextTick()
    expect(document.activeElement).toBe(pause)
    expect(await d.state()).toBe("idle")
  })

  it("completion announces Time's up once, politely", async () => {
    const onComplete = vi.fn()
    const { d, advance, log } = setup({ startMs: 2000, onComplete })
    await d.toggle()
    await advance(2000)
    expect(await d.state()).toBe("completed")
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(log.map((a) => [a.message, a.priority])).toEqual([["Time's up", "polite"]])
    await d.reset()
    expect(await d.text()).toBe("00min:02")
  })

  it("matches React's markup, server and client", async () => {
    await serverParity(reactCountdown(), () => countdown())
    await clientParity(reactCountdown(), () => countdown())
  })
})
