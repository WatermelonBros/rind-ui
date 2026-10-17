// The Drawer machine in Node (openspec add-drawer): the Dialog's transitions under scope
// "drawer", the swipe decisions, snap points and the gesture events. There is no document, so
// the DOM effects do nothing; sizes arrive through SIZE.CHANGE. No test reads a clock.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { dismissRequest } from "../../dom/dismiss"
import type { SwipeRelease } from "../../dom/swipe"
import { createService } from "../../machine/service"

const overlay = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock("../../dom/overlay", () => ({
  overlayEffect: (_env: unknown, options: unknown) => {
    overlay.calls.push(options)
    return vi.fn()
  },
}))

import { type DrawerEvent, type DrawerProps, drawerMachine } from "./drawer.machine"
import type { SnapPoint } from "./snap-points"

const quietEnv = {
  dom: { getById: () => null },
  modality: { modality: () => "keyboard" },
  scheduler: { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} },
}

function make(over: Partial<DrawerProps> = {}) {
  const onOpenChange = vi.fn()
  const onSnapPointChange = vi.fn()
  let props: DrawerProps = { root: "r", onOpenChange, onSnapPointChange, ...over }
  const s = createService(drawerMachine, props as never, quietEnv as never)
  s.start()
  const values = () => s.view().values as Record<string, unknown>
  return {
    s,
    onOpenChange,
    onSnapPointChange,
    state: () => s.getSnapshot().state,
    open: () => values()["open"],
    snap: () => values()["snapPoint"],
    ctx: () =>
      s.getSnapshot().context as {
        swipe: string
        closeReason: string | null
        nested: { count: number; frontmostSize: number; swiping: boolean }
      },
    send: (e: DrawerEvent) => s.send(e as never),
    setProps: (p: Partial<DrawerProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}

const rel = (over: Partial<SwipeRelease> = {}): DrawerEvent => ({
  type: "SWIPE",
  direction: "down",
  offset: 0,
  velocity: 0,
  size: 400,
  ...over,
})
const sizeChange = {
  type: "SIZE.CHANGE",
  content: 800,
  viewport: 800,
  rootFontSize: 16,
} as const
const dismissal = (type: "ESCAPE_KEY" | "OUTSIDE_PRESS") =>
  ({ type, request: dismissRequest("escape-key", undefined, null) }) as DrawerEvent
const POINTS: SnapPoint[] = [0.4, 1]

beforeEach(() => {
  overlay.calls.length = 0
})

describe("the Dialog's transitions under scope drawer", () => {
  it("trigger opens; the close trigger closes", () => {
    const m = make()
    m.send({ type: "TRIGGER_PRESS", trigger: "t1", modality: "pointer" })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("trigger")
    m.send({ type: "CLOSE_TRIGGER_PRESS", modality: "pointer" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls[1]?.[1].reason).toBe("close-trigger")
  })

  it.each([
    ["ESCAPE_KEY", "escape-key"],
    ["OUTSIDE_PRESS", "outside-press"],
  ] as const)("%s closes with reason %s", (type, reason) => {
    const m = make({ defaultOpen: true })
    m.send(dismissal(type))
    expect(m.state()).toBe("closed")
    expect(m.ctx().closeReason).toBe(reason)
  })

  it("OPEN and CLOSE (api) work", () => {
    const m = make()
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("open")
    m.send({ type: "CLOSE" })
    expect(m.state()).toBe("closed")
    expect(m.ctx().closeReason).toBe("api")
  })

  it("the overlay effect is wired while open", () => {
    make({ defaultOpen: true })
    expect(overlay.calls.length).toBeGreaterThan(0)
  })
})

describe("swipe dismissal", () => {
  it.each([
    ["offset at half the size", { offset: 200 }],
    ["velocity at 0.5", { velocity: 0.5 }],
  ])("a bottom drawer closes on a release down with %s", (_n, over) => {
    const m = make({ defaultOpen: true })
    m.send(rel(over))
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("swipe")
    expect(m.ctx().closeReason).toBe("swipe")
    expect(m.ctx().swipe).toBe("releasing")
  })

  it("the edge follows the side: inline-start under rtl is right", () => {
    const m = make({ defaultOpen: true, side: "inline-start", dir: "rtl" })
    m.send(rel({ direction: "left", offset: 300 }))
    expect(m.state()).toBe("open")
    m.send(rel({ direction: "right", offset: 300 }))
    expect(m.state()).toBe("closed")
  })

  it.each([
    ["top", "up"],
    ["left", "left"],
    ["right", "right"],
  ] as const)("a %s drawer closes toward %s", (side, direction) => {
    const m = make({ defaultOpen: true, side })
    m.send(rel({ direction, offset: 300 }))
    expect(m.state()).toBe("closed")
  })

  it("a short, slow release stays open and settles to idle", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "SWIPE.START", modality: "touch" })
    m.send(rel({ offset: 199, velocity: 0.49 }))
    expect(m.state()).toBe("open")
    expect(m.ctx().swipe).toBe("idle")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("a null direction never dismisses", () => {
    const m = make({ defaultOpen: true })
    m.send(rel({ direction: null, offset: 999, velocity: 9 }))
    expect(m.state()).toBe("open")
  })

  it("a release away from the edge never dismisses", () => {
    const m = make({ defaultOpen: true })
    m.send(rel({ direction: "up", offset: 999, velocity: 9 }))
    expect(m.state()).toBe("open")
  })

  it("closeOnSwipe=false never dismisses", () => {
    const m = make({ defaultOpen: true, closeOnSwipe: false })
    m.send(rel({ offset: 400, velocity: 2 }))
    expect(m.state()).toBe("open")
    expect(m.ctx().swipe).toBe("idle")
  })

  it("details.cancel() on an uncontrolled swipe close keeps it open", () => {
    const onOpenChange = vi.fn((_o: boolean, d: { cancel(): void }) => d.cancel())
    const m = make({ defaultOpen: true, onOpenChange: onOpenChange as never })
    m.send(rel({ offset: 300 }))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
  })
})

describe("controlled open", () => {
  it("a swipe past the threshold proposes close; the parent keeping open leaves it releasing", () => {
    const m = make({ open: true })
    m.send(rel({ offset: 300 }))
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("swipe")
    expect(m.state()).toBe("open")
    expect(m.ctx().swipe).toBe("releasing")
  })

  it("a setProps keeping open reverts the release to idle", () => {
    const m = make({ open: true })
    m.send(rel({ offset: 300 }))
    m.setProps({ open: true })
    expect(m.state()).toBe("open")
    expect(m.ctx().swipe).toBe("idle")
  })

  it("the parent applying the proposal closes it", () => {
    const m = make({ open: true })
    m.send(rel({ offset: 300 }))
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
  })
})

describe("snap points", () => {
  const withPoints = (over: Partial<DrawerProps> = {}) => {
    const m = make({ defaultOpen: true, snapPoints: POINTS, ...over })
    m.send(sizeChange)
    return m
  }

  it("a new open starts at defaultSnapPoint, or the first given", () => {
    expect(withPoints().snap()).toBe(0.4)
    expect(withPoints({ defaultSnapPoint: 1 }).snap()).toBe(1)
  })

  it("each open resets to the default point", () => {
    const m = withPoints()
    m.send({ type: "SNAP_POINT.SET", value: 1 })
    m.send({ type: "CLOSE" })
    m.send({ type: "OPEN" })
    expect(m.snap()).toBe(0.4)
  })

  it("HANDLE_PRESS cycles 0.4 -> 1 -> 0.4 and never closes", () => {
    const m = withPoints()
    m.send({ type: "HANDLE_PRESS", modality: "pointer" })
    expect(m.snap()).toBe(1)
    m.send({ type: "HANDLE_PRESS", modality: "pointer" })
    expect(m.snap()).toBe(0.4)
    expect(m.state()).toBe("open")
  })

  it("HANDLE_PRESS is ignored with fewer than two points", () => {
    const one = make({ defaultOpen: true, snapPoints: [0.4] })
    one.send(sizeChange)
    one.send({ type: "HANDLE_PRESS", modality: "pointer" })
    expect(one.snap()).toBe(0.4)
    const none = make({ defaultOpen: true })
    none.send(sizeChange)
    none.send({ type: "HANDLE_PRESS", modality: "pointer" })
    expect(none.onSnapPointChange).not.toHaveBeenCalled()
  })

  it("HANDLE_PRESS is ignored before the size is known", () => {
    const m = make({ defaultOpen: true, snapPoints: POINTS })
    m.send({ type: "HANDLE_PRESS", modality: "pointer" })
    expect(m.snap()).toBe(0.4)
  })

  it("a swipe settling picks a point; onSnapPointChange reason is the SWIPE event (spec)", () => {
    const m = withPoints()
    // Up (away from the bottom edge) by 480px from 0.4 (320px) projects to 800px: point 1.
    m.send(rel({ direction: "up", offset: 480 }))
    expect(m.snap()).toBe(1)
    expect(m.state()).toBe("open")
    const call = m.onSnapPointChange.mock.calls.at(-1)
    expect(call?.[0]).toBe(1)
    expect(call?.[1].reason).toBe("swipe")
    expect(call?.[1].event.type).toBe("SWIPE")
  })

  it("a swipe down from the largest point settles on the smaller one", () => {
    const m = withPoints({ defaultSnapPoint: 1 })
    m.send(rel({ direction: "down", offset: 400 }))
    expect(m.state()).toBe("open")
    expect(m.snap()).toBe(0.4)
  })

  it("a controlled snapPoint keeps its value while onSnapPointChange is called", () => {
    const m = withPoints({ snapPoint: 0.4 })
    m.send({ type: "HANDLE_PRESS", modality: "pointer" })
    expect(m.onSnapPointChange).toHaveBeenCalledTimes(1)
    expect(m.onSnapPointChange.mock.calls[0]?.[0]).toBe(1)
    expect(m.snap()).toBe(0.4)
  })

  it("SNAP_POINT.SET sets it", () => {
    const m = withPoints()
    m.send({ type: "SNAP_POINT.SET", value: 1 })
    expect(m.snap()).toBe(1)
    expect(m.onSnapPointChange.mock.calls.at(-1)?.[0]).toBe(1)
  })
})

describe("gesture events", () => {
  it("SWIPE.START sets swiping; SWIPE.CANCEL sets idle", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "SWIPE.START", modality: "pointer" })
    expect(m.ctx().swipe).toBe("swiping")
    m.send({ type: "SWIPE.CANCEL" })
    expect(m.ctx().swipe).toBe("idle")
  })

  it("NESTED.CHANGE stores the nested metrics", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "NESTED.CHANGE", count: 2, frontmostSize: 320, swiping: true })
    expect(m.ctx().nested).toEqual({ count: 2, frontmostSize: 320, swiping: true })
  })

  it("gesture events are ignored while closed", () => {
    const m = make()
    m.send({ type: "SWIPE.START", modality: "pointer" })
    m.send({ type: "NESTED.CHANGE", count: 1, frontmostSize: 1, swiping: false })
    expect(m.ctx().swipe).toBe("idle")
    expect(m.ctx().nested.count).toBe(0)
  })
})
