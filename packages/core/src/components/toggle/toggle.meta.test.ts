import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { toggleConnect } from "./toggle.connect"
import { toggleContract } from "./toggle.contract"
import { toggleMachine } from "./toggle.machine"
import { toggleMeta } from "./toggle.meta"

describe("toggle meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(toggleContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(toggleMeta.contract.actions).toEqual(actions)
    expect(toggleMeta.contract.queries).toEqual(Object.keys(toggleContract.queries))
    expect(toggleMeta.contract.traits).toEqual(toggleContract.traits)
    expect(Object.keys(toggleMeta.states)).toEqual(Object.keys(toggleMachine.def.states))
  })

  it("data attributes", () => {
    const env = { platform: platforms.linux, modality: { modality: () => "pointer" as const } }
    const api = toggleConnect(
      {
        instance: "i",
        tag: "button",
        on: true,
        disabled: true,
        focusableWhenDisabled: false,
        focused: true,
        modality: "keyboard",
        pressed: true,
        hovered: true,
      },
      env as unknown as Parameters<typeof toggleConnect>[1], // only platform and modality are read
    )
    for (const part of ["root", "indicator"] as const) {
      const keys = Object.keys(api[part]()).filter((k) => k.startsWith("data-"))
      expect(Object.keys(toggleMeta.dataAttributes[part]).sort()).toEqual(keys.sort())
    }
  })
})
