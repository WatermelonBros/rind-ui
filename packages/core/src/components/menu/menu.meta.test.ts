import { describe, expect, it, vi } from "vitest"
import { placementFrom } from "../../dom/position/connect"
import { menuConnect } from "./menu.connect"
import { menuContract } from "./menu.contract"
import { menuMachine } from "./menu.machine"
import { menuMeta } from "./menu.meta"

describe("menu meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(menuContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(menuMeta.contract.actions).toEqual(actions)
    expect(menuMeta.contract.queries).toEqual(Object.keys(menuContract.queries))
    expect(menuMeta.contract.traits).toEqual(menuContract.traits)
    expect(Object.keys(menuMeta.states).sort()).toEqual(Object.keys(menuMachine.def.states).sort())
  })

  it("data attributes", () => {
    const env = {
      platform: "other",
      modality: { modality: () => "keyboard" },
      locale: { dir: () => "ltr" },
    } as unknown as Parameters<typeof menuConnect>[2]
    const build = (placed: boolean) => {
      const a = menuConnect(
        {
          instance: "r",
          level: "root",
          open: false,
          modal: true,
          placement: {
            ...placementFrom({ side: "bottom", align: "start", anchorHidden: true }),
            placed,
          },
          closeReason: "escape-key",
          collection: { has: () => true } as unknown as Parameters<
            typeof menuConnect
          >[0]["collection"],
          highlightedKey: "k" as never,
          highlightSource: "keyboard",
          typingAhead: () => false,
          contentMounted: true,
          meta: { index: 1, depth: 1, nested: true, hasNested: true, nestedCount: 1 },
        },
        vi.fn(),
        env,
      )
      const key = "k" as never
      const itemState = { disabled: true, closeOnSelect: true, checked: true }
      return {
        trigger: a.trigger({
          focused: true,
          modality: "keyboard",
          pressed: true,
          tag: "button",
          disabled: true,
        }),
        positioner: a.positioner(),
        content: a.content({}),
        arrow: a.arrow(),
        item: a.item(key, { ...itemState, kind: "item" }),
        "checkbox-item": a.item(key, { ...itemState, kind: "checkbox-item" }),
        "radio-group": a.radioGroup({ disabled: true }),
        "radio-item": a.item(key, { ...itemState, kind: "radio-item" }),
        "item-indicator": a.itemIndicator(true),
        "item-text": a.itemText(),
        group: a.group("g"),
        "group-label": a.groupLabel("g"),
        separator: a.separator({ tag: "div" }),
        "submenu-trigger": a.submenuTrigger(key, {
          disabled: true,
          focused: true,
          open: true,
          contentId: "c",
          contentMounted: true,
        }),
      }
    }
    // `data-placing` and `data-anchor-hidden` are exclusive: read both placements.
    const [placed, placing] = [build(true), build(false)]
    for (const part of Object.keys(placed) as (keyof typeof placed)[]) {
      const keys = [
        ...new Set(
          [placed[part], placing[part]].flatMap((props) =>
            Object.entries(props)
              .filter(([k, v]) => k.startsWith("data-") && v !== undefined)
              .map(([k]) => k),
          ),
        ),
      ]
      const documented = Object.keys(
        menuMeta.dataAttributes[part as keyof typeof menuMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
