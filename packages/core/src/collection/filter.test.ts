import { describe, expect, it } from "vitest"
import { collator as searchCollator } from "../i18n/messages"
import { contains, createFilter, startsWith } from "./filter"
import { toKey } from "./key"
import { type Collection, createListCollection } from "./list"

interface Row {
  id: string
  text: string
  keywords?: string[]
}

const make = (rows: Row[]): Collection<Row> =>
  createListCollection<Row>({
    items: rows,
    getKey: (r) => r.id,
    getText: (r) => r.text,
    getKeywords: (r) => r.keywords ?? [],
  })

describe("filter", () => {
  it("Diacritics: ecole matches École with locale fr", () => {
    const f = createFilter("fr")
    const c = make([
      { id: "1", text: "École" },
      { id: "2", text: "Bureau" },
    ])
    const hit = c.filter((node) => f.contains(node, "ecole"))
    expect(hit.size).toBe(1)
    expect(hit.firstKey()).toBe("1")
    expect(c.filter((node) => f.startsWith(node, "ECOLE")).size).toBe(1)
  })

  it("matches decomposed accents", () => {
    const c = searchCollator("fr")
    expect(startsWith(c, "École", "ecole")).toBe(true)
    expect(contains(c, "Ecole", "éc")).toBe(true)
  })

  it("Filter matches a keyword (dip/cmdk#146)", () => {
    const f = createFilter("en")
    const c = make([
      { id: "1", text: "Settings", keywords: ["preferences"] },
      { id: "2", text: "Profile" },
    ])
    const hit = c.filter((node) => f.contains(node, "prefer"))
    expect(hit.firstKey()).toBe("1")
    expect(hit.size).toBe(1)
    expect(c.filter((node) => f.startsWith(node, "pref")).size).toBe(1)
  })

  it("empty query matches everything; non-matches fail", () => {
    const c = searchCollator("en")
    expect(startsWith(c, "abc", "")).toBe(true)
    expect(contains(c, "abc", "")).toBe(true)
    expect(startsWith(c, "abc", "b")).toBe(false)
    expect(contains(c, "abc", "b")).toBe(true)
    expect(contains(c, "ab", "abc")).toBe(false)
  })

  it("caches one collator per locale", () => {
    expect(searchCollator("fr")).toBe(searchCollator("fr"))
    expect(searchCollator("fr")).not.toBe(searchCollator("en"))
  })

  it("case-insensitive", () => {
    expect(startsWith(searchCollator("en"), "Apple", "aPP")).toBe(true)
    expect(toKey("x")).toBe("x")
  })
})
