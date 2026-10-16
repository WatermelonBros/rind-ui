import { describe, expect, it } from "vitest"
import { sliderConnect } from "./slider.connect"
import { sliderContract } from "./slider.contract"
import { sliderMachine } from "./slider.machine"
import { sliderRange } from "./slider.math"
import { sliderMessages } from "./slider.messages"
import { sliderMeta } from "./slider.meta"

describe("slider meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(sliderContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(sliderMeta.contract.actions).toEqual(actions)
    expect(sliderMeta.contract.queries).toEqual(Object.keys(sliderContract.queries))
    expect(sliderMeta.contract.traits).toEqual(sliderContract.traits)
    expect(Object.keys(sliderMeta.states)).toEqual(Object.keys(sliderMachine.def.states))
  })

  it("data attributes", () => {
    const api = sliderConnect({
      instance: "i",
      values: [20, 80],
      range: sliderRange({}),
      alignment: "center",
      orientation: "horizontal",
      dir: "ltr",
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
      thumbDisabled: [],
      focused: 0,
      modality: "keyboard",
      active: 0,
      draggingThumb: 0,
      dragging: true,
      ids: { root: "r", label: "l", description: "d", input: (i) => `in${i}` },
      labelledBy: "l",
      locale: "en",
      messages: sliderMessages,
      defaultValues: [20, 80],
    })
    const rendered = {
      root: api.root(),
      label: api.label(),
      "value-text": api.valueText(),
      control: api.control(),
      track: api.track(),
      indicator: api.indicator(),
      thumb: api.thumb(0),
      "hidden-input": api.input(0),
      "marker-group": api.markerGroup(),
      marker: api.marker(50),
      description: api.description(),
    }
    expect(Object.keys(sliderMeta.dataAttributes).sort()).toEqual(Object.keys(rendered).sort())
    for (const [part, props] of Object.entries(rendered)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const meta = sliderMeta.dataAttributes[part as keyof typeof sliderMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(keys.sort())
    }
  })
})
