// The Hover Card machine in Node: every transition with a scheduler on vi fake timers.
// Without a `document` the `shown` effect (layer, hover zone, positioning) is a no-op, so the
// real machine runs unchanged; the zone events it would emit (`HOVER.START/END` with
// `zone: true`) are sent by hand.

import {
  createService,
  type HoverCardCloseReason,
  type HoverCardEvent,
  type HoverCardProps,
  hoverCardMachine,
  type Modality,
} from "@rind-ui/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

type Ctx = {
  keyboardFocused: boolean
  pointerInZone: boolean
  focusInside: boolean
  closeReason: HoverCardCloseReason | null
  leaving: "pointer-leave" | "blur"
}

function make(over: Partial<HoverCardProps> = {}) {
  const env = {
    dom: { getById: () => null },
    modality: { modality: () => "keyboard" },
    scheduler: {
      // fake-time: the fake scheduler under test (vi.useFakeTimers)
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as never),
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
    },
  }
  const onOpenChange = vi.fn()
  let props: HoverCardProps = { root: "h", onOpenChange, ...over }
  const s = createService(hoverCardMachine, props as never, env as never)
  s.start()
  return {
    s,
    onOpenChange,
    state: () => s.getSnapshot().state as string,
    open: () => (s.view().values as Record<string, unknown>)["open"],
    ctx: () => s.getSnapshot().context as Ctx,
    send: (e: HoverCardEvent) => s.send(e as never),
    setProps: (p: Partial<HoverCardProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    changes: () => onOpenChange.mock.calls.map((c) => [c[0], c[1].reason]),
  }
}

const hover: HoverCardEvent = { type: "HOVER.START" }
const unhover: HoverCardEvent = { type: "HOVER.END" }
const zoneEnter: HoverCardEvent = { type: "HOVER.START", zone: true }
const zoneLeave: HoverCardEvent = { type: "HOVER.END", zone: true }
const blur: HoverCardEvent = { type: "BLUR" }
const within = {
  enter: { type: "FOCUS_WITHIN.ENTER" },
  leave: { type: "FOCUS_WITHIN.LEAVE" },
} as const
const focus = (modality: Modality = "keyboard", cause: string = "key"): HoverCardEvent =>
  ({ type: "FOCUS", modality, cause }) as never

function openByHover(over: Partial<HoverCardProps> = {}) {
  const m = make(over)
  m.send(hover)
  m.advance(over.openDelay ?? 700)
  return m
}

describe("closed → opening → open", () => {
  it("starts closed", () => {
    const m = make()
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
  })

  it("HOVER.START waits openDelay (700) then opens with reason hover", () => {
    const m = make()
    m.send(hover)
    expect(m.state()).toBe("opening")
    expect(m.ctx().pointerInZone).toBe(true)
    m.advance(699)
    expect(m.state()).toBe("opening")
    expect(m.onOpenChange).not.toHaveBeenCalled()
    m.advance(1)
    expect(m.state()).toBe("open")
    expect(m.changes()).toEqual([[true, "hover"]])
  })

  it("honours a custom openDelay", () => {
    const m = make({ openDelay: 100 })
    m.send(hover)
    m.advance(99)
    expect(m.state()).toBe("opening")
    m.advance(1)
    expect(m.state()).toBe("open")
  })

  it("a zone HOVER.START does not start a hover from closed", () => {
    const m = make()
    m.send(zoneEnter)
    m.advance(5000)
    expect(m.state()).toBe("closed")
  })

  it("HOVER.END from closed clears pointerInZone", () => {
    const m = make()
    m.send(unhover)
    expect(m.state()).toBe("closed")
    expect(m.ctx().pointerInZone).toBe(false)
  })

  it.each([
    ["key", "key"],
    ["navigation", "navigation"],
  ] as const)("keyboard FOCUS (%s) opens opening, then open with reason focus", (_n, cause) => {
    const m = make()
    m.send(focus("keyboard", cause))
    expect(m.state()).toBe("opening")
    expect(m.ctx().keyboardFocused).toBe(true)
    m.advance(700)
    expect(m.state()).toBe("open")
    expect(m.changes()).toEqual([[true, "focus"]])
  })

  it.each([
    ["restore (layer)", "keyboard", "layer"],
    ["window", "keyboard", "window"],
    ["other", "keyboard", "other"],
    ["pointer", "pointer", "pointer"],
    ["pointer modality, key cause", "pointer", "key"],
    ["touch", "touch", "pointer"],
    ["virtual", "virtual", "other"],
    ["virtual, key cause", "virtual", "key"],
  ] as const)("FOCUS from %s does not open it", (_n, modality, cause) => {
    const m = make()
    m.send(focus(modality, cause))
    expect(m.state()).toBe("closed")
    expect(m.ctx().keyboardFocused).toBe(false)
    m.advance(5000)
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("hover then keyboard focus before the delay opens with reason focus", () => {
    const m = make()
    m.send(hover)
    m.send(focus())
    m.advance(700)
    expect(m.changes()).toEqual([[true, "focus"]])
  })

  it("non-keyboard FOCUS while opening clears keyboardFocused and keeps reason hover", () => {
    const m = make()
    m.send(focus())
    m.send(hover)
    m.send(focus("pointer", "pointer"))
    expect(m.ctx().keyboardFocused).toBe(false)
    m.advance(700)
    expect(m.changes()).toEqual([[true, "hover"]])
  })
})

describe("opening → closed", () => {
  it("trigger HOVER.END cancels the open", () => {
    const m = make()
    m.send(hover)
    m.advance(300)
    m.send(unhover)
    expect(m.state()).toBe("closed")
    expect(m.ctx().pointerInZone).toBe(false)
    m.advance(5000)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("zone HOVER.END is ignored while opening", () => {
    const m = make()
    m.send(hover)
    m.send(zoneLeave)
    expect(m.state()).toBe("opening")
  })

  it("BLUR with the pointer away cancels the open", () => {
    const m = make()
    m.send(focus())
    m.send(blur)
    expect(m.state()).toBe("closed")
    expect(m.ctx().keyboardFocused).toBe(false)
    m.advance(5000)
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("BLUR with the pointer in the zone keeps waiting", () => {
    const m = make()
    m.send(hover)
    m.send(focus())
    m.send(blur)
    expect(m.state()).toBe("opening")
    m.advance(700)
    expect(m.changes()).toEqual([[true, "hover"]])
  })

  it("CLOSE while opening closes without a report but sets closeReason api", () => {
    const m = make()
    m.send(hover)
    m.send({ type: "CLOSE" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("OPEN while opening opens with reason api", () => {
    const m = make()
    m.send(hover)
    m.send({ type: "OPEN" })
    expect(m.changes()).toEqual([[true, "api"]])
  })

  it("becoming disabled while opening cancels it silently", () => {
    const m = make()
    m.send(hover)
    m.setProps({ disabled: true })
    expect(m.state()).toBe("closed")
    m.advance(5000)
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("FOCUS_WITHIN.LEAVE while opening only clears focusInside", () => {
    const m = make()
    m.send(hover)
    m.send(within.enter)
    expect(m.ctx().focusInside).toBe(true)
    m.send(within.leave)
    expect(m.ctx().focusInside).toBe(false)
    expect(m.state()).toBe("opening")
  })
})

describe("open → closing → closed", () => {
  it("zone leave closes after closeDelay (300) with reason pointer-leave", () => {
    const m = openByHover()
    m.send(zoneLeave)
    expect(m.state()).toBe("closing")
    expect(m.open()).toBe(true)
    expect(m.ctx().pointerInZone).toBe(false)
    expect(m.ctx().leaving).toBe("pointer-leave")
    m.advance(299)
    expect(m.state()).toBe("closing")
    m.advance(1)
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([
      [true, "hover"],
      [false, "pointer-leave"],
    ])
  })

  it("honours a custom closeDelay", () => {
    const m = openByHover({ closeDelay: 50 })
    m.send(zoneLeave)
    m.advance(49)
    expect(m.state()).toBe("closing")
    m.advance(1)
    expect(m.state()).toBe("closed")
  })

  it("a trigger HOVER.END does not close an open card", () => {
    const m = openByHover()
    m.send(unhover)
    m.advance(5000)
    expect(m.state()).toBe("open")
  })

  it("HOVER.START while open marks the pointer in the zone", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(zoneEnter)
    expect(m.ctx().pointerInZone).toBe(true)
  })

  it("zone leave is held by keyboard focus", () => {
    const m = make()
    m.send(focus())
    m.advance(700)
    m.send(zoneLeave)
    expect(m.state()).toBe("open")
    m.advance(5000)
    expect(m.state()).toBe("open")
  })

  it("zone leave is held by focus inside the content", () => {
    const m = openByHover()
    m.send(within.enter)
    m.send(zoneLeave)
    expect(m.state()).toBe("open")
    expect(m.ctx().pointerInZone).toBe(false)
  })

  // The trigger's own keyboard focus is what a blur ends: it never holds the card open.
  it("BLUR with the pointer away starts closing, reported as blur after the delay", () => {
    const m = make()
    m.send(focus())
    m.advance(700)
    m.send(blur)
    expect(m.state()).toBe("closing")
    expect(m.ctx().leaving).toBe("blur")
    m.advance(300)
    expect(m.changes()).toEqual([
      [true, "focus"],
      [false, "blur"],
    ])
  })

  it("BLUR with the pointer in the zone keeps it open", () => {
    const m = make()
    m.send(focus())
    m.send(zoneEnter)
    m.advance(700)
    m.send(blur)
    expect(m.state()).toBe("open")
    expect(m.ctx().keyboardFocused).toBe(false)
  })

  it("BLUR is held by focus inside the content", () => {
    const m = make()
    m.send(focus())
    m.advance(700)
    m.send(within.enter)
    m.send(blur)
    expect(m.state()).toBe("open")
  })

  it("FOCUS_WITHIN.LEAVE with nothing else holding it starts closing with reason blur", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(zoneEnter)
    m.send(within.enter)
    m.send(unhover)
    m.send(zoneLeave) // held by focusInside
    expect(m.state()).toBe("open")
    m.send(within.leave)
    expect(m.state()).toBe("closing")
    m.advance(300)
    expect(m.changes().at(-1)).toEqual([false, "blur"])
  })

  it("FOCUS_WITHIN.LEAVE is held by the pointer in the zone", () => {
    const m = openByHover()
    m.send(within.enter)
    m.send(within.leave)
    expect(m.state()).toBe("open")
    expect(m.ctx().focusInside).toBe(false)
  })

  it("FOCUS_WITHIN.LEAVE is held by keyboard focus", () => {
    const m = make()
    m.send(focus())
    m.advance(700)
    m.send(within.enter)
    m.send(within.leave)
    expect(m.state()).toBe("open")
  })

  it("no timer closes an open card on its own", () => {
    const m = openByHover()
    m.advance(60_000)
    expect(m.state()).toBe("open")
  })
})

describe("closing → open", () => {
  it("HOVER.START reopens without a report", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.advance(250)
    m.send(zoneEnter)
    expect(m.state()).toBe("open")
    m.advance(5000)
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("FOCUS_WITHIN.ENTER reopens", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(within.enter)
    expect(m.state()).toBe("open")
    expect(m.ctx().focusInside).toBe(true)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("keyboard FOCUS reopens", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(focus())
    expect(m.state()).toBe("open")
    expect(m.ctx().keyboardFocused).toBe(true)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("non-keyboard FOCUS does not reopen", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(focus("pointer", "pointer"))
    expect(m.state()).toBe("closing")
  })

  it("BLUR and FOCUS_WITHIN.LEAVE while closing keep closing", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(blur)
    m.send(within.leave)
    expect(m.state()).toBe("closing")
  })

  it("the close reason follows what started it: pointer-leave even if blur came later", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(blur)
    m.advance(300)
    expect(m.changes().at(-1)).toEqual([false, "pointer-leave"])
  })
})

describe("dismissals and api", () => {
  const closers: [HoverCardCloseReason, HoverCardEvent][] = [
    ["escape-key", { type: "ESCAPE_KEY" }],
    ["outside-press", { type: "OUTSIDE_PRESS" }],
    ["outside-focus", { type: "OUTSIDE_FOCUS" }],
    ["parent-dismissed", { type: "PARENT_DISMISSED" }],
    ["api", { type: "CLOSE" }],
  ]

  it.each(closers)("%s closes from open, reports it and sets closeReason", (reason, event) => {
    const m = openByHover()
    m.send(event)
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([
      [true, "hover"],
      [false, reason],
    ])
    // Cleared on leaving `closed` only; it stays readable after the close.
    expect(m.ctx().closeReason).toBe(reason)
  })

  it.each(closers)("%s closes from closing too", (reason, event) => {
    const m = openByHover()
    m.send(zoneLeave)
    m.send(event)
    expect(m.state()).toBe("closed")
    expect(m.changes().at(-1)).toEqual([false, reason])
    expect(m.ctx().closeReason).toBe(reason)
  })

  it("closeReason is cleared when it leaves closed again", () => {
    const m = openByHover()
    m.send({ type: "ESCAPE_KEY" })
    m.send(unhover)
    m.send(hover)
    expect(m.ctx().closeReason).toBeNull()
  })

  it("dismissals are ignored while closed", () => {
    const m = make()
    for (const [, e] of closers) m.send(e)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("OPEN opens with reason api and stays open without timers", () => {
    const m = make()
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("open")
    expect(m.changes()).toEqual([[true, "api"]])
    m.advance(60_000)
    expect(m.state()).toBe("open")
  })

  it("OPEN while open does nothing", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "OPEN" })
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })
})

describe("disabled", () => {
  it("a disabled card never opens by hover, focus or OPEN", () => {
    const m = make({ disabled: true })
    m.send(hover)
    expect(m.state()).toBe("closed")
    m.send(focus())
    expect(m.state()).toBe("closed")
    m.send({ type: "OPEN" })
    m.advance(5000)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("a disabled card still tracks keyboard focus", () => {
    const m = make({ disabled: true })
    m.send(focus())
    expect(m.ctx().keyboardFocused).toBe(true)
  })

  it("becoming disabled while open closes with reason disabled", () => {
    const m = openByHover()
    m.setProps({ disabled: true })
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([
      [true, "hover"],
      [false, "disabled"],
    ])
    m.send(hover)
    m.advance(5000)
    expect(m.state()).toBe("closed")
  })

  it("becoming disabled while closing closes with reason disabled", () => {
    const m = openByHover()
    m.send(zoneLeave)
    m.setProps({ disabled: true })
    expect(m.changes().at(-1)).toEqual([false, "disabled"])
  })

  it("becoming enabled does not close an open card, nor open a closed one", () => {
    const o = openByHover()
    o.setProps({ disabled: false })
    expect(o.state()).toBe("open")
    const c = make({ disabled: true })
    c.setProps({ disabled: false })
    expect(c.state()).toBe("closed")
    c.send(hover)
    c.advance(700)
    expect(c.state()).toBe("open")
  })
})

describe("controlled open", () => {
  it("a hover proposal with open={false} reports hover and stays closed", () => {
    const m = make({ open: false })
    m.send(hover)
    m.advance(700)
    expect(m.changes()).toEqual([[true, "hover"]])
    expect(m.open()).toBe(false)
  })

  it("a refused close stays open and reports the reason", () => {
    const m = make({ open: true })
    m.send({ type: "ESCAPE_KEY" })
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

  it("cancel() in onOpenChange keeps it closed", () => {
    const m = make({
      onOpenChange: ((_o: boolean, d: { cancel(): void }) => d.cancel()) as never,
    })
    m.send(focus())
    m.advance(700)
    expect(m.open()).toBe(false)
  })
})
