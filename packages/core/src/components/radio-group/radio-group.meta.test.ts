import { describe, expect, it } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { radioGroupConnect } from "./radio-group.connect"
import { radioGroupContract } from "./radio-group.contract"
import { radioGroupMachine } from "./radio-group.machine"
import { radioGroupMeta } from "./radio-group.meta"

describe("radio group meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(radioGroupContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(radioGroupMeta.contract.actions).toEqual(actions)
    expect(radioGroupMeta.contract.queries).toEqual(Object.keys(radioGroupContract.queries))
    expect(radioGroupMeta.contract.traits).toEqual(radioGroupContract.traits)
    expect(Object.keys(radioGroupMeta.states)).toEqual(Object.keys(radioGroupMachine.def.states))
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
    const api = radioGroupConnect(
      {
        instance: "i",
        collection,
        value: "m",
        highlightedKey: toKey("m"),
        highlightSource: "keyboard",
        pending: false,
        orientation: "vertical",
        disabled: true,
        focusableWhenDisabled: true,
        readOnly: true,
        required: true,
        invalid: true,
        name: undefined,
        form: undefined,
        rendered: {},
      },
      () => {},
      env as never,
    )
    const own = { disabled: true }
    const parts = {
      root: api.root(),
      label: api.label(),
      description: api.description(),
      "error-message": api.errorMessage(),
      item: api.item(toKey("m"), own),
      "item-control": api.itemControl(toKey("m"), {
        tag: "button",
        focused: true,
        modality: "keyboard",
        pressed: true,
        hovered: true,
        itemDisabled: true,
        labelable: true,
        labelRendered: true,
        descriptionRendered: true,
      }),
      "item-indicator": api.itemIndicator(toKey("m"), own),
      "item-label": api.itemLabel(toKey("m"), { disabled: true, labelable: true }),
      "item-description": api.itemDescription(toKey("m"), own),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        radioGroupMeta.dataAttributes[part as keyof typeof radioGroupMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
