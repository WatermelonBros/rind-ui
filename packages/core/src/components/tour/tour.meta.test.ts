import { describe, expect, it, vi } from "vitest"
import { placementFrom } from "../../dom/position/connect"
import { tourConnect } from "./tour.connect"
import { tourContract } from "./tour.contract"
import { tourMachine } from "./tour.machine"
import { tourMessages } from "./tour.messages"
import { tourMeta } from "./tour.meta"

describe("tour meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(tourContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(tourMeta.contract.actions).toEqual(actions)
    expect(tourMeta.contract.queries).toEqual(Object.keys(tourContract.queries))
    expect(tourMeta.contract.traits).toEqual(tourContract.traits)
    expect(Object.keys(tourMeta.states).sort()).toEqual(Object.keys(tourMachine.def.states).sort())
  })

  it("data attributes", () => {
    const steps = [{ id: "a", target: () => null }, { id: "b" }]
    const a = tourConnect(
      {
        instance: "r",
        state: "idle",
        steps,
        step: steps[0],
        targetMissing: true,
        modal: true,
        placement: placementFrom({ side: "bottom", align: "start", anchorHidden: true }),
        closeReason: "escape-key",
        shownOnce: true,
        stepChanging: true,
        preventTargetInteraction: true,
        rendered: { title: "ti", description: "de" },
        contentMounted: true,
        meta: { index: 1, depth: 1, nested: true, hasNested: true, nestedCount: 1 },
        focusWithin: true,
        contentFocused: true,
        modality: "keyboard",
        messages: tourMessages,
      },
      vi.fn(),
    )
    // An anchored step for the placement attributes of positioner and content.
    const anchored = tourConnect(
      {
        instance: "r",
        state: "active",
        steps,
        step: steps[0],
        targetMissing: false,
        modal: false,
        placement: placementFrom({ side: "bottom", align: "start", anchorHidden: true }),
        closeReason: null,
        shownOnce: true,
        preventTargetInteraction: false,
        rendered: {},
        contentMounted: true,
        messages: tourMessages,
      },
      vi.fn(),
    )
    const btn = { focused: true, modality: "keyboard" as const, pressed: true }
    const merge = (x: object, y: object) => ({ ...x, ...y })
    const parts = {
      trigger: a.trigger({ ...btn, tag: "button" }),
      backdrop: a.backdrop(),
      spotlight: a.spotlight(),
      positioner: merge(a.positioner(), anchored.positioner()),
      content: merge(a.content({}), anchored.content({})),
      arrow: a.arrow(),
      title: a.title({ level: 2, tag: "h2" }),
      description: a.description(),
      "progress-text": a.progressText(),
      "action-trigger": a.actionTrigger({ action: "prev" }, { ...btn, empty: true }),
      "close-trigger": a.closeTrigger({ ...btn, empty: false }),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        tourMeta.dataAttributes[part as keyof typeof tourMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
