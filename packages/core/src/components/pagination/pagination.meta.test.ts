import { describe, expect, it } from "vitest"
import { paginationConnect } from "./pagination.connect"
import { paginationContract } from "./pagination.contract"
import { paginationMachine, paginationState } from "./pagination.machine"
import { paginationMessages } from "./pagination.messages"
import { paginationMeta } from "./pagination.meta"

const dataKeys = (p: Readonly<Record<string, unknown>>) =>
  Object.keys(p).filter((k) => k.startsWith("data-"))

describe("pagination meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(paginationContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(paginationMeta.contract.actions).toEqual(actions)
    expect(paginationMeta.contract.queries).toEqual(Object.keys(paginationContract.queries))
    expect(paginationMeta.contract.traits).toEqual(paginationContract.traits)
    expect(Object.keys(paginationMeta.states)).toEqual(Object.keys(paginationMachine.def.states))
  })

  it("data attributes (Button/Link interaction attributes added by the parts)", () => {
    const api = paginationConnect({
      instance: "i",
      state: paginationState({ totalPages: 3 }, { page: 1, pageSize: 10 }),
      messages: paginationMessages,
      disabled: true,
    })
    const interaction = ["data-focus", "data-focus-visible", "data-hover", "data-pressed"]
    const own = (keys: readonly string[]) => keys.filter((k) => !interaction.includes(k)).sort()
    expect(Object.keys(paginationMeta.dataAttributes.root).sort()).toEqual(
      dataKeys(api.root(false)).sort(),
    )
    expect(Object.keys(paginationMeta.dataAttributes.list).sort()).toEqual(
      dataKeys(api.list()).sort(),
    )
    expect(Object.keys(paginationMeta.dataAttributes.item).sort()).toEqual(
      dataKeys(api.item("page")).sort(),
    )
    // data-current is present on the current page only: read it from page 1.
    expect(own(Object.keys(paginationMeta.dataAttributes.page))).toEqual(
      dataKeys(api.page(1, false).props).sort(),
    )
    expect(Object.keys(paginationMeta.dataAttributes.ellipsis).sort()).toEqual(
      dataKeys(api.ellipsis("start")).sort(),
    )
    expect(own(Object.keys(paginationMeta.dataAttributes.next))).toEqual(
      dataKeys(api.trigger("next", false).props).sort(),
    )
  })
})
