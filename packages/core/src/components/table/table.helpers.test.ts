import { describe, expect, it } from "vitest"
import { facetValues, filterItems, paginateItems, sortItems } from "./table.sort"

type Row = { readonly name: string; readonly kind: string | null; readonly rank: number }
const rows: Row[] = [
  { name: "Crème", kind: "dessert", rank: 2 },
  { name: "creme", kind: null, rank: 1 },
  { name: "Cream", kind: "dessert", rank: 3 },
  { name: "Bread", kind: "bakery", rank: 4 },
]
const get = (r: Row, c: string) => r[c as keyof Row]

describe("filterItems", () => {
  it("query ignores case and accents", () => {
    const out = filterItems(rows, { query: "CREME", getValue: get, searchColumns: ["name"] })
    expect(out.map((r) => r.name)).toEqual(["Crème", "creme"])
  })
  it("every column filter must pass; the input is untouched", () => {
    const copy = [...rows]
    const out = filterItems(rows, {
      filters: { kind: (v) => v === "dessert", rank: (v) => (v as number) > 2 },
      getValue: get,
    })
    expect(out.map((r) => r.name)).toEqual(["Cream"])
    expect(rows).toEqual(copy)
  })
  it("an empty query keeps every row", () => {
    expect(filterItems(rows, { query: "  ", getValue: get, searchColumns: ["name"] })).toHaveLength(
      4,
    )
  })
})

describe("facetValues", () => {
  it("distinct values with counts, first-seen order", () => {
    expect(facetValues(rows, "kind", get)).toEqual([
      { value: "dessert", count: 2 },
      { value: null, count: 1 },
      { value: "bakery", count: 1 },
    ])
  })
})

describe("paginateItems", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1)
  it("the last page clamps", () => {
    const p = paginateItems(items, 9, 10)
    expect(p).toMatchObject({ page: 3, from: 21, to: 23, total: 23, pageCount: 3 })
    expect(p.items).toEqual([21, 22, 23])
  })
  it("empty: one page, from and to 0", () => {
    expect(paginateItems([], 2, 10)).toMatchObject({ page: 1, pageCount: 1, from: 0, to: 0 })
  })
})

describe("sortItems options", () => {
  it("a per-column comparator (lower rank first means reversed)", () => {
    const out = sortItems(rows, { column: "rank", direction: "ascending" }, get, {
      compare: { rank: (a, b) => (b as number) - (a as number) },
    })
    expect(out.map((r) => r.rank)).toEqual([4, 3, 2, 1])
  })
  it("empty values first", () => {
    const out = sortItems(rows, { column: "kind", direction: "ascending" }, get, { empty: "first" })
    expect(out[0]?.kind).toBeNull()
  })
})
