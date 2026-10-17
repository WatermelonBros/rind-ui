// swipe-gesture scenarios (add-drawer task 1.4) through the DOM adapter's drag input, in
// jsdom and real browsers. Time is a manual clock advanced by the drag itself, so every
// reported velocity is deterministic.
import { domEnvironment, type SwipeDirection, type SwipeRelease, trackSwipe } from "@rind-ui/core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { domEnv } from "./index"

const inJsdom = navigator.userAgent.includes("jsdom")

interface Setup {
  readonly el: HTMLElement
  readonly starts: string[]
  readonly ends: SwipeRelease[]
  readonly cancels: number[]
  readonly stop: () => void
  readonly drag: (
    vector: { x: number; y: number },
    o?: {
      pointerType?: "mouse" | "touch"
      durationMs?: number
      steps?: number
      /** The pressed element, by its exact text or label (default: the swiped one's text). */
      on?: { text: string } | { label: string }
    },
  ) => Promise<void>
}

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
  document.body.innerHTML = ""
})

function setup(
  html: string,
  directions: readonly SwipeDirection[] = ["down"],
  extra: { alwaysFrom?: () => readonly Element[] } = {},
): Setup {
  document.body.innerHTML = html
  const el = document.querySelector<HTMLElement>("[data-swiped]")
  if (!el) throw new Error("no [data-swiped]")
  let t = 0
  const env = { ...domEnvironment(), clock: { now: () => t } }
  const starts: string[] = []
  const ends: SwipeRelease[] = []
  const cancels: number[] = []
  const tracker = trackSwipe(env, {
    element: () => el,
    directions: () => directions,
    prefix: "test",
    ...extra,
    onStart: (e) => starts.push(e.modality),
    onEnd: (e) => ends.push(e),
    onCancel: () => cancels.push(t),
  })
  cleanups.push(() => tracker.stop())
  const adapter = domEnv({ advanceClock: (ms) => (t += ms) }).create({
    scope: "test",
    anchor: { text: "unused" },
    modality: "pointer",
  })
  return {
    el,
    starts,
    ends,
    cancels,
    stop: () => tracker.stop(),
    drag: (vector, o = {}) =>
      adapter.find(o.on ?? { text: el.textContent?.trim() ?? "" }).drag(vector, {
        pointerType: o.pointerType ?? "mouse",
        durationMs: o.durationMs ?? 200,
        steps: o.steps ?? 10,
      }),
  }
}

const SHEET = `<div data-swiped style="position:fixed;left:0;right:0;bottom:0;height:300px">Sheet</div>`

describe("swipe gesture", () => {
  it("one start and one release for a 60-move drag; movement only as variables (base-ui#4863)", async () => {
    const s = setup(SHEET)
    await s.drag({ x: 0, y: 120 }, { steps: 60, durationMs: 600 })
    expect(s.starts).toEqual(["pointer"])
    expect(s.ends).toHaveLength(1)
    expect(s.ends[0]?.direction).toBe("down")
  })

  it("other inline custom properties survive a drag (zag#3148)", async () => {
    const s = setup(SHEET)
    s.el.style.setProperty("--layer-index", "3")
    await s.drag({ x: 0, y: 120 })
    expect(s.el.style.getPropertyValue("--layer-index")).toBe("3")
  })

  it("a tap is not a swipe (base-ui#4294)", async () => {
    const s = setup(SHEET)
    await s.drag({ x: 0, y: 3 }, { pointerType: "touch" })
    expect(s.starts).toEqual([])
    expect(s.ends).toEqual([])
  })

  it("touch on a button swipes (reka-ui#2907); mouse on a button does not", async () => {
    const s = setup(
      `<div data-swiped style="position:fixed;inset:auto 0 0 0;height:300px"><button type="button">Act</button></div>`,
    )
    await s.drag({ x: 0, y: 120 }, { pointerType: "touch", on: { text: "Act" } })
    expect(s.starts).toEqual(["touch"])
    await s.drag({ x: 0, y: 120 }, { pointerType: "mouse", on: { text: "Act" } })
    expect(s.starts).toEqual(["touch"])
  })

  it("a text input and [data-rind-no-swipe] never start; the handle always does", async () => {
    document.body.innerHTML = ""
    const s = setup(
      `<div data-swiped style="position:fixed;inset:auto 0 0 0;height:300px">
        <input aria-label="Name" value="x" />
        <div data-rind-no-swipe><span data-handle>Grip</span><p>Body</p></div>
      </div>`,
      ["down"],
      { alwaysFrom: () => [document.querySelector("[data-handle]") as Element] },
    )
    await s.drag({ x: 0, y: 120 }, { pointerType: "touch", on: { label: "Name" } })
    await s.drag({ x: 0, y: 120 }, { pointerType: "touch", on: { text: "Body" } })
    expect(s.starts).toEqual([])
    await s.drag({ x: 0, y: 120 }, { pointerType: "touch", on: { text: "Grip" } })
    expect(s.starts).toEqual(["touch"])
  })

  it("a press outside the element's DOM (a portalled popup) is ignored (base-ui#4380)", async () => {
    const s = setup(`${SHEET}<div id="popup">Popup</div>`)
    await s.drag({ x: 0, y: 120 }, { pointerType: "touch", on: { text: "Popup" } })
    expect(s.starts).toEqual([])
  })

  it("inside a shadow root (base-ui#5359)", async () => {
    document.body.innerHTML = `<div id="host"></div>`
    const host = document.getElementById("host") as HTMLElement
    const root = host.attachShadow({ mode: "open" })
    root.innerHTML = `<div style="position:fixed;inset:auto 0 0 0;height:300px"><span>Inner</span></div>`
    const el = root.firstElementChild as HTMLElement
    let t = 0
    const starts: string[] = []
    const tracker = trackSwipe(
      { ...domEnvironment(), clock: { now: () => t } },
      {
        element: () => el,
        directions: () => ["down"],
        prefix: "test",
        onStart: (e) => starts.push(e.modality),
        onEnd: () => {},
        onCancel: () => {},
      },
    )
    cleanups.push(() => tracker.stop())
    const inner = root.querySelector("span") as HTMLElement
    // A touch from inside the shadow tree.
    const fire = (type: string, y: number, touching = true) => {
      const e = new Event(type, { bubbles: true, cancelable: true, composed: true })
      const p = { identifier: 1, target: inner, clientX: 10, clientY: y }
      Object.defineProperties(e, {
        touches: { value: touching ? [p] : [] },
        changedTouches: { value: [p] },
      })
      inner.dispatchEvent(e)
    }
    fire("touchstart", 0)
    for (let y = 10; y <= 120; y += 10) {
      t += 16
      fire("touchmove", y)
    }
    fire("touchend", 120, false)
    expect(starts).toEqual(["touch"])
  })

  it("damping: pulling a bottom sheet up moves it less than the pointer", async () => {
    const s = setup(SHEET)
    let seen = ""
    const onFrame = () => (seen = s.el.style.getPropertyValue("--rind-test-swipe-y"))
    const observer = new MutationObserver(onFrame)
    observer.observe(s.el, { attributes: true, attributeFilter: ["style"] })
    await s.drag({ x: 0, y: -100 }, { steps: 10, durationMs: 200 })
    observer.disconnect()
    const y = Number.parseFloat(seen)
    expect(y).toBeLessThan(0)
    expect(Math.abs(y)).toBeLessThan(100)
    // Released against the allowed direction: no direction.
    expect(s.ends[0]?.direction).toBe(null)
  })

  it("a mostly horizontal flick on a bottom sheet reports no direction (base-ui#5471)", async () => {
    const s = setup(SHEET)
    await s.drag({ x: 120, y: 30 }, { pointerType: "touch" })
    expect(s.ends.every((e) => e.direction === null)).toBe(true)
  })

  it("the same flick at 60 Hz and 120 Hz gives the same velocity (base-ui#5837)", async () => {
    const a = setup(SHEET)
    await a.drag({ x: 0, y: 200 }, { durationMs: 200, steps: 12 })
    const b = setup(SHEET)
    await b.drag({ x: 0, y: 200 }, { durationMs: 200, steps: 24 })
    const va = a.ends[0]?.velocity ?? 0
    const vb = b.ends.at(-1)?.velocity ?? 0
    expect(va).toBeGreaterThan(0.9)
    expect(Math.abs(va - vb) / va).toBeLessThan(0.1)
  })

  it("change of mind: 150 px toward the edge and 40 back reports no direction", async () => {
    const s = setup(SHEET)
    // Out and back in one gesture: two drags would be two gestures, so dispatch it here.
    const fire = (type: string, y: number, buttons: number) =>
      s.el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: y,
          pointerId: 3,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons,
        }),
      )
    fire("pointerdown", 0, 1)
    for (let y = 10; y <= 150; y += 10) fire("pointermove", y, 1)
    for (let y = 140; y >= 110; y -= 10) fire("pointermove", y, 1)
    fire("pointerup", 110, 0)
    expect(s.ends[0]?.direction).toBe(null)
  })

  it("pointercancel mid-drag reports a cancel, never a release (vaul#555)", async () => {
    const s = setup(SHEET)
    const fire = (type: string, y: number, buttons: number) =>
      s.el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: y,
          pointerId: 4,
          pointerType: "pen",
          isPrimary: true,
          button: 0,
          buttons,
        }),
      )
    fire("pointerdown", 0, 1)
    for (let y = 10; y <= 80; y += 10) fire("pointermove", y, 1)
    fire("pointercancel", 80, 0)
    expect(s.cancels).toHaveLength(1)
    expect(s.ends).toEqual([])
    expect(s.el.style.getPropertyValue("--rind-test-swipe-y")).toBe("")
  })

  it("no document listener while idle", async () => {
    const spy = vi.spyOn(document, "addEventListener")
    setup(SHEET)
    const types = spy.mock.calls.map((c) => String(c[0]))
    spy.mockRestore()
    expect(types.filter((t) => /pointer|touch/.test(t))).toEqual([])
  })

  it.skipIf(inJsdom)(
    "scroll comes first: a scrolled list scrolls, at its top the sheet follows",
    async () => {
      const s = setup(
        `<div data-swiped style="position:fixed;inset:auto 0 0 0;height:300px">
        <div id="list" role="region" aria-label="Rows list" style="height:200px;overflow:auto"><div style="height:1000px">Rows</div></div>
      </div>`,
      )
      const list = document.getElementById("list") as HTMLElement
      list.scrollTop = 300
      await s.drag({ x: 0, y: 80 }, { pointerType: "touch", on: { label: "Rows list" } })
      expect(s.starts).toEqual([])
      list.scrollTop = 0
      await s.drag({ x: 0, y: 80 }, { pointerType: "touch", on: { label: "Rows list" } })
      expect(s.starts).toEqual(["touch"])
    },
  )
})
