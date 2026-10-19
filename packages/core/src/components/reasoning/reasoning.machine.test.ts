// Reasoning's rules in Node on a manual clock: live open and close, mount never toggles, the
// user wins, focus inside blocks the close, the duration, the announcements.
import { describe, expect, it } from "vitest"
import type { Announcement, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import { type ReasoningProps, reasoningDuration, reasoningMachine } from "./reasoning.machine"
import { reasoningMessages } from "./reasoning.messages"

function manualClock() {
  let now = 0
  let next = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  const scheduler: Scheduler = {
    setTimeout: (fn, ms) => {
      timers.set(next, { at: now + ms, fn })
      return next++
    },
    clearTimeout: (h) => {
      timers.delete(h as number)
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  }
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].fn()
    }
    now = end
  }
  return { scheduler, clock: { now: () => now }, advance }
}

function make(over: Partial<ReasoningProps> = {}, focusInside = false) {
  const log: Announcement[] = []
  const t = manualClock()
  let props: ReasoningProps = { id: "r", thinking: false, messages: reasoningMessages, ...over }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    scheduler: t.scheduler,
    clock: t.clock,
    focusInside: () => focusInside,
  }
  const s = createService(reasoningMachine, props, env)
  s.start()
  const set = (next: Partial<ReasoningProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  const open = () => s.view(props as never).values.open
  const said = () => log.map((a) => a.message)
  const duration = () => reasoningDuration(props, s.getSnapshot().context)
  return { s, set, open, said, duration, advance: t.advance }
}

describe("reasoning machine", () => {
  it("live: opens on start, closes autoCloseDelay after the end", () => {
    const m = make()
    m.set({ thinking: true })
    expect(m.open()).toBe(true)
    m.advance(11_200)
    m.set({ thinking: false })
    expect(m.open()).toBe(true)
    m.advance(999)
    expect(m.open()).toBe(true)
    m.advance(1)
    expect(m.open()).toBe(false)
    expect(m.duration()).toBe(12)
    expect(m.said()).toEqual(["Thinking…", "Thought for 12 seconds"])
  })

  it("mounted done never toggles or announces; mounted thinking is a live start", () => {
    const done = make({ thinking: false })
    expect(done.open()).toBe(false)
    expect(done.said()).toEqual([])
    const thinking = make({ thinking: true })
    expect(thinking.s.getSnapshot().state).toBe("thinking")
    expect(thinking.open()).toBe(true)
    expect(thinking.said()).toEqual(["Thinking…"])
    thinking.advance(3000)
    thinking.set({ thinking: false })
    expect(thinking.duration()).toBe(3)
  })

  it("the user's toggle wins: no auto-close, no auto-open afterwards", () => {
    const m = make()
    m.set({ thinking: true })
    m.s.send({ type: "TOGGLE" })
    m.s.send({ type: "TOGGLE" })
    m.set({ thinking: false })
    m.advance(5000)
    expect(m.open()).toBe(true)
    m.s.send({ type: "TOGGLE" })
    m.set({ thinking: true })
    expect(m.open()).toBe(false)
  })

  it("focus inside the content blocks the auto-close", () => {
    const m = make({}, true)
    m.set({ thinking: true })
    m.set({ thinking: false })
    m.advance(2000)
    expect(m.open()).toBe(true)
  })

  it("the runtime's duration wins; unknown when mounted done", () => {
    const m = make()
    m.set({ thinking: true })
    m.advance(3000)
    m.set({ thinking: false, duration: 7 })
    expect(m.duration()).toBe(7)
    expect(make().duration()).toBeNull()
  })

  it("announce false is silent", () => {
    const m = make({ announce: false })
    m.set({ thinking: true })
    m.set({ thinking: false })
    expect(m.said()).toEqual([])
  })
})
