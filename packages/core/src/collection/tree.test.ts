import { describe, expect, it } from "vitest"
import { toKey } from "./key"
import { createTreeCollection, type TreeCollection } from "./tree"

interface Node {
  id: string
  children?: Node[]
  unloaded?: boolean
}

const n = (id: string, children?: Node[], extra: Partial<Node> = {}): Node => ({
  id,
  ...(children ? { children } : {}),
  ...extra,
})

const build = (roots: Node[]): TreeCollection<Node> =>
  createTreeCollection<Node>({
    roots,
    getKey: (x) => x.id,
    getText: (x) => x.id,
    getChildren: (x) => x.children,
    hasUnloadedChildren: (x) => x.unloaded === true,
  })

const sample = () =>
  build([
    n("src", [n("a.ts"), n("lib", [n("b.ts")])]),
    n("README"),
    n("remote", undefined, { unloaded: true }),
  ])

const keys = (c: { size: number; at(i: number): { key: string } | undefined }) =>
  Array.from({ length: c.size }, (_, i) => c.at(i)?.key)
const set = (...k: string[]) => new Set(k.map(toKey))

describe("tree collection", () => {
  it("exposes parent, children, level and sibling position", () => {
    const t = sample()
    expect(keys(t)).toEqual(["src", "a.ts", "lib", "b.ts", "README", "remote"])
    expect(t.parent(toKey("b.ts"))).toBe("lib")
    expect(t.parent(toKey("src"))).toBeNull()
    expect(t.children(toKey("src"))).toEqual(["a.ts", "lib"])
    expect(t.get(toKey("b.ts"))?.level).toBe(2)
    expect(t.get(toKey("lib"))?.setIndex).toBe(1)
    expect(t.get(toKey("lib"))?.setSize).toBe(2)
    expect(t.get(toKey("README"))?.setSize).toBe(3)
    expect(t.get(toKey("src"))?.hasChildren).toBe(true)
    expect(t.get(toKey("README"))?.hasChildren).toBe(false)
    expect(t.get(toKey("remote"))?.hasChildren).toBe(true)
  })

  it("Collapsed branch: descendants absent from visible()", () => {
    const t = sample()
    expect(keys(t.visible(set()))).toEqual(["src", "README", "remote"])
    expect(keys(t.visible(set("src")))).toEqual(["src", "a.ts", "lib", "README", "remote"])
    expect(keys(t.visible(set("src", "lib")))).toEqual([
      "src",
      "a.ts",
      "lib",
      "b.ts",
      "README",
      "remote",
    ])
    // An expanded key under a collapsed ancestor stays hidden.
    expect(keys(t.visible(set("lib")))).toEqual(["src", "README", "remote"])
  })

  it("nearestVisible: itself, else the outermost collapsed ancestor", () => {
    const t = sample()
    expect(t.nearestVisible(toKey("b.ts"), set("src", "lib"))).toBe("b.ts")
    expect(t.nearestVisible(toKey("a.ts"), set())).toBe("src")
    expect(t.nearestVisible(toKey("b.ts"), set("lib"))).toBe("src")
    expect(t.nearestVisible(toKey("b.ts"), set("src"))).toBe("lib")
    expect(t.nearestVisible(toKey("nope"), set())).toBeNull()
  })

  it("filter keeps ancestors of matches", () => {
    const f = sample().filter((x) => x.key === "b.ts")
    expect(keys(f)).toEqual(["src", "lib", "b.ts"])
  })

  it("remove drops the subtree", () => {
    expect(keys(sample().remove(toKey("src")))).toEqual(["README", "remote"])
  })

  it("insert and move act on roots, leaving the original unchanged", () => {
    const t = sample()
    expect(keys(t.insert(1, n("x")))).toEqual([
      "src",
      "a.ts",
      "lib",
      "b.ts",
      "x",
      "README",
      "remote",
    ])
    expect(keys(t.move(toKey("README"), 0))[0]).toBe("README")
    expect(t.move(toKey("nope"), 0)).toBe(t)
    expect(t.size).toBe(6)
  })
})
