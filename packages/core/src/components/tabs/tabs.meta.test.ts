import { describe, expect, it } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { tabsConnect } from "./tabs.connect"
import { tabsContract } from "./tabs.contract"
import { tabsMachine } from "./tabs.machine"
import { tabsMeta } from "./tabs.meta"

describe("tabs meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(tabsContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(tabsMeta.contract.actions).toEqual(actions)
    expect(tabsMeta.contract.queries).toEqual(Object.keys(tabsContract.queries))
    expect(tabsMeta.contract.traits).toEqual(tabsContract.traits)
    expect(Object.keys(tabsMeta.states)).toEqual(Object.keys(tabsMachine.def.states))
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
    const api = tabsConnect(
      {
        instance: "i",
        collection,
        value: "m",
        highlightedKey: toKey("m"),
        pending: false,
        orientation: "vertical",
        activationMode: "automatic",
        inactivePanels: "until-found",
        disabled: true,
        focusableWhenDisabled: true,
        focusWithin: true,
        renderedPanels: new Set(["m"]),
        panelTabbable: {},
        direction: "next",
        indicator: { box, cause: "layout" },
        revealed: toKey("m"),
      },
      () => {},
      env as never,
    )
    const parts = {
      root: api.root(),
      list: api.list(),
      tab: api.tab(toKey("m"), {
        tag: "button",
        itemDisabled: true,
        focused: true,
        modality: "keyboard",
        pressed: true,
        hovered: true,
      }),
      panel: api.panel(toKey("m")),
      indicator: api.indicator(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        tabsMeta.dataAttributes[part as keyof typeof tabsMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
