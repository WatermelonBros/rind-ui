import { describe, expect, it } from "vitest"
import { createNumberParser } from "../../i18n/number-parser"
import { mergeFieldProps } from "../shared/field-control"
import { numberInputConnect } from "./number-input.connect"
import { numberInputContract } from "./number-input.contract"
import { numberInputMachine } from "./number-input.machine"
import { numberInputMessages } from "./number-input.messages"
import { numberInputMeta } from "./number-input.meta"

describe("number-input meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(numberInputContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(numberInputMeta.contract.actions).toEqual(actions)
    expect(numberInputMeta.contract.queries).toEqual(Object.keys(numberInputContract.queries))
    expect(numberInputMeta.contract.traits).toEqual(numberInputContract.traits)
    expect(Object.keys(numberInputMeta.states)).toEqual(Object.keys(numberInputMachine.def.states))
  })

  it("data attributes", () => {
    const data = {
      "data-valid": "",
      "data-invalid": "",
      "data-validating": "",
      "data-touched": "",
      "data-dirty": "",
      "data-filled": "",
    } as const
    const api = numberInputConnect(
      {
        instance: "i",
        value: 5,
        text: "5",
        defaultValue: null,
        focused: true,
        modality: "keyboard",
        composing: true,
        spinning: true,
        field: mergeFieldProps(
          {
            role: "spinbutton",
            labelable: true,
            disabled: true,
            readOnly: true,
            required: true,
            invalid: true,
          },
          null,
        ),
        fieldData: data,
        ids: { input: "in", increment: "inc", decrement: "dec", hiddenInput: "hid" },
        labelId: "l",
        canIncrement: true,
        canDecrement: true,
        pressed: { increment: true, decrement: true },
        parser: createNumberParser("en-US"),
        messages: numberInputMessages,
        plainTextbox: false,
        inputMode: "decimal",
      },
      { router: undefined, origin: () => undefined } as never,
    )
    const rendered = {
      control: api.control(),
      input: api.input(),
      "increment-trigger": api.incrementTrigger(),
      "decrement-trigger": api.decrementTrigger(),
      "hidden-input": api.hiddenInput(),
    }
    for (const [part, props] of Object.entries(rendered)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const meta = numberInputMeta.dataAttributes[part as keyof typeof rendered]
      expect(Object.keys(meta).sort(), part).toEqual(keys.sort())
    }
    // The Root is rendered by the Field host: scope, part and instance come from it.
    const root = Object.keys(api.root()).filter((k) => k.startsWith("data-"))
    const meta = Object.keys(numberInputMeta.dataAttributes.root)
    for (const k of root) expect(meta, k).toContain(k)
    expect(meta).toEqual(expect.arrayContaining(["data-scope", "data-part", "data-instance"]))
  })
})
