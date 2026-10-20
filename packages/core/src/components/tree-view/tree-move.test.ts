import { describe, expect, it } from "vitest"
import { createTreeCollection } from "../../collection/tree"
import { moveNode, moveTarget, pointerTarget, type TreeMoveData } from "./tree-move"

interface Node extends TreeMoveData {
  readonly key: string
  readonly children?: readonly Node[]
  readonly isBranch?: boolean
}

const DATA: Node[] = [
  { key: "a" },
  {
    key: "docs",
    isBranch: true,
    children: [{ key: "docs/intro" }, { key: "docs/api" }],
  },
  { key: "notes" },
  { key: "empty", isBranch: true, children: [] },
]

const tree = (data: readonly Node[] = DATA) =>
  createTreeCollection<Node>({
    roots: data,
    getKey: (n) => n.key,
    getText: (n) => n.key,
    getChildren: (n) => n.children,
    hasUnloadedChildren: (n) => n.isBranch === true,
  })

const shape = (nodes: readonly Node[]): unknown =>
  nodes.map((n) => (n.children ? [n.key, shape(n.children)] : n.key))

describe("moveTarget (outliner keys)", () => {
  it("up / down among siblings; a root reorder moves one place (React Aria #8561)", () => {
    const t = tree()
    expect(moveTarget(t, "a", "down")).toEqual({ parent: null, index: 1 })
    expect(shape(moveNode(DATA, "a", { parent: null, index: 1 }))).toEqual([
      ["docs", ["docs/intro", "docs/api"]],
      "a",
      "notes",
      ["empty", []],
    ])
    expect(moveTarget(t, "a", "up")).toBeNull()
    expect(moveTarget(t, "empty", "down")).toBeNull()
  })

  it("in: the end of the previous sibling branch; out: after the parent", () => {
    const t = tree()
    expect(moveTarget(t, "notes", "in")).toEqual({ parent: "docs", index: 2 })
    expect(moveTarget(t, "docs", "in")).toBeNull()
    expect(moveTarget(t, "docs/api", "out")).toEqual({ parent: null, index: 2 })
    expect(moveTarget(t, "a", "out")).toBeNull()
  })
})

describe("pointerTarget", () => {
  it("before / after a row; inside a branch at its end", () => {
    const t = tree()
    expect(pointerTarget(t, "a", "notes", "before", false)).toEqual({ parent: null, index: 1 })
    expect(pointerTarget(t, "a", "notes", "after", false)).toEqual({ parent: null, index: 2 })
    expect(pointerTarget(t, "notes", "empty", "inside", false)).toEqual({
      parent: "empty",
      index: 0,
    })
  })

  it("after an expanded branch with children is its first child's place", () => {
    expect(pointerTarget(tree(), "notes", "docs", "after", true)).toEqual({
      parent: "docs",
      index: 0,
    })
  })

  it("never into its own subtree (React Aria #9841)", () => {
    const t = tree()
    expect(pointerTarget(t, "docs", "docs/api", "before", false)).toBeNull()
    expect(pointerTarget(t, "docs", "docs", "inside", true)).toBeNull()
    // A child before its single parent is fine.
    expect(pointerTarget(t, "docs/api", "docs", "before", true)).toEqual({
      parent: null,
      index: 1,
    })
  })
})

describe("moveNode", () => {
  it("moves into a nested parent and keeps everything else", () => {
    expect(shape(moveNode(DATA, "notes", { parent: "docs", index: 1 }))).toEqual([
      "a",
      ["docs", ["docs/intro", "notes", "docs/api"]],
      ["empty", []],
    ])
  })
})
