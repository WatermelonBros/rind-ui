import { describe, expect, it, vi } from "vitest"
import { placementFrom } from "../../dom/position/connect"
import { hoverCardConnect } from "./hover-card.connect"
import { hoverCardContract } from "./hover-card.contract"
import { hoverCardMachine } from "./hover-card.machine"
import { hoverCardMeta } from "./hover-card.meta"

describe("hover card meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(hoverCardContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(hoverCardMeta.contract.actions).toEqual(actions)
    expect(hoverCardMeta.contract.queries).toEqual(Object.keys(hoverCardContract.queries))
    expect(hoverCardMeta.contract.traits).toEqual(hoverCardContract.traits)
    expect(Object.keys(hoverCardMeta.states).sort()).toEqual(
      Object.keys(hoverCardMachine.def.states).sort(),
    )
  })

  it("data attributes", () => {
    const meta = { index: 1, depth: 1, nested: true, hasNested: true, nestedCount: 1 }
    const a = hoverCardConnect(
      {
        instance: "r",
        open: false,
        placement: placementFrom({ side: "bottom", align: "start", anchorHidden: true }),
        closeReason: "escape-key",
        contentMounted: true,
        meta,
        focusWithin: true,
      },
      vi.fn(),
    )
    const hover = { onPointerMove: vi.fn(), onPointerLeave: vi.fn() }
    const parts = {
      trigger: a.trigger({ focused: true, hovered: true, modality: "keyboard" }, hover),
      positioner: a.positioner(),
      content: a.content({}),
      arrow: a.arrow(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        hoverCardMeta.dataAttributes[part as keyof typeof hoverCardMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
