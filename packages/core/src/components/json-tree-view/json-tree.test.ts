import { describe, expect, it } from "vitest"
import {
  type JsonNode,
  jsonCopyText,
  jsonExpandedKeys,
  jsonRoots,
  jsonStringify,
  jsonTreeCollection,
  jsonType,
  jsonValueText,
} from "./json-tree"
import { jsonItemConnect } from "./json-tree-view.connect"
import { jsonTreeViewMessages } from "./json-tree-view.messages"

const all = (nodes: readonly JsonNode[]): JsonNode[] =>
  nodes.flatMap((n) => [n, ...all(n.children)])
const keys = (nodes: readonly JsonNode[]) => all(nodes).map((n) => n.key)

describe("json tree model", () => {
  it("keys are JSON Pointers: no dotted-path collision (Zag)", () => {
    const value = { "a.b": 1, a: { b: 2 }, "x/y": 3, "~": 4 }
    const roots = jsonRoots(value, { expanded: new Set(["/a"]) })
    expect(keys(roots)).toEqual(["/a.b", "/a", "/a/b", "/x~1y", "/~0"])
  })

  it("builds children only for expanded containers", () => {
    const big = { list: Array.from({ length: 100_000 }, (_, i) => ({ i })) }
    const roots = jsonRoots(big, { expanded: new Set() })
    expect(all(roots)).toHaveLength(1)
    expect(roots[0]).toMatchObject({ type: "array", count: 100_000, branch: true })
  })

  it("groups large containers in nested inclusive ranges", () => {
    const value = { list: Array.from({ length: 250 }, (_, i) => i) }
    const roots = jsonRoots(value, { expanded: new Set(["/list"]) })
    const ranges = roots[0]?.children ?? []
    expect(ranges.map((r) => r.range)).toEqual([
      { first: 0, last: 99 },
      { first: 100, last: 199 },
      { first: 200, last: 249 },
    ])
    expect(ranges.map((r) => r.key)).toEqual(["/list#0-99", "/list#100-199", "/list#200-249"])
    const opened = jsonRoots(value, { expanded: new Set(["/list", "/list#100-199"]) })
    expect(opened[0]?.children[1]?.children[0]?.key).toBe("/list/100")
  })

  it("sparse arrays render their defined indexes; the summary counts the length", () => {
    // biome-ignore lint/suspicious/noSparseArray: the case under test
    const roots = jsonRoots({ s: [1, , 3] }, { expanded: new Set(["/s"]) })
    expect(roots[0]?.count).toBe(3)
    expect(roots[0]?.children.map((c) => c.label)).toEqual(["0", "2"])
  })

  it("a cycle is an ancestor only; shared values render normally (Zag)", () => {
    const shared = { x: 1 }
    const loop: Record<string, unknown> = { shared, again: shared }
    loop["self"] = loop
    const roots = jsonRoots(loop, { expanded: new Set(["/shared", "/again"]) })
    expect(roots.map((r) => [r.label, r.type])).toEqual([
      ["shared", "object"],
      ["again", "object"],
      ["self", "circular"],
    ])
  })

  it("types and exact value texts", () => {
    expect(jsonType(10n)).toBe("bigint")
    expect(jsonType(new Map())).toBe("map")
    expect(jsonType(new (class Thing {})())).toBe("instance")
    expect(jsonValueText({ type: "bigint", value: 12345678901234567890n })).toBe(
      "12345678901234567890",
    )
    expect(jsonValueText({ type: "number", value: -0 })).toBe("-0")
    expect(jsonValueText({ type: "string", value: 'a\n"b"' })).toBe('a\\n\\"b\\"')
    expect(jsonValueText({ type: "date", value: new Date(0) })).toBe("1970-01-01T00:00:00.000Z")
  })

  it("a primitive top-level value is one leaf", () => {
    expect(jsonRoots(42, { expanded: new Set() })).toMatchObject([{ key: "", type: "number" }])
  })

  it("the collection marks closed containers as branches", () => {
    const tree = jsonTreeCollection({ a: { b: 1 }, c: 2 }, { expanded: new Set() })
    expect(tree.size).toBe(2)
  })

  it("expandAll is bounded", () => {
    const deep = {
      list: Array.from({ length: 50 }, () => ({ inner: Array.from({ length: 200 }, (_, i) => i) })),
    }
    const opened = jsonExpandedKeys(deep, 5, { max: 500 })
    const visible = all(jsonRoots(deep, { expanded: new Set(opened) })).length
    expect(visible).toBeLessThanOrEqual(500)
    expect(opened).toContain("/list")
  })
})

describe("json copy", () => {
  it("serialises BigInt as digits, Map and Set as entries", () => {
    expect(jsonStringify({ n: 10n, m: new Map([["k", 1]]), s: new Set([1]) }, 0)).toBe(
      '{"n":10,"m":[["k",1]],"s":[1]}',
    )
  })

  it("a cycle throws (the copy state is error, never a false success)", () => {
    const loop: Record<string, unknown> = {}
    loop["me"] = loop
    expect(() => jsonStringify(loop)).toThrow()
  })

  it("formats: json, value, pointer", () => {
    const [leaf] = jsonRoots({ street: "Main" }, { expanded: new Set() })
    if (!leaf) throw new Error("no leaf")
    expect(jsonCopyText(leaf, "json")).toBe('"Main"')
    expect(jsonCopyText(leaf, "value")).toBe("Main")
    expect(jsonCopyText(leaf, "pointer")).toBe("/street")
  })
})

describe("json item text", () => {
  it("a container's name is its key and spoken summary; glyph and preview hidden", () => {
    const [node] = jsonRoots({ address: { a: 1, b: 2, c: 3, d: 4 } }, { expanded: new Set() })
    if (!node) throw new Error("no node")
    const api = jsonItemConnect({ instance: "j", node, messages: jsonTreeViewMessages })
    expect(api.keyText).toBe("address")
    expect(api.summaryText).toBe("object, 4 entries")
    expect(api.summaryGlyph).toBe("{4}")
    expect(api.previewText).toBe("a, b, c, …")
    expect(api.summary()["aria-hidden"]).toBe("true")
    expect(api.preview()["aria-hidden"]).toBe("true")
    expect(api.item()).toMatchObject({ "data-type": "object", "data-key": "/address" })
  })

  it("a null leaf carries its type for styling", () => {
    const [node] = jsonRoots({ x: null }, { expanded: new Set() })
    if (!node) throw new Error("no node")
    const api = jsonItemConnect({ instance: "j", node, messages: jsonTreeViewMessages })
    expect(api.value()["data-type"]).toBe("null")
    expect(api.valueText).toBe("null")
  })
})
