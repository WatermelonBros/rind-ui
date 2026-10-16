import { describe, expect, it, vi } from "vitest"
import { placementFrom } from "../../dom/position/connect"
import { popoverConnect } from "./popover.connect"
import { popoverContract } from "./popover.contract"
import { popoverMachine } from "./popover.machine"
import { popoverMessages } from "./popover.messages"
import { popoverMeta } from "./popover.meta"

describe("popover meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(popoverContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(popoverMeta.contract.actions).toEqual(actions)
    expect(popoverMeta.contract.queries).toEqual(Object.keys(popoverContract.queries))
    expect(popoverMeta.contract.traits).toEqual(popoverContract.traits)
    expect(Object.keys(popoverMeta.states).sort()).toEqual(
      Object.keys(popoverMachine.def.states).sort(),
    )
  })

  it("data attributes", () => {
    const meta = { index: 1, depth: 1, nested: true, hasNested: true, nestedCount: 1 }
    const a = popoverConnect(
      {
        scope: "popover",
        instance: "r",
        open: false,
        modal: true,
        disabled: true,
        placement: placementFrom({ side: "bottom", align: "start", anchorHidden: true }),
        closeReason: "escape-key",
        rendered: { title: "ti", description: "de" },
        contentMounted: true,
        meta,
        focusWithin: true,
        contentFocused: true,
        modality: "keyboard",
        messages: popoverMessages,
      },
      vi.fn(),
    )
    const btn = { focused: true, modality: "keyboard" as const, pressed: true }
    const parts = {
      trigger: a.trigger({ ...btn, tag: "button" }),
      anchor: a.anchor(),
      indicator: a.indicator(),
      positioner: a.positioner(),
      content: a.content({}),
      arrow: a.arrow(),
      title: a.title({ level: 2, tag: "h2" }),
      description: a.description(),
      "close-trigger": a.closeTrigger({ ...btn, empty: false }),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        popoverMeta.dataAttributes[part as keyof typeof popoverMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
