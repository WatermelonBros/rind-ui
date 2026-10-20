// Image Viewer's rules in Node on a manual clock: zoom limits on every path (keys, factor,
// pinch, controlled), the pan clamp, zoom about the anchor, the toggle, one announcement per
// keyboard burst and none for pointer gestures.
import { describe, expect, it } from "vitest"
import type { Announcement, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import { type ImageViewerProps, imageViewerMachine } from "./image-viewer.machine"
import { imageViewerMessages } from "./image-viewer.messages"

function make(over: Partial<ImageViewerProps> = {}) {
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
  const said: string[] = []
  let props: ImageViewerProps = { id: "v", messages: imageViewerMessages, ...over }
  const s = createService(imageViewerMachine, props, {
    scheduler,
    announcer: {
      announce: (a: Announcement) => {
        said.push(a.message)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
  })
  s.start()
  // A 400 × 200 image in a 400 × 200 viewport: the image fills it at zoom 1.
  s.send({ type: "IMAGE.LOADED", width: 800, height: 400 })
  s.send({ type: "VIEWPORT.MEASURED", width: 400, height: 200 })
  const set = (next: Partial<ImageViewerProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  const view = () => s.view()
  return {
    s,
    advance,
    said,
    set,
    zoom: () => view().values.zoom,
    offset: () => view().context.offset,
  }
}

describe("image viewer machine", () => {
  it("keys and buttons step the zoom within the limits", () => {
    const v = make()
    for (let i = 0; i < 10; i++) v.s.send({ type: "ZOOM.STEP", direction: 1, source: "key" })
    expect(v.zoom()).toBe(4)
    for (let i = 0; i < 10; i++) v.s.send({ type: "ZOOM.STEP", direction: -1, source: "button" })
    expect(v.zoom()).toBe(1)
  })

  it("a pinch never passes a limit (yet-another-react-lightbox #380)", () => {
    const v = make()
    v.s.send({ type: "PINCH.START", distance: 100 })
    v.s.send({ type: "PINCH.MOVE", distance: 10, center: { x: 200, y: 100 } })
    expect(v.zoom()).toBe(1)
    v.s.send({ type: "PINCH.MOVE", distance: 1000, center: { x: 200, y: 100 } })
    expect(v.zoom()).toBe(4)
  })

  it("zooms about the anchor and clamps the pan to the image", () => {
    const v = make()
    // At the top-left corner, zoom 2: the corner stays put, so the image shifts right / down.
    v.s.send({ type: "ZOOM.BY", factor: 2, at: { x: 0, y: 0 } })
    expect(v.zoom()).toBe(2)
    expect(v.offset()).toEqual({ x: 200, y: 100 })
    // Dragging further right is stopped at the edge.
    v.s.send({ type: "DRAG.START", x: 0, y: 0 })
    v.s.send({ type: "DRAG.MOVE", x: 500, y: 0 })
    expect(v.offset().x).toBe(200)
  })

  it("at fit there is nothing to pan; a drag does not start", () => {
    const v = make()
    v.s.send({ type: "DRAG.START", x: 0, y: 0 })
    expect(v.s.view().state).toBe("idle")
    v.s.send({ type: "PAN.KEY", dx: 40, dy: 0 })
    expect(v.offset()).toEqual({ x: 0, y: 0 })
  })

  it("arrows move the view with the key", () => {
    const v = make({ defaultZoom: 2 })
    v.s.send({ type: "PAN.KEY", dx: 40, dy: 0 })
    expect(v.offset().x).toBe(-40)
  })

  it("double click toggles fit ↔ doubleClickZoom", () => {
    const v = make()
    v.s.send({ type: "TOGGLE", at: { x: 200, y: 100 } })
    expect(v.zoom()).toBe(2)
    v.s.send({ type: "TOGGLE", at: { x: 200, y: 100 } })
    expect(v.zoom()).toBe(1)
  })

  it("one announcement per keyboard burst; none for pointer gestures", () => {
    const v = make()
    v.s.send({ type: "ZOOM.STEP", direction: 1, source: "key" })
    v.advance(100)
    v.s.send({ type: "ZOOM.STEP", direction: 1, source: "key" })
    v.advance(500)
    expect(v.said).toEqual(["Zoom 200%"])
    v.s.send({ type: "ZOOM.BY", factor: 1.5, at: { x: 0, y: 0 } })
    v.s.send({ type: "ZOOM.STEP", direction: 1, source: "pointer" })
    v.advance(1000)
    expect(v.said).toEqual(["Zoom 200%"])
  })

  it("controlled zoom is clamped and keeps the pan in bounds", () => {
    const changes: number[] = []
    const v = make({ zoom: 3, onZoomChange: (z) => changes.push(z) })
    v.s.send({ type: "ZOOM.STEP", direction: 1, source: "key" })
    expect(changes.at(-1)).toBe(3.5)
    expect(v.zoom()).toBe(3)
    v.set({ zoom: 1 })
    expect(v.offset()).toEqual({ x: 0, y: 0 })
  })
})
