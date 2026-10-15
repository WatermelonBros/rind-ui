import { afterEach, describe, expect, it } from "vitest"
import { toKey } from "./key"
import { type Collection, createListCollection } from "./list"

declare const process: { env: { NODE_ENV?: string | undefined } }

interface Row {
  id: string
  text: string
  section?: string
  disabled?: boolean
  keywords?: string[]
}

const make = (rows: Row[]): Collection<Row> =>
  createListCollection<Row>({
    items: rows,
    getKey: (r) => r.id,
    getText: (r) => r.text,
    getKeywords: (r) => r.keywords ?? [],
    isDisabled: (r) => r.disabled === true,
    getSection: (r) => (r.section ? { key: r.section, label: r.section } : undefined),
  })

const row = (id: string, extra: Partial<Row> = {}): Row => ({ id, text: id, ...extra })
const keys = (c: Collection<Row>) => Array.from({ length: c.size }, (_, i) => c.at(i)?.key)

describe("list collection", () => {
  const original = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = original
  })

  it("Duplicate key: dev error names the key and both items", () => {
    expect(() => make([row("a", { text: "First" }), row("a", { text: "Second" })])).toThrow(
      /duplicate collection key "a".*"First".*index 0.*"Second"/,
    )
  })

  it("Duplicate key: production skips the later duplicate", () => {
    process.env.NODE_ENV = "production"
    const c = make([row("a", { text: "First" }), row("b"), row("a", { text: "Second" })])
    expect(c.size).toBe(2)
    expect(c.get(toKey("a"))?.textValue).toBe("First")
    expect(keys(c)).toEqual(["a", "b"])
  })

  it("Index ignores sections", () => {
    const c = make([row("apple", { section: "Fruit" }), row("pear", { section: "Fruit" })])
    expect(c.get(toKey("apple"))?.index).toBe(0)
    expect(c.get(toKey("pear"))?.index).toBe(1)
    expect(c.size).toBe(2)
    expect(c.sections().map((s) => s.label)).toEqual(["Fruit"])
    expect(c.sectionOf(toKey("pear"))?.key).toBe("Fruit")
    const nodes = [...c].map((n) => n.type)
    expect(nodes).toEqual(["section", "item", "item"])
  })

  it("Constant-time navigation", () => {
    const c = make(Array.from({ length: 10_000 }, (_, i) => row(`k${i}`)))
    const first = toKey("k1")
    const last = toKey("k9999")
    const time = (key: typeof first) => {
      const t = performance.now()
      for (let i = 0; i < 100_000; i++) c.keyAfter(key)
      return performance.now() - t
    }
    time(first) // warm up
    const a = time(first)
    const b = time(last)
    expect(c.keyAfter(toKey("k9998"))).toBe("k9999")
    expect(c.keyAfter(last)).toBeNull()
    expect(Math.max(a, b) / Math.max(Math.min(a, b), 0.01)).toBeLessThan(5)
  })

  it("lookups, ends and neighbours", () => {
    const c = make([row("a"), row("b"), row("c")])
    expect(c.firstKey()).toBe("a")
    expect(c.lastKey()).toBe("c")
    expect(c.keyBefore(toKey("a"))).toBeNull()
    expect(c.keyBefore(toKey("c"))).toBe("b")
    expect(c.keyAfter(toKey("zzz"))).toBeNull()
    expect(c.has(toKey("b"))).toBe(true)
    expect(c.get(toKey("b"))?.setSize).toBe(3)
    expect(c.get(toKey("b"))?.setIndex).toBe(1)
    expect(make([]).firstKey()).toBeNull()
  })

  it("Filter renumbers", () => {
    const c = make([row("a"), row("b"), row("c"), row("d")])
    const f = c.filter((n) => n.key === "b" || n.key === "d")
    expect(f.get(toKey("d"))?.index).toBe(1)
    expect(f.get(toKey("d"))?.setIndex).toBe(1)
    expect(f.get(toKey("d"))?.setSize).toBe(2)
    expect(f.size).toBe(2)
  })

  it("Empty section dropped", () => {
    const c = make([row("a", { section: "S1" }), row("b", { section: "S2" })])
    const f = c.filter((n) => n.key === "b")
    expect(f.sections().map((s) => s.key)).toEqual(["S2"])
    expect([...f].map((n) => n.type)).toEqual(["section", "item"])
  })

  it("Keywords are not typeahead", () => {
    const c = make([row("a", { text: "Apple", keywords: ["fruit"] })])
    expect(c.get(toKey("a"))?.keywords).toEqual(["fruit"])
    expect(c.get(toKey("a"))?.textValue).toBe("Apple")
  })

  it("Derivations leave the original unchanged", () => {
    const c = make([row("a"), row("b"), row("c")])
    c.filter(() => false)
    c.insert(0, row("x"))
    c.remove(toKey("a"))
    c.move(toKey("a"), 2)
    expect(keys(c)).toEqual(["a", "b", "c"])
  })

  it("insert, remove and move", () => {
    const c = make([row("a"), row("b"), row("c")])
    expect(keys(c.insert(1, row("x"), row("y")))).toEqual(["a", "x", "y", "b", "c"])
    expect(keys(c.insert(0, row("x")))).toEqual(["x", "a", "b", "c"])
    expect(keys(c.remove(toKey("a"), toKey("c")))).toEqual(["b"])
    expect(keys(c.move(toKey("a"), 2))).toEqual(["b", "c", "a"])
    expect(keys(c.move(toKey("c"), 0))).toEqual(["c", "a", "b"])
    expect(c.move(toKey("nope"), 0)).toBe(c)
  })

  it("sectionless items keep their place and sections group", () => {
    const c = make([row("a", { section: "S" }), row("b"), row("c", { section: "S" })])
    expect(keys(c)).toEqual(["a", "c", "b"])
  })
})
