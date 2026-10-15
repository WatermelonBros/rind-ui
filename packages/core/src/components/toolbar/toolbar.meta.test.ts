import { describe, expect, it } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { toolbarConnect } from "./toolbar.connect"
import { toolbarContract } from "./toolbar.contract"
import { toolbarMachine } from "./toolbar.machine"
import { toolbarMeta } from "./toolbar.meta"

describe("toolbar meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(toolbarContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(toolbarMeta.contract.actions).toEqual(actions)
    expect(toolbarMeta.contract.queries).toEqual(Object.keys(toolbarContract.queries))
    expect(toolbarMeta.contract.traits).toEqual(toolbarContract.traits)
    expect(Object.keys(toolbarMeta.states)).toEqual(Object.keys(toolbarMachine.def.states))
  })

  it("data attributes", () => {
    const collection = createListCollection({
      items: [{ id: "b" }],
      getKey: (i) => i.id,
      getText: (i) => i.id,
    })
    const env = {
      platform: platforms.linux,
      locale: { dir: () => "ltr" as const },
      modality: { modality: () => "keyboard" as const },
    }
    const api = toolbarConnect(
      {
        instance: "i",
        collection,
        highlightedKey: toKey("b"),
        focusWithin: true,
        pending: false,
        orientation: "vertical",
        disabled: true,
        focusableWhenDisabled: true,
      },
      () => {},
      env as never,
    )
    const control = { ...api.control({ id: "b", disabled: true, first: true }) }
    const parts = {
      root: api.root(),
      button: { ...control, ...api.part("button", "b") },
      link: { ...control, ...api.part("link", "b") },
      item: { ...control, ...api.part("item", "b") },
      group: api.group(true),
      separator: api.separator({ tag: "div" }),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        toolbarMeta.dataAttributes[part as keyof typeof toolbarMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
