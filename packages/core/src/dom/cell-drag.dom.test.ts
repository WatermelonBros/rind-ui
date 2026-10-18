// cell-drag in jsdom and real browsers: pointer events dispatched at the cells' own positions
// (jsdom has no layout: the event's target stands in), a manual scheduler for the touch delay.
import { afterEach, describe, expect, it } from "vitest"
import type { TimerHandle } from "../env/capabilities"
import { type CellDragMessage, createCellDrag } from "./cell-drag"

let host: HTMLElement | null = null
afterEach(() => {
  host?.remove()
  host = null
})

function setup(canStart: (key: string) => boolean = () => true) {
  host = document.createElement("div")
  host.innerHTML = ["a", "b", "c"]
    .map((k) => `<span data-key="${k}" style="display:inline-block;width:40px;height:40px"></span>`)
    .join("")
  document.body.append(host)
  const timers = new Map<number, () => void>()
  let next = 1
  const log: CellDragMessage<string>[] = []
  const drag = createCellDrag<string>({
    env: {
      scheduler: {
        setTimeout: (cb: () => void) => {
          timers.set(next, cb)
          return next++ as unknown as TimerHandle
        },
        clearTimeout: (h: TimerHandle) => void timers.delete(h as unknown as number),
        requestAnimationFrame: () => 0 as unknown as TimerHandle,
        cancelAnimationFrame: () => {},
      },
      modality: { modality: () => "pointer", subscribe: () => () => {} } as never,
      platform: { mac: false, apple: false } as never,
    },
    keyAt: (el) => el?.closest?.("[data-key]")?.getAttribute("data-key") ?? null,
    canStart,
    delay: () => 200,
    send: (m) => void log.push(m),
  })
  const surface = host
  const cell = (k: string) => surface.querySelector(`[data-key="${k}"]`) as HTMLElement
  const centre = (k: string) => {
    const r = cell(k).getBoundingClientRect()
    // No layout (jsdom): distinct points per cell, the target standing in for hit testing.
    if (r.width === 0) return { clientX: "abc".indexOf(k) * 40 + 20, clientY: 20 }
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
  }
  const fire = (type: string, k: string, pointerType = "mouse", at = centre(k)) => {
    const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType, buttons: 1, ...at }
    const e = new PointerEvent(type, { ...init, buttons: type === "pointerup" ? 0 : 1 })
    if (type === "pointerdown") drag.pointerDown(surface, { ...pick(e), target: cell(k) })
    else cell(k).dispatchEvent(e)
  }
  const flush = () => {
    for (const [id, cb] of [...timers]) {
      timers.delete(id)
      cb()
    }
  }
  return { drag, surface, log, fire, flush, centre, types: () => log.map((m) => m.type) }
}

const pick = (e: PointerEvent) => ({
  pointerId: e.pointerId,
  pointerType: e.pointerType,
  button: 0,
  clientX: e.clientX,
  clientY: e.clientY,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
})

describe("cell-drag", () => {
  it("a mouse press starts at once; moves report new cells; the release the last one", () => {
    const t = setup()
    t.fire("pointerdown", "a")
    t.fire("pointermove", "b")
    t.fire("pointermove", "c")
    t.fire("pointerup", "c")
    expect(t.log).toEqual([
      { type: "start", key: "a", pointerType: "mouse" },
      { type: "move", key: "b" },
      { type: "move", key: "c" },
      { type: "end", key: "c", pointerType: "mouse" },
    ])
    expect(t.drag.consumes({ pointerType: "mouse" })).toBe(true)
    expect(t.drag.consumes({ pointerType: "virtual" })).toBe(false)
  })

  it("a move with no pointer movement is no drag (a layout shift)", () => {
    const t = setup()
    const at = t.centre("a")
    t.fire("pointerdown", "a")
    t.fire("pointermove", "b", "mouse", at)
    t.fire("pointerup", "b", "mouse", at)
    expect(t.log.at(-1)).toEqual({ type: "end", key: null, pointerType: "mouse" })
  })

  it("no drag where canStart refuses", () => {
    const t = setup((k) => k !== "a")
    t.fire("pointerdown", "a")
    t.fire("pointerup", "a")
    expect(t.log).toEqual([])
    expect(t.drag.consumes({ pointerType: "mouse" })).toBe(false)
  })

  it("a touch drags only after the delay; a tap before it stays a press", () => {
    const t = setup()
    t.fire("pointerdown", "a", "touch")
    expect(t.log).toEqual([])
    t.fire("pointerup", "a", "touch")
    t.flush()
    expect(t.log).toEqual([])
    expect(t.drag.consumes({ pointerType: "touch" })).toBe(false)
    t.fire("pointerdown", "a", "touch")
    t.flush()
    expect(t.types()).toEqual(["start"])
    t.fire("pointermove", "b", "touch")
    t.fire("pointerup", "b", "touch")
    expect(t.types()).toEqual(["start", "move", "end"])
  })

  it("a touch that moves before the delay is a scroll: no drag", () => {
    const t = setup()
    const a = t.centre("a")
    t.fire("pointerdown", "a", "touch", a)
    t.fire("pointermove", "a", "touch", { clientX: a.clientX, clientY: a.clientY + 30 })
    t.flush()
    expect(t.log).toEqual([])
  })

  it("a pointercancel while dragging cancels", () => {
    const t = setup()
    t.fire("pointerdown", "a")
    t.fire("pointercancel", "a")
    expect(t.types()).toEqual(["start", "cancel"])
  })

  it("touchmove is prevented only while dragging (no scroll)", () => {
    const t = setup()
    const detach = t.drag.attach(t.surface)
    const move = () => {
      const e = new Event("touchmove", { bubbles: true, cancelable: true })
      t.surface.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(move()).toBe(false)
    t.fire("pointerdown", "a", "touch")
    expect(move()).toBe(false)
    t.flush()
    expect(move()).toBe(true)
    t.fire("pointerup", "a", "touch")
    expect(move()).toBe(false)
    detach()
  })
})
