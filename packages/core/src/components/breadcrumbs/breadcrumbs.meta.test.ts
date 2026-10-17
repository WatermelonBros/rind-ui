import { describe, expect, it } from "vitest"
import { breadcrumbsConnect, breadcrumbsItemState, deriveTrail } from "./breadcrumbs.connect"
import { breadcrumbsContract } from "./breadcrumbs.contract"
import { breadcrumbsMeta } from "./breadcrumbs.meta"

const dataKeys = (props: object | null) =>
  Object.keys(props ?? {})
    .filter((k) => k.startsWith("data-"))
    .sort()

describe("breadcrumbs meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(breadcrumbsMeta.contract.actions)).toEqual(
      Object.keys(breadcrumbsContract.actions),
    )
    expect(breadcrumbsMeta.contract.queries).toEqual(Object.keys(breadcrumbsContract.queries))
    expect(breadcrumbsMeta.contract.traits).toEqual(breadcrumbsContract.traits)
  })

  it("data attributes (collapsed, current, disabled, last)", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, textValue: `${i}` }))
    const trail = deriveTrail({ items, maxItems: 3 })
    const api = breadcrumbsConnect({ instance: "i", trail, labelled: false, label: "B" })
    const all = { ...breadcrumbsItemState(trail, "k4", true, "page"), collapsed: true }
    const m = breadcrumbsMeta.dataAttributes
    expect(Object.keys(m.root).sort()).toEqual(dataKeys(api.root()))
    expect(Object.keys(m.list).sort()).toEqual(dataKeys(api.list()))
    expect(Object.keys(m.item).sort()).toEqual(dataKeys(api.item(all)))
    expect(Object.keys(m.link).sort()).toEqual(dataKeys(api.currentText(all)))
    expect(Object.keys(m.separator).sort()).toEqual(dataKeys(api.separator(all)))
    expect(Object.keys(m.ellipsis).sort()).toEqual(dataKeys(api.ellipsis("x")))
  })

  it("is stateless", () => {
    expect(breadcrumbsMeta.stateless).toBe(true)
  })
})
