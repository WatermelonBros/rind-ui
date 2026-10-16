// The Tooltip machine in Node (openspec add-tooltip): every transition with fake hover
// intent, delay group, positioning and a scheduler on vi fake timers. Without a `document`
// the `shown` effect (layer, hover tracking, positioning) is a no-op, so the real machine
// runs unchanged; the zone events it would emit (`HOVER.START/END` with `zone: true`) are
// sent by hand, and the DOM wiring is covered by the jsdom and browser suites.

import {
  createService,
  type Modality,
  type TooltipCloseReason,
  type TooltipEvent,
  type TooltipProps,
  tooltipIds,
  tooltipMachine,
  tooltipPositioning,
} from "@rind-ui/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeDelayGroup, fakeHoverIntent } from "../delay-group"
import { fakePositioning } from "../positioning"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function make(over: Partial<TooltipProps> = {}, group = fakeDelayGroup()) {
  const hoverIntent = fakeHoverIntent()
  const position = fakePositioning()
  const env = {
    dom: { getById: () => null },
    modality: { modality: () => "keyboard" },
    scheduler: {
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as never),
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
    },
    position,
    hoverIntent,
    delayGroup: group,
  }
  const onOpenChange = vi.fn()
  let props: TooltipProps = { root: "t", onOpenChange, ...over }
  const s = createService(tooltipMachine, props as never, env as never)
  s.start()
  const m = {
    s,
    group,
    hoverIntent,
    position,
    onOpenChange,
    state: () => s.getSnapshot().state as string,
    open: () => (s.view().values as Record<string, unknown>)["open"],
    ctx: () => s.getSnapshot().context as TooltipCtx,
    send: (e: TooltipEvent) => s.send(e as never),
    setProps: (p: Partial<TooltipProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    /** The (open, reason) pairs reported so far. */
    changes: () => onOpenChange.mock.calls.map((c) => [c[0], c[1].reason]),
  }
  return m
}
type TooltipCtx = {
  keyboardFocused: boolean
  pointerInZone: boolean
  suppressHover: boolean
  instant: boolean
  placement: { placed: boolean; side: string; align: string; anchorHidden: boolean }
}

const hover: TooltipEvent = { type: "HOVER.START" }
const unhover: TooltipEvent = { type: "HOVER.END" }
const zoneEnter: TooltipEvent = { type: "HOVER.START", zone: true }
const zoneLeave: TooltipEvent = { type: "HOVER.END", zone: true }
const focus = (
  modality: Modality = "keyboard",
  cause: "key" | "navigation" | "layer" | "window" | "pointer" | "other" = "key",
): TooltipEvent => ({
  type: "FOCUS",
  modality,
  cause,
})
const blur: TooltipEvent = { type: "BLUR" }
const press: TooltipEvent = { type: "PRESS.START", pointer: true }
const placed = (side: "top" | "bottom", first = true): TooltipEvent => ({
  type: "POSITION.PLACED",
  side,
  align: "end",
  anchorHidden: true,
  first,
})

/** Opens by hover and the delay. */
function openByHover(over: Partial<TooltipProps> = {}, group = fakeDelayGroup()) {
  const m = make(over, group)
  m.send(hover)
  m.advance(over.openDelay ?? 700)
  return m
}

describe("opening by hover", () => {
  it("starts closed and holds nothing: no tracking, no positioning", () => {
    const m = make()
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
    expect(m.hoverIntent.tracked).toHaveLength(0)
    expect(m.position.requests).toHaveLength(0)
    expect(m.group.members.has("t")).toBe(true)
  })

  it("HOVER.START waits the open delay (700 ms) and opens with reason hover, not instant", () => {
    const m = make()
    m.send(hover)
    expect(m.state()).toBe("opening")
    expect(m.open()).toBe(false)
    m.advance(699)
    expect(m.state()).toBe("opening")
    expect(m.onOpenChange).not.toHaveBeenCalled()
    m.advance(1)
    expect(m.state()).toBe("open")
    expect(m.changes()).toEqual([[true, "hover"]])
    expect(m.ctx().instant).toBe(false)
    expect(m.ctx().pointerInZone).toBe(true)
  })

  it("honours a custom openDelay, and 0 opens in the next tick of the scheduler", () => {
    const m = make({ openDelay: 100 })
    m.send(hover)
    m.advance(99)
    expect(m.state()).toBe("opening")
    m.advance(1)
    expect(m.state()).toBe("open")
    const z = make({ openDelay: 0 })
    z.send(hover)
    z.advance(0)
    expect(z.state()).toBe("open")
  })

  it("leaving before the delay never opens it, now or later", () => {
    const m = make()
    m.send(hover)
    m.advance(300)
    m.send(unhover)
    expect(m.state()).toBe("closed")
    m.advance(5000)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
    expect(m.ctx().pointerInZone).toBe(false)
  })

  it("a second HOVER.START while waiting does not open early", () => {
    const m = make()
    m.send(hover)
    m.advance(100)
    m.send(hover)
    m.advance(599)
    expect(m.state()).toBe("opening")
    m.advance(1)
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("a warm group opens at once, reason hover, instant", () => {
    const g = fakeDelayGroup()
    g.setWarm(true)
    const m = make({}, g)
    m.send(hover)
    expect(m.state()).toBe("open")
    expect(m.changes()).toEqual([[true, "hover"]])
    expect(m.ctx().instant).toBe(true)
  })

  it("a cold group after a warm one is not instant", () => {
    const g = fakeDelayGroup()
    g.setWarm(true)
    const m = make({}, g)
    m.send(hover)
    m.send(press) // closes
    m.send(unhover)
    g.setWarm(false)
    m.send(hover)
    expect(m.state()).toBe("opening")
    expect(m.ctx().instant).toBe(false)
  })

  it("registers the open instance with the group on entering open", () => {
    const m = openByHover()
    expect(m.group.open).toBe("t")
  })

  it("zone events do not start a hover from closed", () => {
    const m = make()
    m.send(zoneEnter)
    expect(m.state()).toBe("closed")
    m.advance(1000)
    expect(m.state()).toBe("closed")
  })

  it("a touch pointer never sends HOVER.START (the fake and the real trigger props agree)", () => {
    const m = make()
    const sent: TooltipEvent[] = []
    const props = m.hoverIntent.triggerProps((e) => sent.push(e))
    props.onPointerMove({ pointerType: "touch", currentTarget: null })
    props.onPointerMove({ pointerType: "mouse", currentTarget: null })
    expect(sent).toEqual([{ type: "HOVER.START" }])
  })

  it("pressing during the delay cancels it and suppresses hover until the pointer leaves", () => {
    const m = make()
    m.send(hover)
    m.send(press)
    expect(m.state()).toBe("closed")
    expect(m.ctx().suppressHover).toBe(true)
    m.advance(2000)
    expect(m.state()).toBe("closed")
    m.send(hover)
    expect(m.state()).toBe("closed")
    m.send(unhover)
    expect(m.ctx().suppressHover).toBe(false)
    m.send(hover)
    expect(m.state()).toBe("opening")
  })

  it("api CLOSE while opening goes back to closed without a change report", () => {
    const m = make()
    m.send(hover)
    m.send({ type: "CLOSE" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("api OPEN while opening opens with reason api", () => {
    const m = make()
    m.send(hover)
    m.send({ type: "OPEN" })
    expect(m.changes()).toEqual([[true, "api"]])
  })
})

describe("opening by keyboard focus", () => {
  it.each([
    ["Tab (key)", "keyboard", "key"],
    ["a key-driven move (navigation)", "keyboard", "navigation"],
  ] as const)("%s opens at once with reason focus, not instant", (_n, modality, cause) => {
    const m = make()
    m.send(focus(modality, cause))
    expect(m.state()).toBe("open")
    expect(m.changes()).toEqual([[true, "focus"]])
    expect(m.ctx().keyboardFocused).toBe(true)
    expect(m.ctx().instant).toBe(false)
  })

  it.each([
    ["a layer's initial focus or restore", "keyboard", "layer"],
    ["the window regaining focus", "keyboard", "window"],
    ["programmatic focus", "keyboard", "programmatic"],
    ["other", "keyboard", "other"],
    ["a pointer press", "pointer", "pointer"],
    ["pointer modality with a key cause", "pointer", "key"],
    ["touch", "touch", "pointer"],
    ["touch with a key cause", "touch", "key"],
    ["a screen reader cursor", "virtual", "other"],
    ["virtual with a key cause", "virtual", "key"],
  ] as const)("%s does not open it", (_n, modality, cause) => {
    const m = make()
    m.send({ type: "FOCUS", modality, cause } as never)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
    expect(m.ctx().keyboardFocused).toBe(false)
  })

  it("keyboard focus while opening opens at once", () => {
    const m = make()
    m.send(hover)
    m.send(focus())
    expect(m.changes()).toEqual([[true, "focus"]])
  })

  it("non-keyboard focus while opening keeps waiting for the delay", () => {
    const m = make()
    m.send(hover)
    m.send(focus("pointer", "pointer"))
    expect(m.state()).toBe("opening")
    m.advance(700)
    expect(m.changes()).toEqual([[true, "hover"]])
  })

  it("focus while hovering after the delay does not report another change, and tracks the modality", () => {
    const m = openByHover()
    m.send(focus("pointer", "pointer"))
    expect(m.ctx().keyboardFocused).toBe(false)
    m.send(focus())
    expect(m.ctx().keyboardFocused).toBe(true)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("a layer-caused focus after keyboard focus clears keyboardFocused", () => {
    const m = make()
    m.send(focus())
    m.send(focus("keyboard", "layer"))
    expect(m.ctx().keyboardFocused).toBe(false)
  })
})

describe("closing", () => {
  it("leaving the zone closes after closeDelay (300 ms) with reason pointer-leave", () => {
    const m = openByHover()
    m.send(zoneLeave)
    expect(m.state()).toBe("closing")
    expect(m.open()).toBe(true)
    m.advance(299)
    expect(m.state()).toBe("closing")
    m.advance(1)
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([
      [true, "hover"],
      [false, "pointer-leave"],
    ])
  })

  it("a custom closeDelay, and 0 closes on the next tick", () => {
    const m = openByHover({ closeDelay: 50 })
    m.send(zoneLeave)
    m.advance(49)
    expect(m.state()).toBe("closing")
    m.advance(1)
    expect(m.state()).toBe("closed")
    const z = openByHover({ closeDelay: 0 })
    z.send(zoneLeave)
    z.advance(0)
    expect(z.state()).toBe("closed")
  })

  it("returning within the close delay never closes and reports nothing", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.advance(250)
    m.send(zoneEnter)
    expect(m.state()).toBe("open")
    m.advance(5000)
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("a trigger HOVER.END (pointerleave) does not close an open tooltip: the zone decides", () => {
    const m = openByHover()
    m.send(unhover)
    expect(m.state()).toBe("open")
    m.advance(5000)
    expect(m.state()).toBe("open")
  })

  it("no timer hides an open tooltip on its own", () => {
    const m = openByHover()
    m.advance(60_000)
    expect(m.state()).toBe("open")
  })

  it("keyboardFocused keeps it open when the pointer leaves the zone", () => {
    const m = make()
    m.send(focus())
    m.send(zoneEnter)
    m.send(zoneLeave)
    expect(m.state()).toBe("open")
    m.advance(5000)
    expect(m.state()).toBe("open")
    expect(m.ctx().pointerInZone).toBe(false)
  })

  it("blur afterwards closes it at once (pointer no longer in the zone)", () => {
    const m = make()
    m.send(focus())
    m.send(zoneEnter)
    m.send(zoneLeave)
    m.send(blur)
    expect(m.state()).toBe("closed")
    expect(m.changes().at(-1)).toEqual([false, "blur"])
  })

  it("Escape closes with escape-key, from open and from closing, not instant", () => {
    const a = openByHover()
    a.send({ type: "ESCAPE" })
    expect(a.state()).toBe("closed")
    expect(a.changes().at(-1)).toEqual([false, "escape-key"])
    expect(a.ctx().instant).toBe(false)
    const b = openByHover()
    b.send(zoneLeave)
    b.send({ type: "ESCAPE" })
    expect(b.changes().at(-1)).toEqual([false, "escape-key"])
  })

  it("an outside press closes with outside-press, from open and from closing", () => {
    const a = openByHover()
    a.send({ type: "OUTSIDE_PRESS" })
    expect(a.changes().at(-1)).toEqual([false, "outside-press"])
    const b = openByHover()
    b.send(zoneLeave)
    b.send({ type: "OUTSIDE_PRESS" })
    expect(b.changes().at(-1)).toEqual([false, "outside-press"])
  })

  it("api CLOSE closes with reason api, from open and from closing", () => {
    const a = openByHover()
    a.send({ type: "CLOSE" })
    expect(a.changes().at(-1)).toEqual([false, "api"])
    const b = openByHover()
    b.send(zoneLeave)
    b.send({ type: "CLOSE" })
    expect(b.changes().at(-1)).toEqual([false, "api"])
  })

  it("Escape, outside press, blur, group and CLOSE are ignored while closed", () => {
    const m = make()
    for (const e of [
      { type: "ESCAPE" },
      { type: "OUTSIDE_PRESS" },
      blur,
      { type: "GROUP" },
      { type: "CLOSE" },
      zoneLeave,
    ] satisfies TooltipEvent[])
      m.send(e)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("every closer reports its reason exactly once", () => {
    const closers: [TooltipCloseReason, (m: ReturnType<typeof make>) => void][] = [
      ["escape-key", (m) => m.send({ type: "ESCAPE" })],
      ["outside-press", (m) => m.send({ type: "OUTSIDE_PRESS" })],
      ["trigger-press", (m) => m.send(press)],
      ["group", (m) => m.send({ type: "GROUP" })],
      ["api", (m) => m.send({ type: "CLOSE" })],
      [
        "pointer-leave",
        (m) => {
          m.send(zoneLeave)
          m.advance(300)
        },
      ],
      ["disabled", (m) => m.setProps({ disabled: true })],
    ]
    for (const [reason, close] of closers) {
      const m = openByHover()
      close(m)
      expect(m.state(), reason).toBe("closed")
      expect(m.changes(), reason).toEqual([
        [true, "hover"],
        [false, reason],
      ])
    }
  })
})

describe("press on the trigger", () => {
  it("closes with trigger-press and stays closed while the pointer stays", () => {
    const m = openByHover()
    m.send(press)
    expect(m.changes().at(-1)).toEqual([false, "trigger-press"])
    expect(m.ctx().suppressHover).toBe(true)
    // pointermove over the trigger does not send HOVER.START again; even if it did:
    m.send(hover)
    m.advance(5000)
    expect(m.state()).toBe("closed")
  })

  it("re-entering after the pointer left opens again (suppress cleared by HOVER.END)", () => {
    const m = openByHover()
    m.send(press)
    m.send(unhover)
    expect(m.ctx().suppressHover).toBe(false)
    m.send(hover)
    m.advance(700)
    expect(m.state()).toBe("open")
  })

  it("keyboard focus again reopens even while hover is suppressed", () => {
    const m = openByHover()
    m.send(press)
    m.send(focus())
    expect(m.state()).toBe("open")
    expect(m.changes().at(-1)).toEqual([true, "focus"])
  })

  it("closes from closing too", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(press)
    expect(m.changes().at(-1)).toEqual([false, "trigger-press"])
  })

  it("closeOnPress false: the press does nothing and the tooltip stays open", () => {
    const m = openByHover({ closeOnPress: false })
    m.send(press)
    expect(m.state()).toBe("open")
    expect(m.ctx().suppressHover).toBe(false)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    m.send(zoneLeave)
    m.send(press)
    expect(m.state()).toBe("closing")
  })

  it("pressing while closed suppresses hover until the pointer leaves", () => {
    const m = make()
    m.send(press)
    expect(m.ctx().suppressHover).toBe(true)
    m.send(hover)
    expect(m.state()).toBe("closed")
    m.send(unhover)
    m.send(hover)
    expect(m.state()).toBe("opening")
  })
})

describe("BLUR rules", () => {
  it("blur closes at once with reason blur when the pointer is not in the zone", () => {
    const m = make()
    m.send(focus())
    m.send(blur)
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([
      [true, "focus"],
      [false, "blur"],
    ])
    expect(m.ctx().keyboardFocused).toBe(false)
  })

  it("blur keeps it open while the pointer is in the hover zone", () => {
    const m = make()
    m.send(focus())
    m.send(zoneEnter)
    m.send(blur)
    expect(m.state()).toBe("open")
    expect(m.ctx().keyboardFocused).toBe(false)
    // and now that focus is gone, leaving the zone closes after the delay
    m.send(zoneLeave)
    expect(m.state()).toBe("closing")
    m.advance(300)
    expect(m.changes().at(-1)).toEqual([false, "pointer-leave"])
  })

  it("blur while closing closes at once with blur", () => {
    const m = make()
    m.send(focus())
    m.send(zoneEnter)
    m.send(blur) // pointer in the zone: stays
    m.send(zoneLeave)
    m.send(focus()) // focus again, keyboard
    m.send(blur)
    expect(m.state()).toBe("closed")
    expect(m.changes().at(-1)).toEqual([false, "blur"])
  })

  it("blur while closed or opening only clears keyboardFocused", () => {
    const m = make()
    m.send(blur)
    expect(m.state()).toBe("closed")
    m.send(hover)
    m.send(blur)
    expect(m.state()).toBe("opening")
  })

  it("hover opened, then focus, then pointer leaves: stays open until blur", () => {
    const m = openByHover()
    m.send(focus())
    m.send(zoneLeave)
    expect(m.state()).toBe("open")
    m.send(blur)
    expect(m.changes().at(-1)).toEqual([false, "blur"])
  })

  it("focus during closing with keyboard intent reopens it without a report", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(focus())
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    m.advance(5000)
    expect(m.state()).toBe("open")
  })

  it("non-keyboard focus during closing does not reopen it", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(focus("pointer", "pointer"))
    expect(m.state()).toBe("closing")
  })

  it("hover during closing reopens it without a report", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(hover)
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })
})

describe("delay group", () => {
  it("a replace request closes an open tooltip with reason group, instantly", () => {
    const g = fakeDelayGroup()
    const a = openByHover({ root: "a" }, g)
    const b = make({ root: "b" }, g)
    b.send(focus())
    expect(a.state()).toBe("closed")
    expect(a.changes()).toEqual([
      [true, "hover"],
      [false, "group"],
    ])
    expect(a.ctx().instant).toBe(true)
    expect(b.state()).toBe("open")
    expect(g.open).toBe("b")
  })

  it("replaces a closing member too, and both are never open together", () => {
    const g = fakeDelayGroup()
    const a = openByHover({ root: "a" }, g)
    a.send(zoneLeave)
    const b = make({ root: "b" }, g)
    g.setWarm(true)
    b.send(hover)
    expect(b.ctx().instant).toBe(true)
    expect(a.state()).toBe("closed")
    expect(a.changes().at(-1)).toEqual([false, "group"])
  })

  it("GROUP is ignored while closed or opening", () => {
    const m = make()
    m.send({ type: "GROUP" })
    m.send(hover)
    m.send({ type: "GROUP" })
    expect(m.state()).toBe("opening")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("the next open is not instant when the group is cold (instant is reset on a normal open)", () => {
    const g = fakeDelayGroup()
    const a = openByHover({ root: "a" }, g)
    const b = make({ root: "b" }, g)
    b.send(focus())
    expect(a.ctx().instant).toBe(true)
    b.send({ type: "ESCAPE" })
    g.setWarm(false)
    a.send(unhover)
    a.send(hover)
    a.advance(700)
    expect(a.state()).toBe("open")
    expect(a.ctx().instant).toBe(false)
  })

  it("closing reports the skipDelay to the group (default 300, custom, 0)", () => {
    for (const [skipDelay, expected] of [
      [undefined, 300],
      [120, 120],
      [0, 0],
    ] as const) {
      const g = fakeDelayGroup()
      const spy = vi.spyOn(g, "closed")
      const m = openByHover(skipDelay === undefined ? {} : { skipDelay }, g)
      m.send({ type: "ESCAPE" })
      expect(spy).toHaveBeenLastCalledWith("t", expected)
    }
  })

  it("stopping the service leaves the group with the skipDelay", () => {
    const g = fakeDelayGroup()
    const m = openByHover({ skipDelay: 150 }, g)
    m.s.stop()
    expect(g.members.has("t")).toBe(false)
    expect(g.open).toBeNull()
  })

  it("membership is held from the start, closed or not", () => {
    const g = fakeDelayGroup()
    make({ root: "x" }, g)
    make({ root: "y" }, g)
    expect([...g.members.keys()]).toEqual(["x", "y"])
  })
})

describe("disabled", () => {
  it("a disabled tooltip never opens: hover, focus, api", () => {
    const m = make({ disabled: true })
    m.send(hover)
    expect(m.state()).toBe("closed")
    m.send(focus())
    expect(m.state()).toBe("closed")
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("closed")
    m.advance(5000)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("becoming disabled while open closes with reason disabled and does not reopen", () => {
    const m = openByHover()
    m.setProps({ disabled: true })
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([
      [true, "hover"],
      [false, "disabled"],
    ])
    m.send(hover)
    m.send(focus())
    m.send(zoneEnter)
    m.advance(5000)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).toHaveBeenCalledTimes(2)
  })

  it("becoming disabled while closing closes with reason disabled", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.setProps({ disabled: true })
    expect(m.changes().at(-1)).toEqual([false, "disabled"])
  })

  it("becoming disabled while waiting for the delay cancels it", () => {
    const m = make()
    m.send(hover)
    m.setProps({ disabled: true })
    expect(m.state()).toBe("closed")
    m.advance(5000)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("becoming enabled again does not open it, and hover works afterwards", () => {
    const m = make({ disabled: true })
    m.setProps({ disabled: false })
    expect(m.state()).toBe("closed")
    m.send(hover)
    m.advance(700)
    expect(m.state()).toBe("open")
  })

  it("disabled going to false while open does not close it", () => {
    const m = openByHover()
    m.setProps({ disabled: false })
    expect(m.state()).toBe("open")
  })

  it("a disabled tooltip still tracks keyboard focus so it knows about it when enabled", () => {
    const m = make({ disabled: true })
    m.send(focus())
    expect(m.ctx().keyboardFocused).toBe(true)
  })
})

describe("controlled open", () => {
  it("a hover proposal with open={false} reports hover and stays closed", () => {
    const m = make({ open: false, openDelay: 0 })
    m.send(hover)
    m.advance(0)
    expect(m.changes()).toEqual([[true, "hover"]])
    expect(m.open()).toBe(false)
  })

  it("a focus proposal reports focus and stays closed until the parent applies it", () => {
    const m = make({ open: false })
    m.send(focus())
    expect(m.changes()).toEqual([[true, "focus"]])
    expect(m.open()).toBe(false)
    m.setProps({ open: true })
    expect(m.open()).toBe(true)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("a refused close keeps it open and reports the reason once", () => {
    const m = make({ open: true })
    m.send({ type: "ESCAPE" })
    expect(m.changes()).toEqual([[false, "escape-key"]])
    expect(m.open()).toBe(true)
  })

  it("applying the proposal closes it", () => {
    const m = make({ open: true })
    m.send({ type: "OUTSIDE_PRESS" })
    m.setProps({ open: false })
    expect(m.open()).toBe(false)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("a parent-driven change moves the state without onOpenChange", () => {
    const m = make({ open: false })
    m.setProps({ open: true })
    expect(m.open()).toBe(true)
    m.setProps({ open: false })
    expect(m.open()).toBe(false)
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("defaultOpen starts open and registers with the group", () => {
    const m = make({ defaultOpen: true })
    expect(m.state()).toBe("open")
    expect(m.group.open).toBe("t")
  })

  it("controlled closed: the group is not told it opened by a mere proposal", () => {
    const m = make({ open: false })
    m.send(focus())
    expect(m.group.open).toBeNull()
  })
})

describe("cancel()", () => {
  it("cancelling an open keeps it closed", () => {
    const m = make({
      onOpenChange: ((_o: boolean, d: { cancel(): void }) => d.cancel()) as never,
    })
    m.send(focus())
    expect(m.state()).toBe("closed")
    expect(m.group.open).toBeNull()
  })

  it("cancelling a close keeps it open", () => {
    const m = make({
      defaultOpen: true,
      onOpenChange: ((_o: boolean, d: { cancel(): void }) => d.cancel()) as never,
    })
    m.send({ type: "ESCAPE" })
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
  })

  it("cancelling the delayed open keeps it closed", () => {
    const m = make({
      onOpenChange: ((_o: boolean, d: { cancel(): void }) => d.cancel()) as never,
    })
    m.send(hover)
    m.advance(700)
    expect(m.open()).toBe(false)
  })
})

describe("placement", () => {
  it("starts unplaced on top, centred (the tooltip preset)", () => {
    expect(make().ctx().placement).toMatchObject({ placed: false, side: "top" })
  })

  it("tooltipPositioning: popup preset, side top, sideOffset 8, consumer options override", () => {
    expect(tooltipPositioning({})).toMatchObject({ side: "top", sideOffset: 8 })
    expect(tooltipPositioning({ positioning: { sideOffset: 2, side: "bottom" } })).toMatchObject({
      sideOffset: 2,
      side: "bottom",
    })
  })

  it("collision padding is 8 by default", () => {
    expect(tooltipPositioning({}).collisionPadding).toBe(8)
  })

  it("inline sides resolve to physical ones in the initial placement", () => {
    expect(make({ positioning: { side: "inline-start" } }).ctx().placement.side).toBe("left")
    expect(make({ positioning: { side: "inline-end" } }).ctx().placement.side).toBe("right")
  })

  it("POSITION.PLACED stores the placement while open or closing", () => {
    const m = openByHover()
    m.send(placed("bottom"))
    expect(m.ctx().placement).toEqual({
      placed: true,
      side: "bottom",
      align: "end",
      anchorHidden: true,
    })
    m.send(zoneLeave)
    m.send(placed("top", false))
    expect(m.ctx().placement.side).toBe("top")
  })

  it("a placement while closed is ignored; reopening resets it to unplaced", () => {
    const m = make()
    m.send(placed("bottom"))
    expect(m.ctx().placement.placed).toBe(false)
    const o = openByHover()
    o.send(placed("bottom"))
    o.send(press)
    o.send(unhover)
    o.send(hover)
    o.advance(700)
    expect(o.ctx().placement).toMatchObject({ placed: false, side: "top" })
  })
})

describe("api events", () => {
  it("OPEN opens with reason api, not instant; CLOSE closes with api", () => {
    const m = make()
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("open")
    expect(m.changes()).toEqual([[true, "api"]])
    expect(m.ctx().instant).toBe(false)
    m.send({ type: "CLOSE" })
    expect(m.changes()).toEqual([
      [true, "api"],
      [false, "api"],
    ])
  })

  it("OPEN while open and CLOSE while closed do nothing", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "OPEN" })
    expect(m.onOpenChange).not.toHaveBeenCalled()
    const c = make()
    c.send({ type: "CLOSE" })
    expect(c.onOpenChange).not.toHaveBeenCalled()
  })

  it("an API-opened tooltip with the pointer away stays open until closed (no timer)", () => {
    const m = make()
    m.send({ type: "OPEN" })
    m.advance(60_000)
    expect(m.state()).toBe("open")
  })
})

describe("ids", () => {
  it("part ids derive from the root and are distinct", () => {
    const ids = tooltipIds("t")
    expect(new Set(Object.values(ids)).size).toBe(4)
    for (const id of Object.values(ids)) expect(id).toContain("t")
  })
})

describe("review fixes (add-tooltip r1)", () => {
  it("closing → open keeps the placement: a brief exit and return is never back to placing", () => {
    const m = openByHover()
    m.send(placed("top"))
    expect(m.ctx().placement.placed).toBe(true)
    m.send(zoneLeave)
    expect(m.state()).toBe("closing")
    m.send(zoneEnter)
    expect(m.state()).toBe("open")
    expect(m.ctx().placement.placed).toBe(true)
  })

  it("a new open from closed starts unplaced again", () => {
    const m = openByHover()
    m.send(placed("top"))
    m.send({ type: "ESCAPE" })
    m.send(unhover)
    m.send(hover)
    m.advance(700)
    expect(m.state()).toBe("open")
    expect(m.ctx().placement.placed).toBe(false)
  })

  it("a tap or a key press closes without suppressing the next mouse hover", () => {
    const m = openByHover()
    m.send({ type: "PRESS.START" })
    expect(m.state()).toBe("closed")
    expect(m.ctx().suppressHover).toBe(false)
    m.send(hover)
    m.advance(700)
    expect(m.state()).toBe("open")
  })

  it("a mouse press suppresses hover until the pointer leaves the trigger", () => {
    const m = openByHover()
    m.send(press)
    expect(m.ctx().suppressHover).toBe(true)
    m.send(hover)
    m.advance(700)
    expect(m.state()).toBe("closed")
    m.send(unhover)
    m.send(hover)
    m.advance(700)
    expect(m.state()).toBe("open")
  })
})
