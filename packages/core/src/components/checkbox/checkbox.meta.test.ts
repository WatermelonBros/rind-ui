import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { checkboxConnect } from "./checkbox.connect"
import { checkboxContract } from "./checkbox.contract"
import { checkboxMachine } from "./checkbox.machine"
import { checkboxMeta } from "./checkbox.meta"

describe("checkbox meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(checkboxContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(checkboxMeta.contract.actions).toEqual(actions)
    expect(checkboxMeta.contract.queries).toEqual(Object.keys(checkboxContract.queries))
    expect(checkboxMeta.contract.traits).toEqual(checkboxContract.traits)
    expect(Object.keys(checkboxMeta.states)).toEqual(Object.keys(checkboxMachine.def.states))
  })

  it("data attributes", () => {
    const env = { platform: platforms.linux, modality: { modality: () => "pointer" as const } }
    const api = checkboxConnect(
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
      env as unknown as Parameters<typeof checkboxConnect>[1], // only platform and modality are read
    )
    for (const part of ["root", "control", "indicator", "label", "description"] as const) {
      const keys = Object.keys(api[part]()).filter((k) => k.startsWith("data-"))
      expect(Object.keys(checkboxMeta.dataAttributes[part]).sort(), part).toEqual(keys.sort())
    }
  })
})
