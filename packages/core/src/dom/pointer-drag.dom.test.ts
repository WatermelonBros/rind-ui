import { afterEach, describe, expect, it } from "vitest"
import { type DragMessage, pointerDragSession, pointerFraction, startDrag } from "./pointer-drag"

const surfaces: HTMLElement[] = []
afterEach(() => {
  for (const s of surfaces.splice(0)) s.remove()
})

/** A surface whose box is `width` × 20 at x = 100 (stubbed, so jsdom has layout too). */
function surface(width = 300) {
  const el = document.createElement("div")
  document.body.append(el)
  surfaces.push(el)
  el.getBoundingClientRect = () =>
    ({
      left: 100,
      right: 100 + width,
      top: 0,
      bottom: 20,
      width,
      height: 20,
      x: 100,
      y: 0,
    }) as DOMRect
  return el
}

const pointer = (type: string, init: PointerEventInit) =>
  new PointerEvent(type, { bubbles: true, pointerId: 1, buttons: 1, ...init })

describe("pointer-drag", () => {
  it("maps RTL from the right edge", () => {
    const s = surface()
    // 30 px from the right edge of a 300 px surface.
    expect(
      pointerFraction(s, { clientX: 370, clientY: 10 }, { axis: "horizontal", dir: "rtl" }),
    ).toBeCloseTo(0.1)
    expect(
      pointerFraction(s, { clientX: 130, clientY: 10 }, { axis: "horizontal", dir: "ltr" }),
    ).toBeCloseTo(0.1)
  })

  it("maps a vertical axis from the bottom", () => {
    const s = surface()
    expect(
      pointerFraction(s, { clientX: 0, clientY: 15 }, { axis: "vertical", dir: "rtl" }),
    ).toBeCloseTo(0.25)
  })

  it("reports no fraction for a zero-size surface", () => {
    const s = surface(0)
    expect(
      pointerFraction(s, { clientX: 100, clientY: 0 }, { axis: "horizontal", dir: "ltr" }),
    ).toBeNull()
  })

  it("keeps the grab offset of a thumb press", () => {
    const s = surface()
    const session = pointerDragSession()
    // Pressed 6 px right of a thumb centred at 50 %.
    const f = session.press(
      s,
      { clientX: 256, clientY: 10, pointerId: 1 },
      { axis: "horizontal", dir: "ltr", anchor: 0.5 },
    )
    expect(f).toBe(0.5)
    const got: DragMessage[] = []
    const stop = session.track((m) => got.push(m))
    document.dispatchEvent(pointer("pointermove", { clientX: 286 }))
    expect(got).toEqual([{ type: "move", fraction: 0.6 }])
    stop()
  })

  it("tracks moves on the document without pointer capture (jsdom)", () => {
    const s = surface()
    const got: DragMessage[] = []
    const stop = startDrag(s, { pointerId: 1 }, { axis: "horizontal", dir: "ltr" }, (m) =>
      got.push(m),
    )
    document.dispatchEvent(pointer("pointermove", { clientX: 250 }))
    document.dispatchEvent(pointer("pointerup", { clientX: 250, buttons: 0 }))
    expect(got).toEqual([{ type: "move", fraction: 0.5 }, { type: "up" }])
    stop()
  })

  it("ignores a second pointer", () => {
    const s = surface()
    const got: DragMessage[] = []
    const stop = startDrag(s, { pointerId: 1 }, { axis: "horizontal", dir: "ltr" }, (m) =>
      got.push(m),
    )
    document.dispatchEvent(pointer("pointermove", { clientX: 250, pointerId: 2 }))
    document.dispatchEvent(pointer("pointerup", { pointerId: 2, buttons: 0 }))
    expect(got).toEqual([])
    stop()
  })

  it("removes its listeners after a release (BU#3311)", () => {
    const s = surface()
    const got: DragMessage[] = []
    startDrag(s, { pointerId: 1 }, { axis: "horizontal", dir: "ltr" }, (m) => got.push(m))
    document.dispatchEvent(pointer("pointerup", { buttons: 0 }))
    document.dispatchEvent(pointer("pointermove", { clientX: 250 }))
    document.dispatchEvent(pointer("pointerdown", {}))
    document.dispatchEvent(pointer("pointerup", { buttons: 0 }))
    expect(got).toEqual([{ type: "up" }])
  })

  it("cancels when capture is lost before a pointerup (BU#1910)", () => {
    const s = surface()
    const got: DragMessage[] = []
    startDrag(s, { pointerId: 1 }, { axis: "horizontal", dir: "ltr" }, (m) => got.push(m))
    s.dispatchEvent(pointer("lostpointercapture", {}))
    expect(got).toEqual([{ type: "cancel" }])
  })

  it("cancels on pointercancel, and a move with no buttons is a release", () => {
    const s = surface()
    const a: DragMessage[] = []
    startDrag(s, { pointerId: 1 }, { axis: "horizontal", dir: "ltr" }, (m) => a.push(m))
    document.dispatchEvent(pointer("pointercancel", {}))
    expect(a).toEqual([{ type: "cancel" }])
    const b: DragMessage[] = []
    startDrag(s, { pointerId: 1 }, { axis: "horizontal", dir: "ltr" }, (m) => b.push(m))
    document.dispatchEvent(pointer("pointermove", { clientX: 200, buttons: 0 }))
    expect(b).toEqual([{ type: "up" }])
  })

  it("a step-wise drag sends one start, two moves and one release", () => {
    const s = surface()
    const session = pointerDragSession()
    const got: DragMessage[] = []
    expect(
      session.press(
        s,
        { clientX: 130, clientY: 10, pointerId: 1 },
        { axis: "horizontal", dir: "ltr" },
      ),
    ).toBeCloseTo(0.1)
    session.track((m) => got.push(m))
    expect(session.active).toBe(true)
    document.dispatchEvent(pointer("pointermove", { clientX: 160 }))
    document.dispatchEvent(pointer("pointermove", { clientX: 190 }))
    document.dispatchEvent(pointer("pointerup", { buttons: 0 }))
    expect(got.map((m) => m.type)).toEqual(["move", "move", "up"])
    expect(session.active).toBe(false)
  })
})
