import { describe, expect, it, vi } from "vitest"
import { placementFrom } from "../../dom/position/connect"
import { tooltipConnect } from "./tooltip.connect"
import { tooltipContract } from "./tooltip.contract"
import { tooltipMachine } from "./tooltip.machine"
import { tooltipMeta } from "./tooltip.meta"

describe("tooltip meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(tooltipContract.actions).map(([name, a]) => [
        name,
        (["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
      ]),
    )
    expect(tooltipMeta.contract.actions).toEqual(actions)
    expect(tooltipMeta.contract.queries).toEqual(Object.keys(tooltipContract.queries))
    expect(tooltipMeta.contract.traits).toEqual(tooltipContract.traits)
    expect(Object.keys(tooltipMeta.states).sort()).toEqual(
      Object.keys(tooltipMachine.def.states).sort(),
    )
  })

  it("data attributes", () => {
    const a = tooltipConnect(
      {
        instance: "r",
        open: true,
        instant: true,
        placement: placementFrom({ side: "top", align: "start", anchorHidden: true }),
        type: "description",
        contentMounted: true,
      },
      vi.fn(),
    )
    const parts = {
      trigger: a.trigger(
        { focused: true, hovered: true, modality: "keyboard" },
        { onPointerMove: vi.fn(), onPointerLeave: vi.fn() },
      ),
      positioner: a.positioner(),
      content: a.content(),
      arrow: a.arrow(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        tooltipMeta.dataAttributes[part as keyof typeof tooltipMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
