// add-tour 3.x: connect's naming precedence, Back at the first step, progress and stacking.
import { describe, expect, it, vi } from "vitest"
import { placementFrom, unplaced } from "../../dom/position/connect"
import { type TourConnectInput, tourConnect } from "./tour.connect"
import { tourMessages } from "./tour.messages"
import type { TourStep } from "./tour.steps"

const steps: TourStep[] = [
  { id: "a", title: "A" },
  { id: "w", type: "wait" },
  { id: "b", target: () => null },
  { id: "c" },
]

const input = (over: Partial<TourConnectInput> = {}): TourConnectInput => ({
  instance: "t",
  state: "active",
  steps,
  step: steps[2],
  targetMissing: false,
  modal: false,
  placement: placementFrom({ side: "bottom", align: "center", anchorHidden: false }),
  closeReason: null,
  shownOnce: true,
  preventTargetInteraction: false,
  rendered: {},
  contentMounted: true,
  messages: tourMessages,
  ...over,
})

describe("tourConnect", () => {
  it("names the content: Title, then the consumer, then 'Step 2 of 3'", () => {
    expect(tourConnect(input({ rendered: { title: "ti" } }), vi.fn()).content({})).toMatchObject({
      "aria-labelledby": "ti",
      "aria-label": undefined,
    })
    expect(tourConnect(input(), vi.fn()).content({ label: "Mine" })["aria-label"]).toBe("Mine")
    expect(tourConnect(input(), vi.fn()).content({})["aria-label"]).toBe("Step 2 of 3")
  })

  it("progress counts no wait step; --rind-tour-progress and data-first / data-last", () => {
    const api = tourConnect(input({ step: steps[3] }), vi.fn())
    expect(api.progressLabel()).toBe("3 of 3")
    const c = api.content({})
    expect(c["style"]).toMatchObject({ "--rind-tour-progress": "1" })
    expect(c["data-last"]).toBe("")
    expect(c["data-first"]).toBeUndefined()
  })

  it("Back on the first step is aria-disabled and does nothing; Next on the last reads Done", () => {
    const send = vi.fn()
    const first = tourConnect(input({ step: steps[0] }), send)
    const back = first.actionTrigger(
      { action: "prev" },
      { focused: false, modality: "pointer", pressed: false, empty: true },
    )
    expect(back).toMatchObject({
      "aria-disabled": "true",
      "data-disabled": "",
      "aria-label": "Back",
    })
    first.pressAction({ action: "prev" })
    expect(send).not.toHaveBeenCalled()
    const last = tourConnect(input({ step: steps[3] }), send)
    expect(
      last.actionTrigger(
        { action: "next" },
        { focused: false, modality: "pointer", pressed: false, empty: true },
      )["aria-label"],
    ).toBe("Done")
  })

  it("a visible label wins over messages; the close trigger always reports dismiss", () => {
    const send = vi.fn()
    const api = tourConnect(input(), send)
    expect(
      api.actionTrigger(
        { action: "dismiss" },
        { focused: false, modality: "pointer", pressed: false, empty: false },
      )["aria-label"],
    ).toBeUndefined()
    api.pressClose()
    expect(send).toHaveBeenCalledWith({ type: "dismiss", close: true })
  })

  it("stacking: backdrop < spotlight < positioner, all within the layer's own index", () => {
    const api = tourConnect(
      input({ meta: { index: 2, depth: 0, nested: false, hasNested: false, nestedCount: 0 } }),
      vi.fn(),
    )
    const index = (p: Record<string, unknown>) =>
      Number((p["style"] as Record<string, string>)["--layer-index"])
    expect(index(api.backdrop())).toBeLessThan(index(api.spotlight()))
    expect(index(api.spotlight())).toBeLessThan(index(api.positioner()))
    expect(Math.round(index(api.backdrop()))).toBe(2)
  })

  it("a centred step has no spotlight and a centred positioner; aria-modal only when modal", () => {
    const api = tourConnect(
      input({ step: steps[0], modal: true, placement: unplaced("bottom", "center") }),
      vi.fn(),
    )
    expect(api.spotlight()["hidden"]).toBe(true)
    expect(api.positioner()["style"]).toMatchObject({ position: "fixed", top: "50%" })
    expect(api.content({})["aria-modal"]).toBe("true")
    expect(tourConnect(input(), vi.fn()).content({})["aria-modal"]).toBeUndefined()
  })

  it("the shield sets data-shield and pointer events on the spotlight", () => {
    const s = tourConnect(input({ preventTargetInteraction: true }), vi.fn()).spotlight()
    expect(s["data-shield"]).toBe("")
    expect(s["style"]).toMatchObject({ "pointer-events": "auto" })
  })
})
