// Marquee's rules in Node: the state precedence, hover vs the user pause, the sticky focus
// pause, reduced motion, controlled, and the derived copies and duration.
import { describe, expect, it } from "vitest"
import { createService } from "../../machine/service"
import {
  type MarqueeEvent,
  type MarqueeProps,
  marqueeCopies,
  marqueeDuration,
  marqueeMachine,
  marqueeSpeed,
} from "./marquee.machine"

function make(over: Partial<MarqueeProps> = {}) {
  const changes: { paused: boolean; reason: string }[] = []
  let props: MarqueeProps = {
    onPausedChange: (paused, d) => changes.push({ paused, reason: d.reason }),
    ...over,
  }
  const s = createService(marqueeMachine, props, {})
  s.start()
  const send = (e: MarqueeEvent) => s.send(e)
  const state = () => s.getSnapshot().state
  const setProps = (next: Partial<MarqueeProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  const measure = () => send({ type: "MEASURED", viewport: 400, content: 250 })
  return { s, send, state, setProps, measure, changes }
}

describe("marquee machine: precedence", () => {
  it("idle until measured, then running; a zero size goes back to idle", () => {
    const m = make()
    expect(m.state()).toBe("idle")
    m.measure()
    expect(m.state()).toBe("running")
    m.send({ type: "MEASURED", viewport: 0, content: 250 })
    expect(m.state()).toBe("idle")
    m.send({ type: "MEASURED", viewport: 400, content: Number.NaN })
    expect(m.state()).toBe("idle")
  })

  it("reduced motion wins over everything, and lifting it restores the state", () => {
    const m = make({ defaultPaused: true })
    m.measure()
    expect(m.state()).toBe("paused")
    m.send({ type: "MOTION.CHANGED", reduced: true })
    expect(m.state()).toBe("static")
    m.send({ type: "TRIGGER.PRESS", modality: "keyboard" })
    expect(m.state()).toBe("static")
    m.send({ type: "MOTION.CHANGED", reduced: false })
    expect(m.state()).toBe("running")
  })
})

describe("marquee machine: pauses", () => {
  it("hover pauses until leave; leave never clears the user pause", () => {
    const m = make()
    m.measure()
    m.send({ type: "POINTER.ENTER" })
    expect(m.state()).toBe("paused")
    m.send({ type: "POINTER.LEAVE" })
    expect(m.state()).toBe("running")
    m.send({ type: "TRIGGER.PRESS", modality: "pointer" })
    m.send({ type: "POINTER.ENTER" })
    m.send({ type: "POINTER.LEAVE" })
    expect(m.state()).toBe("paused")
  })

  it("pauseOnHover false: hover changes nothing", () => {
    const m = make({ pauseOnHover: false })
    m.measure()
    m.send({ type: "POINTER.ENTER" })
    expect(m.state()).toBe("running")
    m.setProps({ pauseOnHover: true })
    expect(m.state()).toBe("paused")
  })

  it("keyboard and virtual focus pause and stay paused; pointer focus does not", () => {
    for (const modality of ["keyboard", "virtual"] as const) {
      const m = make()
      m.measure()
      m.send({ type: "FOCUS.ENTER", modality })
      expect(m.state()).toBe("paused")
      expect(m.changes).toEqual([{ paused: true, reason: "focus" }])
    }
    for (const modality of ["pointer", "touch"] as const) {
      const m = make()
      m.measure()
      m.send({ type: "FOCUS.ENTER", modality })
      expect(m.state()).toBe("running")
      expect(m.changes).toEqual([])
    }
  })

  it("the trigger toggles, reason trigger", () => {
    const m = make()
    m.measure()
    m.send({ type: "TRIGGER.PRESS", modality: "pointer" })
    m.send({ type: "TRIGGER.PRESS", modality: "pointer" })
    expect(m.state()).toBe("running")
    expect(m.changes).toEqual([
      { paused: true, reason: "trigger" },
      { paused: false, reason: "trigger" },
    ])
  })

  it("controlled: a proposal applies only when the prop arrives", () => {
    const m = make({ paused: false })
    m.measure()
    m.send({ type: "TRIGGER.PRESS", modality: "pointer" })
    expect(m.changes.at(-1)).toEqual({ paused: true, reason: "trigger" })
    expect(m.state()).toBe("running")
    m.setProps({ paused: true })
    expect(m.state()).toBe("paused")
  })
})

describe("marquee derived values", () => {
  it("copies: 2, autoFill fills plus one, capped at 32, static 1", () => {
    const size = { viewport: 1000, content: 300 }
    expect(marqueeCopies("running", size, false)).toBe(2)
    expect(marqueeCopies("running", size, true)).toBe(5)
    expect(marqueeCopies("running", { viewport: 10_000, content: 10 }, true)).toBe(32)
    expect(marqueeCopies("running", null, true)).toBe(2)
    expect(marqueeCopies("static", size, true)).toBe(1)
  })

  it("duration: one copy over speed; bad speeds count as 1", () => {
    expect(marqueeDuration({ viewport: 1, content: 500 }, 50)).toBe(10)
    expect(marqueeDuration({ viewport: 1, content: 500 }, undefined)).toBe(10)
    expect(marqueeDuration(null, 50)).toBeNull()
    expect(marqueeSpeed(0)).toBe(1)
    expect(marqueeSpeed(Number.POSITIVE_INFINITY)).toBe(1)
  })
})
