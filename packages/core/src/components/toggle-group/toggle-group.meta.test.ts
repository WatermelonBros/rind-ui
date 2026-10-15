import { describe, expect, it } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { toggleGroupConnect } from "./toggle-group.connect"
import { toggleGroupContract } from "./toggle-group.contract"
import { toggleGroupMachine } from "./toggle-group.machine"
import { toggleGroupMeta } from "./toggle-group.meta"

describe("toggle group meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(toggleGroupContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(toggleGroupMeta.contract.actions).toEqual(actions)
    expect(toggleGroupMeta.contract.queries).toEqual(Object.keys(toggleGroupContract.queries))
    expect(toggleGroupMeta.contract.traits).toEqual(toggleGroupContract.traits)
    expect(Object.keys(toggleGroupMeta.states)).toEqual(Object.keys(toggleGroupMachine.def.states))
  })

  it("data attributes", () => {
    const collection = createListCollection({
      items: [{ id: "m", disabled: true }],
      getKey: (i) => i.id,
      getText: (i) => i.id,
      isDisabled: (i) => i.disabled,
    })
    const env = {
      platform: platforms.linux,
      locale: { dir: () => "ltr" as const },
      modality: {
        modality: () => "keyboard" as const,
        subscribe: () => () => {},
        focusCause: () => "other" as const,
        markFocus: () => {},
        unmarkFocus: () => {},
        recentFocus: () => [],
      },
    }
    const api = toggleGroupConnect(
      {
        instance: "i",
        collection,
        value: ["m"],
        highlightedKey: toKey("m"),
        pending: false,
        orientation: "vertical",
        selectionMode: "multiple",
        disabled: true,
        focusableWhenDisabled: true,
        focusWithin: true,
      },
      () => {},
      env as never,
    )
    const parts = {
      root: api.root(),
      item: api.item(toKey("m"), {
        tag: "button",
        itemDisabled: true,
        focused: true,
        modality: "keyboard",
        pressed: true,
        hovered: true,
      }),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        toggleGroupMeta.dataAttributes[part as keyof typeof toggleGroupMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
