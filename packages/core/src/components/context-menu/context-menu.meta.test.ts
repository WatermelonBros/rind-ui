import { describe, expect, it, vi } from "vitest"
import { menuMachine } from "../menu/menu.machine"
import { contextMenuRegionProps } from "./context-menu.connect"
import { contextMenuContract } from "./context-menu.contract"
import { contextMenuMeta } from "./context-menu.meta"

describe("context menu meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(contextMenuContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(contextMenuMeta.contract.actions).toEqual(actions)
    expect(contextMenuMeta.contract.queries).toEqual(Object.keys(contextMenuContract.queries))
    expect(contextMenuMeta.contract.traits).toEqual(contextMenuContract.traits)
    expect(Object.keys(contextMenuMeta.states).sort()).toEqual(
      Object.keys(menuMachine.def.states).sort(),
    )
  })

  it("region data attributes", () => {
    const env = {
      platform: "other",
      modality: { modality: () => "keyboard" },
      locale: { dir: () => "ltr" },
    } as unknown as Parameters<typeof contextMenuRegionProps>[2]
    const props = contextMenuRegionProps(
      { instance: "r", open: true, disabled: true, hintId: "h" },
      vi.fn(),
      env,
    )
    const keys = Object.entries(props)
      .filter(([k, v]) => k.startsWith("data-") && v !== undefined)
      .map(([k]) => k)
    expect(Object.keys(contextMenuMeta.dataAttributes.trigger).sort()).toEqual(keys.sort())
  })
})
