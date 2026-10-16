// add-scroll-area 1.2: the activity graph on a fake clock, visibility per type through
// connect, the tab-stop latch. The DOM module is faked: tests send METRICS themselves.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DomEnvironment } from "../../env/dom-environment"
import { createService } from "../../machine/service"
import { scrollAreaConnect, scrollbarVisible } from "./scroll-area.connect"
import {
  type ScrollAreaEvent,
  type ScrollAreaProps,
  type ScrollMetricsEnv,
  scrollAreaMachine,
} from "./scroll-area.machine"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const scheduler = {
  // fake-time: vi.useFakeTimers drives it
  setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
  clearTimeout: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
  // fake-time: vi.useFakeTimers drives it
  requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16),
  cancelAnimationFrame: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

function area(props: Partial<ScrollAreaProps> = {}) {
  const tracked = { stopped: 0, measured: 0 }
  const env: Pick<DomEnvironment, "scheduler"> & ScrollMetricsEnv = {
    scheduler,
    scrollMetrics: {
      track: () => ({
        measure: () => {
          tracked.measured++
        },
        stop: () => {
          tracked.stopped++
        },
      }),
    },
  }
  // The fake implements every capability the machine reaches (scheduler, scrollMetrics).
  const s = createService(scrollAreaMachine, { root: "a", ...props }, env as never)
  s.start()
  const send = (e: ScrollAreaEvent) => s.send(e)
  const overflow = (tabbable = false, x = false) =>
    send({
      type: "METRICS",
      overflow: { x, y: true },
      edges: { xStart: false, xEnd: false, yStart: false, yEnd: true },
      tabbable,
    })
  const input = () => {
    const snap = s.getSnapshot()
    return {
      instance: "a",
      state: snap.state as "idle" | "engaged" | "lingering" | "dragging",
      context: snap.context,
      type: props.type ?? "hover",
      modality: "pointer" as const,
    }
  }
  return {
    s,
    send,
    overflow,
    tracked,
    state: () => s.getSnapshot().state,
    ctx: () => s.getSnapshot().context,
    visible: (axis: "x" | "y" = "y") => scrollbarVisible(input(), axis),
    parts: () => scrollAreaConnect(input()),
  }
}

const mouse = { pointerType: "mouse" } as const

describe("scroll-area machine", () => {
  it("hover: visible on enter, still at 599 ms after leaving, hidden at 600 ms", () => {
    const a = area()
    a.overflow()
    expect(a.visible()).toBe(false)
    a.send({ type: "POINTER.ENTER", ...mouse })
    expect(a.visible()).toBe(true)
    a.send({ type: "POINTER.LEAVE", ...mouse })
    expect(a.state()).toBe("lingering")
    vi.advanceTimersByTime(599)
    expect(a.visible()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(a.state()).toBe("idle")
    expect(a.visible()).toBe(false)
  })

  it("hover from a touch never engages", () => {
    const a = area()
    a.overflow()
    a.send({ type: "POINTER.ENTER", pointerType: "touch" })
    expect(a.state()).toBe("idle")
  })

  it("scroll type ignores hover; a user scroll shows, then hides after the delays", () => {
    const a = area({ type: "scroll" })
    a.overflow()
    a.send({ type: "POINTER.ENTER", ...mouse })
    expect(a.visible()).toBe(false)
    a.send({ type: "SCROLL", axis: "y", user: true })
    expect(a.visible()).toBe(true)
    vi.advanceTimersByTime(100)
    expect(a.state()).toBe("lingering")
    expect(a.visible()).toBe(true)
    vi.advanceTimersByTime(600)
    expect(a.visible()).toBe(false)
  })

  it("a programmatic scroll stays quiet (mui/base-ui#983)", () => {
    const a = area({ type: "scroll" })
    a.overflow()
    a.send({ type: "SCROLL", axis: "y", user: false })
    expect(a.state()).toBe("idle")
    expect(a.visible()).toBe(false)
  })

  it("focus inside engages a hover area (keyboard users see the position)", () => {
    const a = area()
    a.overflow()
    a.send({ type: "FOCUS.IN" })
    expect(a.visible()).toBe(true)
    a.send({ type: "FOCUS.OUT" })
    expect(a.state()).toBe("lingering")
  })

  it("repeated scrolls restart the scroll-end delay", () => {
    const a = area({ type: "scroll" })
    a.overflow()
    a.send({ type: "SCROLL", axis: "y", user: true })
    vi.advanceTimersByTime(90)
    a.send({ type: "SCROLL", axis: "y", user: true })
    vi.advanceTimersByTime(90)
    expect(a.state()).toBe("engaged")
    expect(a.ctx().scrolling).toBe("y")
    vi.advanceTimersByTime(10)
    expect(a.state()).toBe("lingering")
    expect(a.ctx().scrolling).toBe(null)
  })

  it("drag end: engaged while still hovered, lingering otherwise; one dragging axis", () => {
    const a = area()
    a.overflow(false, true)
    a.send({ type: "POINTER.ENTER", ...mouse })
    a.send({ type: "DRAG.START", axis: "x" })
    expect(a.state()).toBe("dragging")
    const parts = a.parts()
    expect(parts.thumb("horizontal")["data-dragging"]).toBe("")
    expect(parts.thumb("vertical")["data-dragging"]).toBeUndefined()
    a.send({ type: "DRAG.END" })
    expect(a.state()).toBe("engaged")
    a.send({ type: "POINTER.LEAVE", ...mouse })
    a.send({ type: "DRAG.START", axis: "y" })
    a.send({ type: "DRAG.CANCEL" })
    expect(a.state()).toBe("lingering")
  })

  it("auto and always", () => {
    const auto = area({ type: "auto" })
    expect(auto.visible()).toBe(false)
    auto.overflow()
    expect(auto.visible("y")).toBe(true)
    expect(auto.visible("x")).toBe(false)
    expect(area({ type: "always" }).visible()).toBe(true)
  })
})

describe("tab stop", () => {
  it("only after measuring, overflowing, with no tabbable content", () => {
    const a = area()
    expect(a.ctx().tabStop).toBe(false)
    a.overflow(true)
    expect(a.ctx().tabStop).toBe(false)
    a.overflow(false)
    expect(a.ctx().tabStop).toBe(true)
    expect(a.parts().viewport(() => {}, false)["tabindex"]).toBe(0)
  })

  it("kept while the Viewport has focus, dropped on blur (mui/base-ui#4205)", () => {
    const a = area()
    a.overflow(false)
    a.send({ type: "VIEWPORT.FOCUS" })
    a.send({
      type: "METRICS",
      overflow: { x: false, y: false },
      edges: { xStart: false, xEnd: false, yStart: false, yEnd: false },
      tabbable: false,
    })
    expect(a.ctx().tabStop).toBe(true)
    a.send({ type: "VIEWPORT.BLUR" })
    expect(a.ctx().tabStop).toBe(false)
  })

  it("no overflow, no stop; no data-overflow before measuring (mui/base-ui#3829)", () => {
    const a = area()
    const vp = a.parts().viewport(() => {}, false)
    expect(vp["tabindex"]).toBeUndefined()
    expect(
      Object.entries(vp).some(([k, v]) => k.startsWith("data-overflow") && v !== undefined),
    ).toBe(false)
  })
})

describe("tracking", () => {
  it("one tracking session, stopped with the service", () => {
    const a = area()
    a.s.stop()
    expect(a.tracked.stopped).toBe(1)
  })
})
