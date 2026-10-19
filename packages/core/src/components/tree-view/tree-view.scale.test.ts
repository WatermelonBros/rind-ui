// tree-view-virtualization 1.3: building a 70,000-node tree and its visible list stays linear.
// Counted, not timed: the work per node (calls into the data accessors) is the same for a tree
// ten times smaller, so the build is linear in the node count.
import { describe, expect, it } from "vitest"
import { createTreeCollection } from "../../collection/tree"
import { visibleOf } from "./tree-view.machine"

interface Node {
  readonly key: string
  readonly children?: readonly Node[]
}

/** `folders` folders of 99 files: `folders * 100` nodes. */
const data = (folders: number): readonly Node[] =>
  Array.from({ length: folders }, (_, i) => ({
    key: `f${i}`,
    children: Array.from({ length: 99 }, (_, j) => ({ key: `f${i}-${j}` })),
  }))

/** The visible list with every branch expanded, and how many accessor calls it took. */
const build = (roots: readonly Node[]) => {
  let calls = 0
  const count = <T>(value: T): T => {
    calls++
    return value
  }
  const tree = createTreeCollection<Node>({
    roots,
    getKey: (n) => count(n.key),
    getText: (n) => count(n.key),
    getChildren: (n) => count(n.children),
  })
  const visible = visibleOf(
    tree,
    roots.map((r) => r.key),
  )
  return { visible, calls }
}

describe("tree view at scale", () => {
  it("70,000 nodes: every node visible, metadata from the data, constant work per node", () => {
    const big = build(data(700))
    expect(big.visible.size).toBe(70_000)
    const last = big.visible.at(69_999)
    expect(last?.key).toBe("f699-98")
    expect(last?.level).toBe(1)
    expect(last?.setIndex).toBe(98)
    expect(last?.setSize).toBe(99)
    const small = build(data(70))
    expect(big.calls / 70_000).toBe(small.calls / 7_000)
  })
})
