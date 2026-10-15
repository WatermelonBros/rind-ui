import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { switchConnect } from "./switch.connect"
import { switchContract } from "./switch.contract"
import { switchMachine } from "./switch.machine"
import { switchMeta } from "./switch.meta"

describe("switch meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(switchContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(switchMeta.contract.actions).toEqual(actions)
    expect(switchMeta.contract.queries).toEqual(Object.keys(switchContract.queries))
    expect(switchMeta.contract.traits).toEqual(switchContract.traits)
    expect(Object.keys(switchMeta.states)).toEqual(Object.keys(switchMachine.def.states))
  })

  it("data attributes", () => {
    const env = { platform: platforms.linux, modality: { modality: () => "pointer" as const } }
    const api = switchConnect(
      {
        instance: "i",
        checked: true,
        tag: "button",
        labelable: true,
        field: {
          disabled: true,
          readOnly: true,
          required: true,
          invalid: true,
          name: "n",
          "aria-required": undefined,
          "aria-invalid": "true",
          "aria-describedby": undefined,
          "aria-labelledby": undefined,
          "aria-errormessage": undefined,
        },
        focusableWhenDisabled: false,
        focused: true,
        modality: "keyboard",
        pressed: true,
        hovered: true,
        ids: { control: "c", label: "l", description: "d", hiddenInput: "h" },
        labelRendered: true,
        value: "on",
        defaultChecked: false,
      },
      env as unknown as Parameters<typeof switchConnect>[1], // only platform and modality are read
    )
    for (const part of ["root", "control", "thumb", "label", "description"] as const) {
      const keys = Object.keys(api[part]()).filter((k) => k.startsWith("data-"))
      expect(Object.keys(switchMeta.dataAttributes[part]).sort(), part).toEqual(keys.sort())
    }
  })
})
