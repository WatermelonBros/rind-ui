// The timer with a virtual clock and scheduler sharing one time line (no real delays). `lag`
// delays every timeout (a slow frame, a throttled background tab) to prove nothing is lost.
import { describe, expect, it, vi } from "vitest"
import type { Announcement, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import { spokenTimerDuration, toTime } from "./timer.format"
import {
  type TimerProps,
  type TimerState,
  type TimerTickDetails,
  timerConfig,
  timerDisplayed,
  timerMachine,
} from "./timer.machine"
import { timerMessages } from "./timer.messages"

function virtualTime() {
  let now = 0
  let lag = 0
  let seq = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  const scheduler: Scheduler = {
    setTimeout: (fn, ms) => {
      timers.set(seq, { at: now + ms + lag, fn })
      return seq++
    },
    clearTimeout: (h) => {
      timers.delete(h as number)
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  }
  /** Moves the time line to `now + ms`, firing each due timer at its own time, in order. */
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = Math.max(now, due[1].at)
      due[1].fn()
    }
    now = end
  }
  return {
    scheduler,
    clock: { now: () => now },
    advance,
    pending: () => timers.size,
    setLag: (ms: number) => {
      lag = ms
    },
  }
}

function make(over: Partial<TimerProps> = {}) {
  const time = virtualTime()
  const announced: Announcement[] = []
  const ticks: TimerTickDetails[] = []
  const states: TimerState[] = []
  const onComplete = vi.fn()
  let visible: ((hidden: boolean) => void) | undefined
  const props: TimerProps = {
    id: "t1",
    onTick: (d) => ticks.push(d),
    onComplete,
    onStateChange: (s) => states.push(s),
    ...over,
  }
  const env = {
    scheduler: time.scheduler,
    clock: time.clock,
    announcer: {
      announce: (a: Announcement) => {
        announced.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en-US", dir: () => "ltr" as const, subscribe: () => () => {} },
    visibility: {
      hidden: () => false,
      subscribe: (l: (hidden: boolean) => void) => {
        visible = l
        return () => {
          visible = undefined
        }
      },
    },
  }
  const s = createService(timerMachine, props, env)
  s.start()
  const snap = () => s.getSnapshot()
  return {
    s,
    ...time,
    announced,
    ticks,
    states,
    onComplete,
    state: () => snap().state,
    value: () => snap().context.value,
    showPage: () => visible?.(false),
  }
}

describe("timer machine", () => {
  it("a stopwatch counts up from the clock, ticking every second", () => {
    const t = make()
    t.s.send({ type: "START" })
    t.advance(3000)
    expect(t.value()).toBe(3000)
    expect(t.ticks.map((d) => d.value)).toEqual([1000, 2000, 3000])
    expect(t.state()).toBe("running")
  })

  it("pause keeps the time; resume continues from it", () => {
    const t = make()
    t.s.send({ type: "START" })
    t.advance(3500)
    t.s.send({ type: "PAUSE" })
    expect(t.value()).toBe(3500)
    t.advance(10_000)
    expect(t.value()).toBe(3500)
    t.s.send({ type: "RESUME" })
    t.advance(500)
    // The display changes on the value's second, not half a second late.
    expect(t.ticks.at(-1)?.value).toBe(4000)
  })

  it("a background gap is caught up exactly (zag#2226, ark#3298)", () => {
    const t = make()
    const at: number[] = []
    t.s.setProps({
      id: "t1",
      onTick: (d) => {
        at.push(d.value - t.clock.now())
        t.ticks.push(d)
      },
    })
    t.s.send({ type: "START" })
    t.advance(1500)
    t.setLag(62_000)
    t.advance(70_000)
    // Every tick reports the clock's elapsed time, however late it fired.
    expect(at.length).toBeGreaterThan(1)
    expect(new Set(at)).toEqual(new Set([0]))
    expect(t.ticks.at(-1)?.value).toBeGreaterThan(60_000)
  })

  it("late ticks do not drift: each is scheduled for the next whole interval", () => {
    const t = make()
    t.s.send({ type: "START" })
    t.setLag(7)
    t.advance(600_000)
    t.s.send({ type: "PAUSE" })
    expect(t.value()).toBe(600_000)
    // After the first, every tick lands 7 ms after a whole second and never drifts further.
    for (const d of t.ticks.slice(1)) expect(d.value % 1000).toBe(7)
  })

  it("one pending tick however many times props are re-set (zag#2335)", () => {
    const t = make()
    t.s.send({ type: "START" })
    for (let i = 0; i < 10; i++) t.s.setProps({ id: "t1", onTick: () => {} })
    expect(t.pending()).toBe(1)
  })

  it("a countdown completes once, exactly at its target, never past it (zag#2254, #2549)", () => {
    const t = make({ countdown: true, startMs: 5000 })
    t.s.send({ type: "START" })
    t.setLag(4000)
    t.advance(9000)
    expect(t.state()).toBe("completed")
    expect(t.value()).toBe(0)
    expect(t.onComplete).toHaveBeenCalledTimes(1)
    expect(t.announced.map((a) => a.message)).toEqual(["Time's up"])
    t.advance(10_000)
    expect(t.onComplete).toHaveBeenCalledTimes(1)
  })

  it("completes at the exact remaining time, not on the next whole interval", () => {
    const t = make({ countdown: true, startMs: 2500 })
    t.s.send({ type: "START" })
    t.advance(2499)
    expect(t.state()).toBe("running")
    t.advance(1)
    expect(t.state()).toBe("completed")
  })

  it("completes as soon as the page is visible again", () => {
    const t = make({ countdown: true, startMs: 3000 })
    t.s.send({ type: "START" })
    t.setLag(600_000)
    t.advance(500)
    t.advance(5000)
    expect(t.state()).toBe("running")
    t.showPage()
    expect(t.state()).toBe("completed")
    expect(t.onComplete).toHaveBeenCalledTimes(1)
  })

  it("a stopwatch with a target completes; without one never does", () => {
    const a = make({ targetMs: 2000 })
    a.s.send({ type: "START" })
    a.advance(5000)
    expect(a.state()).toBe("completed")
    expect(a.value()).toBe(2000)
    const b = make()
    b.s.send({ type: "START" })
    b.advance(1_000_000)
    expect(b.state()).toBe("running")
  })

  it("reset, restart and toggle follow the state table", () => {
    const t = make({ countdown: true, startMs: 3000 })
    t.s.send({ type: "TOGGLE" })
    expect(t.state()).toBe("running")
    t.advance(1000)
    t.s.send({ type: "TOGGLE" })
    expect(t.state()).toBe("paused")
    t.s.send({ type: "RESET" })
    expect([t.state(), t.value()]).toEqual(["idle", 3000])
    t.s.send({ type: "START" })
    t.advance(3000)
    expect(t.state()).toBe("completed")
    t.s.send({ type: "TOGGLE" })
    expect([t.state(), t.value()]).toEqual(["running", 3000])
    t.advance(1500)
    t.s.send({ type: "RESTART" })
    t.advance(500)
    t.s.send({ type: "PAUSE" })
    expect(t.value()).toBe(2500)
  })

  it("inapplicable actions do nothing", () => {
    const t = make()
    t.s.send({ type: "PAUSE" })
    t.s.send({ type: "RESUME" })
    expect(t.state()).toBe("idle")
    t.s.send({ type: "START" })
    t.s.send({ type: "START" })
    t.s.send({ type: "RESUME" })
    expect(t.state()).toBe("running")
  })

  it("autoStart runs from mount", () => {
    const t = make({ autoStart: true })
    t.advance(1000)
    expect([t.state(), t.value()]).toEqual(["running", 1000])
  })

  it("a new startMs applies in every state (zag#2262)", () => {
    const t = make({ countdown: true, startMs: 60_000 })
    t.s.send({ type: "START" })
    t.advance(5000)
    t.s.setProps({ id: "t1", countdown: true, startMs: 30_000 })
    expect([t.state(), t.value()]).toEqual(["running", 30_000])
    t.advance(1000)
    expect(t.value()).toBe(29_000)
    t.s.send({ type: "PAUSE" })
    t.s.setProps({ id: "t1", countdown: true, startMs: 10_000 })
    expect([t.state(), t.value()]).toEqual(["paused", 10_000])
    t.s.send({ type: "RESET" })
    t.s.setProps({ id: "t1", countdown: true, startMs: 5000 })
    expect([t.state(), t.value()]).toEqual(["idle", 5000])
  })

  it("onStateChange reports each change", () => {
    const t = make({ countdown: true, startMs: 1000 })
    t.s.send({ type: "START" })
    t.s.send({ type: "PAUSE" })
    t.s.send({ type: "RESUME" })
    t.advance(1000)
    expect(t.states).toEqual(["running", "paused", "running", "completed"])
  })

  it("stopping the service clears the pending tick", () => {
    const t = make()
    t.s.send({ type: "START" })
    t.s.stop()
    expect(t.pending()).toBe(0)
  })
})

describe("timer configuration", () => {
  it("normalises invalid values with a warning, never a throw", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(timerConfig({ id: "x", startMs: -5, interval: 0 })).toMatchObject({
      start: 0,
      interval: 1000,
    })
    expect(timerConfig({ id: "x", countdown: true, startMs: 1000, targetMs: 5000 }).target).toBe(0)
    expect(timerConfig({ id: "x", startMs: 5000, targetMs: 1000 }).target).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it("displays a countdown rounded up and a stopwatch rounded down", () => {
    const down = timerConfig({ id: "x", countdown: true, startMs: 10_000 })
    expect(timerDisplayed(down, 600)).toBe(1000)
    expect(timerDisplayed(down, 0)).toBe(0)
    const up = timerConfig({ id: "x" })
    expect(timerDisplayed(up, 1999)).toBe(1000)
  })
})

describe("timer format", () => {
  it("splits ms into units", () => {
    expect(toTime(90_061_005)).toEqual({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      milliseconds: 5,
    })
  })

  it("speaks the duration without zero units, and zero as zero seconds", () => {
    const fallback = { ...timerMessages }
    expect(timerMessages.duration(toTime(3_605_000))).toBe("1 hour, 5 seconds")
    expect(timerMessages.duration(toTime(0))).toBe("0 seconds")
    expect(spokenTimerDuration(toTime(65_000), "en-US", fallback)).toMatch(/1 minute,? 5 seconds/)
  })
})
