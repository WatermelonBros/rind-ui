import { describe, expect, it } from "vitest"
import type { FieldControlProps } from "../shared/field-control"
import { ratingConnect } from "./rating.connect"
import { ratingContract } from "./rating.contract"
import { ratingMachine, ratingRange } from "./rating.machine"
import { ratingMessages } from "./rating.messages"
import { ratingMeta } from "./rating.meta"

const field: FieldControlProps = {
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
}

describe("rating meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(ratingContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(ratingMeta.contract.actions).toEqual(actions)
    expect(ratingMeta.contract.queries).toEqual(Object.keys(ratingContract.queries))
    expect(ratingMeta.contract.traits).toEqual(ratingContract.traits)
    expect(Object.keys(ratingMeta.states)).toEqual(Object.keys(ratingMachine.def.states))
  })

  it("data attributes", () => {
    const api = ratingConnect({
      instance: "i",
      dir: "ltr",
      value: 2,
      preview: 3,
      range: ratingRange({}),
      field,
      focused: true,
      modality: "keyboard",
      ids: { root: "r", label: "l", input: "in", hiddenInput: "h" },
      labelledBy: "l",
      locale: "en",
      messages: ratingMessages,
      defaultValue: 0,
    })
    const rendered = {
      root: api.root(),
      label: api.label(),
      control: api.control(),
      item: api.item(1),
      input: api.input(),
      "hidden-input": api.hiddenInput(),
    }
    expect(Object.keys(ratingMeta.dataAttributes).sort()).toEqual(Object.keys(rendered).sort())
    for (const [part, props] of Object.entries(rendered)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const meta = ratingMeta.dataAttributes[part as keyof typeof ratingMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(keys.sort())
    }
  })
})
