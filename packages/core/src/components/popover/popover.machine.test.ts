// The Popover machine in Node (openspec add-popover): every transition, guards, controlled
// proposals and their reasons, cancel(), the disabled prop, closeReason, placement and
// reposition. Without a `document` the overlay effect is a no-op, so the real machine runs
// unchanged; only the env members read outside that guard are stubbed.
import { describe, expect, it, vi } from "vitest"
import { dismissRequest } from "../../dom/dismiss"
import { createService } from "../../machine/service"
import {
  type PopoverCloseReason,
  type PopoverEvent,
  type PopoverProps,
  popoverIds,
  popoverMachine,
  popoverPositioning,
} from "./popover.machine"

function make(over: Partial<PopoverProps> = {}) {
  const reposition = vi.fn()
  const env = {
    dom: { getById: () => null },
    modality: { modality: () => "keyboard" },
    scheduler: { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} },
    position: { reposition, track: () => ({ stop() {}, reposition() {} }) },
  }
  const onOpenChange = vi.fn()
  let props: PopoverProps = { root: "r", onOpenChange, ...over }
  const s = createService(popoverMachine, props as never, env as never)
  s.start()
  return {
    s,
    onOpenChange,
    reposition,
    state: () => s.getSnapshot().state,
    open: () => (s.view().values as Record<string, unknown>)["open"],
    ctx: () => s.getSnapshot().context as PopoverContextShape,
    send: (e: PopoverEvent) => s.send(e as never),
    setProps: (p: Partial<PopoverProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}
type PopoverContextShape = {
  placement: { placed: boolean; side: string; align: string; anchorHidden: boolean }
  closeReason: PopoverCloseReason | null
}

const trigger = { type: "trigger", modality: "pointer" } as const
const closeTrigger = { type: "close-trigger", modality: "pointer" } as const
const dismissal = (
  type: "escape-key" | "outside-press" | "outside-focus" | "parent-dismissed",
): PopoverEvent => ({ type, request: dismissRequest(type, undefined, null) })
const placed = (side: "top" | "left", first = true) =>
  ({
    type: "POSITION.PLACED",
    side,
    align: "end",
    anchorHidden: true,
    first,
  }) as const

const CLOSERS: [PopoverCloseReason, PopoverEvent][] = [
  ["trigger", trigger],
  ["close-trigger", closeTrigger],
  ["escape-key", dismissal("escape-key")],
  ["outside-press", dismissal("outside-press")],
  ["outside-focus", dismissal("outside-focus")],
  ["parent-dismissed", dismissal("parent-dismissed")],
  ["api", { type: "api", close: true }],
]

describe("transitions", () => {
  it("starts closed; trigger opens with reason trigger, a second press closes with trigger", () => {
    const m = make()
    expect(m.state()).toBe("closed")
    m.send(trigger)
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(true)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("trigger")
    m.send(trigger)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls[1]?.[0]).toBe(false)
    expect(m.onOpenChange.mock.calls[1]?.[1].reason).toBe("trigger")
  })

  it("programmatic open reports reason open", () => {
    const m = make()
    m.send({ type: "open" })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("open")
  })

  it("defaultOpen starts open", () => {
    expect(make({ defaultOpen: true }).state()).toBe("open")
  })

  it.each(CLOSERS)("%s closes an open popover and is the reason", (reason, event) => {
    const m = make({ defaultOpen: true })
    m.send(event)
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe(reason)
    expect(m.ctx().closeReason).toBe(reason)
  })

  it("close events are ignored while closed", () => {
    const m = make()
    for (const [, e] of CLOSERS.slice(1)) m.send(e)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
    expect(m.ctx().closeReason).toBeNull()
  })

  it("open while open is ignored", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "open" })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("the close reason is cleared when it opens again", () => {
    const m = make()
    m.send(trigger)
    m.send(dismissal("outside-press"))
    expect(m.ctx().closeReason).toBe("outside-press")
    m.send(trigger)
    expect(m.ctx().closeReason).toBeNull()
  })

  it("open then close in one task ends closed and reports both", () => {
    const m = make()
    m.send({ type: "open" })
    m.send({ type: "api", close: true })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([
      [true, "open"],
      [false, "api"],
    ])
  })
})

describe("guards", () => {
  it("disabled: trigger and open do not open, onOpenChange is not called", () => {
    const m = make({ disabled: true })
    m.send(trigger)
    m.send({ type: "open" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("closeOnEscape false ignores escape-key", () => {
    const m = make({ defaultOpen: true, closeOnEscape: false })
    m.send(dismissal("escape-key"))
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("closeOnInteractOutside false ignores outside-press", () => {
    const m = make({ defaultOpen: true, closeOnInteractOutside: false })
    m.send(dismissal("outside-press"))
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("the other dismissals are not guarded by those options", () => {
    for (const type of ["outside-focus", "parent-dismissed"] as const) {
      const m = make({ defaultOpen: true, closeOnEscape: false, closeOnInteractOutside: false })
      m.send(dismissal(type))
      expect(m.state(), type).toBe("closed")
    }
  })

  it("an api event without close: true does nothing while enabled", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "api" })
    expect(m.state()).toBe("open")
  })
})

describe("disabled prop", () => {
  it("an open popover that becomes disabled closes with reason api", () => {
    const m = make({ defaultOpen: true })
    m.setProps({ disabled: true })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(false)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("api")
    expect(m.ctx().closeReason).toBe("api")
  })

  it("disabled going back to false does not close or open it", () => {
    const m = make({ defaultOpen: true, disabled: true })
    // started open and disabled: the prop returning to false must not close it
    m.setProps({ disabled: false })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
    const closed = make({ disabled: true })
    closed.setProps({ disabled: false })
    expect(closed.state()).toBe("closed")
    expect(closed.onOpenChange).not.toHaveBeenCalled()
  })
})

describe("controlled open", () => {
  it("a press is a proposal: a parent that keeps open={false} leaves it closed", () => {
    const m = make({ open: false })
    m.send(trigger)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(true)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe("trigger")
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
  })

  it.each(CLOSERS)("a refused %s close leaves it open and reports the reason once", (reason, e) => {
    const m = make({ open: true })
    m.send(e)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.onOpenChange.mock.calls[0]?.[1].reason).toBe(reason)
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
  })

  it("applying the proposal closes it, keeping the proposal's reason", () => {
    const m = make({ open: true })
    m.send(dismissal("outside-press"))
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
    expect(m.ctx().closeReason).toBe("outside-press")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("a parent-driven change moves the state without calling onOpenChange", () => {
    const m = make({ open: false })
    m.setProps({ open: true })
    expect(m.state()).toBe("open")
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("a parent-driven open clears the last reason", () => {
    const m = make({ open: true })
    m.send(dismissal("escape-key"))
    m.setProps({ open: false })
    expect(m.ctx().closeReason).toBe("escape-key")
    m.setProps({ open: true })
    expect(m.ctx().closeReason).toBeNull()
  })

  it("a refused proposal ends the cycle: the same press can be proposed again", () => {
    const m = make({ open: true })
    m.send(trigger)
    m.send(trigger)
    expect(m.onOpenChange).toHaveBeenCalledTimes(2)
    expect(m.state()).toBe("open")
  })

  it("the coordinator case: one request, one onOpenChange, state follows the prop only", () => {
    const m = make({ open: false })
    m.send({ type: "open" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    m.setProps({ open: true })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })
})

describe("cancel()", () => {
  it("cancelling a close keeps it open", () => {
    const onOpenChange = vi.fn((_o: boolean, d: { cancel(): void }) => d.cancel())
    const m = make({ defaultOpen: true, onOpenChange: onOpenChange as never })
    m.send(closeTrigger)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
    expect(m.ctx().closeReason).toBeNull()
  })

  it("cancelling an open keeps it closed", () => {
    const m = make({ onOpenChange: ((_o: boolean, d: { cancel(): void }) => d.cancel()) as never })
    m.send(trigger)
    expect(m.state()).toBe("closed")
  })
})

describe("placement", () => {
  it("starts unplaced on the requested side and align (popup preset: bottom, center)", () => {
    const m = make()
    expect(m.ctx().placement).toMatchObject({ placed: false, side: "bottom", align: "center" })
  })

  it("consumer positioning sets the initial side; inline sides resolve to physical ones", () => {
    expect(make({ positioning: { side: "top", align: "start" } }).ctx().placement).toMatchObject({
      placed: false,
      side: "top",
      align: "start",
    })
    expect(make({ positioning: { side: "inline-start" } }).ctx().placement.side).toBe("left")
    expect(make({ positioning: { side: "inline-end" } }).ctx().placement.side).toBe("right")
  })

  it("popoverPositioning: popup preset, sideOffset 8, consumer options override", () => {
    expect(popoverPositioning({})).toMatchObject({ side: "bottom", align: "center", sideOffset: 8 })
    expect(popoverPositioning({ positioning: { sideOffset: 2 } }).sideOffset).toBe(2)
  })

  it("POSITION.PLACED while open stores the placement", () => {
    const m = make({ defaultOpen: true })
    m.send(placed("top"))
    expect(m.ctx().placement).toEqual({
      placed: true,
      side: "top",
      align: "end",
      anchorHidden: true,
    })
    m.send(placed("left", false))
    expect(m.ctx().placement.side).toBe("left")
  })

  it("a placement while closed is ignored", () => {
    const m = make()
    m.send(placed("top"))
    expect(m.ctx().placement.placed).toBe(false)
  })

  it("opening again resets the placement to unplaced", () => {
    const m = make({ defaultOpen: true })
    m.send(placed("top"))
    m.send(trigger)
    m.send(trigger)
    expect(m.ctx().placement).toMatchObject({ placed: false, side: "bottom" })
  })
})

describe("reposition", () => {
  it("POSITION.REPOSITION asks the position capability for this positioner", () => {
    const m = make({ defaultOpen: true, root: "x" })
    m.send({ type: "POSITION.REPOSITION" })
    expect(m.reposition).toHaveBeenCalledTimes(1)
    expect(m.reposition).toHaveBeenCalledWith(popoverIds("x").positioner)
  })

  it("uses the composite's scope in the positioner id", () => {
    const m = make({ defaultOpen: true, root: "x", scope: "date-picker" })
    m.send({ type: "POSITION.REPOSITION" })
    expect(m.reposition).toHaveBeenCalledWith(popoverIds("x", "date-picker").positioner)
  })

  it("is ignored while closed", () => {
    const m = make()
    m.send({ type: "POSITION.REPOSITION" })
    expect(m.reposition).not.toHaveBeenCalled()
  })
})
