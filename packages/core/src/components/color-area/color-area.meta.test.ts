import { describe, expect, it } from "vitest"
import { makeColor } from "../shared/color/color"
import { areaAxes } from "./color-area.axes"
import { colorAreaConnect } from "./color-area.connect"
import { colorAreaContract } from "./color-area.contract"
import { colorAreaMessages } from "./color-area.messages"
import { colorAreaMeta } from "./color-area.meta"

describe("color area meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(colorAreaMeta.contract.actions)).toEqual(
      Object.keys(colorAreaContract.actions),
    )
    expect(colorAreaMeta.contract.queries).toEqual(Object.keys(colorAreaContract.queries))
    expect(colorAreaMeta.contract.traits).toEqual(colorAreaContract.traits)
    expect(Object.keys(colorAreaMeta.states)).toEqual(Object.keys(colorAreaContract.states))
  })
  it("data attributes", () => {
    const api = colorAreaConnect({
      instance: "a",
      color: makeColor("hsb", [10, 20, 30]),
      axes: areaAxes("hsb"),
      dir: "ltr",
      disabled: true,
      readOnly: true,
      dragging: true,
      focused: "x",
      tabStop: "x",
      changed: null,
      modality: "keyboard",
      messages: colorAreaMessages,
      locale: "en-US",
      ids: { root: "a", input: (x) => x },
      defaultColor: makeColor("hsb", [0, 0, 100]),
    })
    const keys = (p: object) =>
      Object.keys(p)
        .filter((k) => k.startsWith("data-"))
        .sort()
    expect(Object.keys(colorAreaMeta.dataAttributes.root).sort()).toEqual(keys(api.root()))
    expect(Object.keys(colorAreaMeta.dataAttributes.thumb).sort()).toEqual(keys(api.thumb()))
  })
})
