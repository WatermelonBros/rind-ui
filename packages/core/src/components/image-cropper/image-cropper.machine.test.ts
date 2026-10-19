// Image Cropper's rules in Node: the default crop on load, nudges (move, resize, pan when
// fixed), zoom steps, drags, rotation raising zoom to cover, one announcement per burst.
import { describe, expect, it } from "vitest"
import type { Announcement, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import { covers } from "./geometry"
import {
  cropPlacementOf,
  type ImageCropperProps,
  imageCropperMachine,
} from "./image-cropper.machine"
import { imageCropperMessages } from "./image-cropper.messages"

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

function make(over: Partial<ImageCropperProps> = {}) {
  const log: Announcement[] = []
  const t = manualClock()
  let props: ImageCropperProps = { id: "c", messages: imageCropperMessages, ...over }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    scheduler: t.scheduler,
  }
  const s = createService(imageCropperMachine, props, env)
  s.start()
  s.send({ type: "IMAGE.LOADED", width: 400, height: 200 })
  s.send({ type: "VIEWPORT.MEASURED", width: 400, height: 200 })
  const set = (next: Partial<ImageCropperProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  const values = () => s.view(props as never).values
  const crop = () => values().crop
  const placement = () => cropPlacementOf(values(), s.getSnapshot().context)
  return { s, set, crop, values, placement, log, advance: t.advance }
}

describe("image-cropper machine", () => {
  it("loads with the default crop, 80 % of the image, covered", () => {
    const m = make({ aspectRatio: 1 })
    expect(m.crop()).toMatchObject({ width: 160, height: 160, x: 120, y: 20 })
    expect(covers(m.placement(), m.crop())).toBe(true)
  })

  it("arrows move, Alt+arrows resize the end edges", () => {
    const m = make()
    const before = m.crop()
    m.s.send({ type: "KEY.NUDGE", dx: 10, dy: 0, resize: false })
    expect(m.crop().x).toBe(before.x + 10)
    m.s.send({ type: "KEY.NUDGE", dx: -10, dy: 0, resize: true })
    expect(m.crop().width).toBe(before.width - 10)
    expect(m.crop().x).toBe(before.x + 10)
  })

  it("fixed crop area: arrows pan the image, the crop stays", () => {
    const m = make({ fixedCropArea: true, defaultZoom: 2 })
    const crop = m.crop()
    const offset = m.placement().offset
    m.s.send({ type: "KEY.NUDGE", dx: 10, dy: 0, resize: false })
    expect(m.crop()).toEqual(crop)
    expect(m.placement().offset.x).toBe(offset.x - 10)
  })

  it("rotation raises zoom until the image covers the crop", () => {
    // Controlled from creation (controlled vs uncontrolled is fixed at mount, as in React).
    const m = make({ rotation: 0 })
    m.set({ rotation: 30 })
    expect(m.values().zoom).toBeGreaterThan(1)
    expect(covers(m.placement(), m.crop())).toBe(true)
  })

  it("zoom steps stay in [minZoom, maxZoom]", () => {
    const m = make({ zoomStep: 1, maxZoom: 2 })
    m.s.send({ type: "ZOOM.STEP", direction: 1 })
    m.s.send({ type: "ZOOM.STEP", direction: 1 })
    expect(m.values().zoom).toBe(2)
    m.s.send({ type: "ZOOM.STEP", direction: -1 })
    m.s.send({ type: "ZOOM.STEP", direction: -1 })
    expect(m.values().zoom).toBe(1)
  })

  it("drag the selection, a handle, the image", () => {
    const m = make({ defaultZoom: 2 })
    const c = m.crop()
    m.s.send({ type: "DRAG.START", target: "selection", x: 0, y: 0 })
    m.s.send({ type: "DRAG.MOVE", x: 5, y: 5, lockRatio: false })
    m.s.send({ type: "DRAG.END" })
    expect(m.crop().x).toBe(c.x + 5)
    m.s.send({ type: "DRAG.START", target: "w", x: 0, y: 0 })
    m.s.send({ type: "DRAG.MOVE", x: 20, y: 0, lockRatio: false })
    m.s.send({ type: "DRAG.END" })
    expect(m.crop().width).toBe(c.width - 20)
    const offset = m.placement().offset
    m.s.send({ type: "DRAG.START", target: "image", x: 0, y: 0 })
    m.s.send({ type: "DRAG.MOVE", x: 30, y: 0, lockRatio: false })
    expect(m.placement().offset.x).toBe(offset.x + 30)
  })

  it("a burst of keys announces once, 500 ms after the last", () => {
    const m = make()
    for (let i = 0; i < 5; i++) {
      m.s.send({ type: "KEY.NUDGE", dx: 1, dy: 0, resize: false })
      m.advance(100)
    }
    expect(m.log).toHaveLength(0)
    m.advance(500)
    expect(m.log.map((a) => a.message)).toEqual([
      `${m.crop().width} by ${m.crop().height} pixels, ${m.crop().x} from the left, ${m.crop().y} from the top`,
    ])
  })
})
