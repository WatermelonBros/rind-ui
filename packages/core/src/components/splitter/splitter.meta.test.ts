import { describe, expect, it } from "vitest"
import { splitterConnect } from "./splitter.connect"
import { splitterContract } from "./splitter.contract"
import { splitterMachine } from "./splitter.machine"
import { splitterMeta } from "./splitter.meta"

describe("splitter meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(splitterContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(splitterMeta.contract.actions).toEqual(actions)
    expect(splitterMeta.contract.queries).toEqual(Object.keys(splitterContract.queries))
    expect(splitterMeta.contract.traits).toEqual(splitterContract.traits)
    expect(Object.keys(splitterMeta.states)).toEqual(Object.keys(splitterMachine.def.states))
  })

  it("data attributes", () => {
    const api = splitterConnect({
      instance: "i",
      orientation: "horizontal",
      dir: "ltr",
      sizes: [30, 70],
      panels: [{ collapsible: true }, {}],
      disabled: true,
      handleDisabled: [],
      focused: 0,
      modality: "keyboard",
      draggingHandle: 0,
    })
    const rendered = { root: api.root(), panel: api.panel(0), handle: api.handle(0) }
    expect(Object.keys(splitterMeta.dataAttributes).sort()).toEqual(Object.keys(rendered).sort())
    for (const [part, props] of Object.entries(rendered)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-") && props[k] !== undefined)
      const meta = splitterMeta.dataAttributes[part as keyof typeof splitterMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(keys.sort())
    }
  })
})
