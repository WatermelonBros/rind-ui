import { describe, expect, it } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { radioGroupMachine } from "../radio-group/radio-group.machine"
import { segmentedControlConnect } from "./segmented-control.connect"
import { segmentedControlContract } from "./segmented-control.contract"
import { segmentedControlMeta } from "./segmented-control.meta"

describe("segmented control meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(segmentedControlContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(segmentedControlMeta.contract.actions).toEqual(actions)
    expect(segmentedControlMeta.contract.queries).toEqual(
      Object.keys(segmentedControlContract.queries),
    )
    expect(segmentedControlMeta.contract.traits).toEqual(segmentedControlContract.traits)
    expect(Object.keys(segmentedControlMeta.states)).toEqual(
      Object.keys(radioGroupMachine.def.states),
    )
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
    const box = { left: 0, right: 1, top: 0, bottom: 1, width: 1, height: 1 }
    const api = segmentedControlConnect(
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
        indicator: { box, cause: "layout" },
      },
      () => {},
      env as never,
    )
    const parts = {
      root: api.root(),
      label: api.label(),
      item: api.item(toKey("m"), {
        tag: "button",
        focused: true,
        modality: "keyboard",
        pressed: true,
        hovered: true,
        itemDisabled: true,
      }),
      indicator: api.indicator(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        segmentedControlMeta.dataAttributes[
          part as keyof typeof segmentedControlMeta.dataAttributes
        ],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
