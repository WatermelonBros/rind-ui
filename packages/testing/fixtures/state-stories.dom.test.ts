// Every contract state of the fixtures has a state story (a11y-test-tooling).
import { contract, setup, type } from "@rind-ui/core"
import { describe, expect, it } from "vitest"
import * as announceStories from "../../../apps/storybook/stories/AnnounceFixture.stories"
import * as disclosureStories from "../../../apps/storybook/stories/Disclosure.stories"
import * as layerStories from "../../../apps/storybook/stories/LayerFixture.stories"
import * as listboxStories from "../../../apps/storybook/stories/ListboxFixture.stories"
import * as pressStories from "../../../apps/storybook/stories/PressFixture.stories"
import { missingStateStories } from "../src/index"
import { streamContract } from "./announce/announce.contract"
import { disclosureContract } from "./disclosure/disclosure.contract"
import { layerContract } from "./layer/layer.contract"
import { listboxContract } from "./listbox/listbox.contract"
import { counterContract, toggleContract } from "./press/press.contract"

describe("state stories", () => {
  it("every fixture contract state has a story", () => {
    expect([
      ...missingStateStories(disclosureContract, disclosureStories.states, disclosureStories),
      ...missingStateStories(toggleContract, pressStories.states, pressStories),
      ...missingStateStories(counterContract, pressStories.states, pressStories),
      ...missingStateStories(streamContract, announceStories.states, announceStories),
      ...missingStateStories(layerContract, layerStories.states, layerStories),
      ...missingStateStories(listboxContract, listboxStories.states, listboxStories),
    ]).toEqual([])
  })

  it("a contract state without a story is reported by name", () => {
    const m = setup({
      types: type<{ props: object; events: { type: "X" }; env: object }>(),
    }).machine({
      id: "m",
      initial: "closed",
      states: { closed: { on: { X: "open" } }, open: {} },
    })
    const c = contract("m", {
      machine: m,
      anatomy: ["root"],
      locate: (name: string) => ({ role: "button", name }),
      queries: {},
      actions: {},
      states: { closed: {}, open: {} },
      events: {},
      traits: [],
    })
    expect(missingStateStories(c, { m: { closed: "Closed" } }, { Closed: {} })).toEqual([
      'm: no state story for "open"',
    ])
  })
})
