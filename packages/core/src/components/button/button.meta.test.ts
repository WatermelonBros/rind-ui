import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { buttonConnect } from "./button.connect"
import { buttonContract } from "./button.contract"
import { buttonMachine } from "./button.machine"
import { buttonMeta } from "./button.meta"

describe("button meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(buttonContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(buttonMeta.contract.actions).toEqual(actions)
    expect(buttonMeta.contract.queries).toEqual(Object.keys(buttonContract.queries))
    expect(Object.keys(buttonMeta.states)).toEqual(Object.keys(buttonMachine.def.states))
  })
  it("data attributes", () => {
    const env = { platform: platforms.linux, modality: { modality: () => "pointer" as const } }
    const part = buttonConnect(
      {
        instance: "i",
        tag: "button",
        disabled: false,
        focusableWhenDisabled: false,
        pending: false,
        focused: false,
        modality: "pointer",
        pressed: false,
        hovered: false,
      },
      env as unknown as Parameters<typeof buttonConnect>[1], // only platform and modality are read
    )
    const keys = Object.keys(part).filter((k) => k.startsWith("data-"))
    expect(Object.keys(buttonMeta.dataAttributes.root).sort()).toEqual(keys.sort())
  })
})
