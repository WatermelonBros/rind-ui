import { describe, expect, it } from "vitest"
import { checkboxGroupConnect } from "./checkbox-group.connect"
import { checkboxGroupContract } from "./checkbox-group.contract"
import { checkboxGroupMachine } from "./checkbox-group.machine"
import { checkboxGroupMeta } from "./checkbox-group.meta"

describe("checkbox group meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(checkboxGroupContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(checkboxGroupMeta.contract.actions).toEqual(actions)
    expect(checkboxGroupMeta.contract.queries).toEqual(Object.keys(checkboxGroupContract.queries))
    expect(checkboxGroupMeta.contract.traits).toEqual(checkboxGroupContract.traits)
    expect(Object.keys(checkboxGroupMeta.states)).toEqual(
      Object.keys(checkboxGroupMachine.def.states),
    )
  })

  it("data attributes", () => {
    const api = checkboxGroupConnect({
      instance: "i",
      value: [],
      allValues: [],
      disabled: true,
      readOnly: true,
      required: true,
      invalid: true,
      rootTag: "div",
      labelTag: "span",
      ids: { label: "l", description: "d", errorMessage: "e" },
      rendered: {},
      controls: [],
    })
    const parts = {
      root: api.root,
      label: api.label,
      description: api.description,
      "error-message": api.errorMessage,
    }
    for (const [part, fn] of Object.entries(parts)) {
      const keys = Object.keys(fn()).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        checkboxGroupMeta.dataAttributes[part as keyof typeof checkboxGroupMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
