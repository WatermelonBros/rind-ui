// Streaming Message's rules in Node: the state precedence, the reveal on a manual clock,
// mount and rewrite, cancel and error, reduced motion, every announce mode.
import { describe, expect, it } from "vitest"
import type { Announcement, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import {
  displayedText,
  REVEAL_TICK_MS,
  revealStep,
  type StreamingMessageProps,
  streamingMessageMachine,
} from "./streaming-message.machine"
import { streamingMessageMessages } from "./streaming-message.messages"

/** Timers run in time order, including ones scheduled while advancing. */
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
  return { scheduler, advance }
}

function make(over: Partial<StreamingMessageProps> = {}) {
  const log: Announcement[] = []
  const clock = manualClock()
  let props: StreamingMessageProps = {
    id: "m",
    text: "",
    status: "pending",
    messages: streamingMessageMessages,
    ...over,
  }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    scheduler: clock.scheduler,
  }
  const s = createService(streamingMessageMachine, props, env)
  s.start()
  const set = (next: Partial<StreamingMessageProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  const state = () => s.getSnapshot().state
  const shown = () => displayedText(state(), props, s.getSnapshot().context)
  const said = () => log.map((a) => a.message)
  return { s, set, state, shown, said, advance: clock.advance }
}

describe("streaming-message machine: states and text", () => {
  it("pending, streaming, settling until revealed, complete", () => {
    const m = make()
    expect(m.state()).toBe("pending")
    m.set({ status: "streaming" })
    m.set({ text: "Hello world" })
    expect(m.state()).toBe("streaming")
    expect(m.shown()).toBe("")
    m.set({ status: "complete" })
    expect(m.state()).toBe("settling")
    m.advance(1000)
    expect(m.state()).toBe("complete")
    expect(m.shown()).toBe("Hello world")
  })

  it("a 500-character backlog drains within 16 ticks", () => {
    const m = make({ status: "streaming" })
    m.set({ text: "x".repeat(500) })
    m.advance(16 * REVEAL_TICK_MS)
    expect(m.shown()).toHaveLength(500)
  })

  it("text present at mount is shown at once, and a mounted complete message is silent", () => {
    const m = make({ text: "Old answer", status: "complete" })
    expect(m.state()).toBe("complete")
    expect(m.shown()).toBe("Old answer")
    expect(m.said()).toEqual([])
  })

  it("cancel and error show everything received", () => {
    for (const status of ["cancelled", "error"] as const) {
      const m = make({ status: "streaming" })
      m.set({ text: "Half an answer" })
      m.advance(REVEAL_TICK_MS)
      m.set({ status })
      expect(m.state()).toBe(status === "error" ? "error" : "cancelled")
      expect(m.shown()).toBe("Half an answer")
    }
  })

  it("a rewrite that is not an extension restarts the reveal", () => {
    const m = make({ status: "streaming" })
    m.set({ text: "Hello wor" })
    m.advance(1000)
    m.set({ text: "Hi" })
    expect(m.shown()).toBe("")
    m.advance(1000)
    expect(m.shown()).toBe("Hi")
  })

  it("smooth false and reduced motion show every chunk at once", () => {
    const off = make({ status: "streaming", smooth: false })
    off.set({ text: "Chunk" })
    expect(off.shown()).toBe("Chunk")
    const reduced = make({ status: "streaming" })
    reduced.s.send({ type: "MOTION.CHANGED", reduced: true })
    reduced.set({ text: "Chunk" })
    expect(reduced.shown()).toBe("Chunk")
  })
})

describe("streaming-message machine: announcements", () => {
  const run = (announce: StreamingMessageProps["announce"]) => {
    const m = make({ ...(announce ? { announce } : {}), status: "pending" })
    m.set({ status: "streaming" })
    for (const chunk of ["One. ", "One. Two", "One. Two. Three."]) m.set({ text: chunk })
    m.set({ status: "complete" })
    m.advance(1000)
    return m.said()
  }

  it("status (default): start and completion only", () => {
    expect(run(undefined)).toEqual(["Generating a response", "Response complete"])
  })

  it("text: the complete text once", () => {
    expect(run("text")).toEqual(["One. Two. Three."])
  })

  it("sentences: each sentence as it completes, the rest at the end", () => {
    expect(run("sentences")).toEqual(["One.", "Two.", "Three."])
  })

  it("none: nothing", () => {
    expect(run("none")).toEqual([])
  })

  it("cancel and failure", () => {
    const c = make({ status: "streaming" })
    c.set({ status: "cancelled" })
    expect(c.said()).toEqual(["Generating a response", "Response cancelled"])
    const f = make({ status: "streaming", announce: "text" })
    f.set({ status: "error" })
    expect(f.said()).toEqual(["The response failed"])
  })
})

describe("revealStep", () => {
  it("drains in drainMs, never slower than maxCharIntervalMs, never past the backlog", () => {
    expect(revealStep(0)).toBe(0)
    expect(revealStep(1)).toBe(1)
    // 10 chars: the 5 ms floor, 3 per 16 ms tick.
    expect(revealStep(10)).toBe(3)
    // 1000 chars in 250 ms: 64 per 16 ms tick.
    expect(revealStep(1000)).toBe(64)
    expect(revealStep(1000, { drainMs: 1000 })).toBe(16)
  })
})
