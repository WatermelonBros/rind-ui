// Tri-state checking (task 1.3): derived state, toggles, unloaded branches as leaves,
// disabled leaves, and both orders of reka-ui#1458.
import { describe, expect, it } from "vitest"
import { type CollectionKey, toKey } from "../../collection/key"
import { createTreeCollection } from "../../collection/tree"
import { normalise, stateOf, toggle } from "./check"

interface Row {
  readonly id: string
  readonly kids?: readonly Row[]
  readonly disabled?: boolean
  readonly lazy?: boolean
}
const treeOf = (roots: readonly Row[]) =>
  createTreeCollection<Row>({
    roots,
    getKey: (r) => r.id,
    getText: (r) => r.id,
    getChildren: (r) => r.kids,
    isDisabled: (r) => r.disabled === true,
    hasUnloadedChildren: (r) => r.lazy === true,
  })
const k = toKey
const set = (...keys: string[]) => new Set<CollectionKey>(keys.map(k))
const sorted = (s: ReadonlySet<CollectionKey>) => [...s].sort()

const src = treeOf([{ id: "src", kids: [{ id: "a" }, { id: "b" }] }, { id: "docs" }])

describe("check state", () => {
  it("a branch is derived from its leaves", () => {
    expect(stateOf(src, set(), k("src"))).toBe("false")
    expect(stateOf(src, set("a"), k("src"))).toBe("mixed")
    expect(stateOf(src, set("a", "b"), k("src"))).toBe("true")
  })

  it("mixed in both directions (reka-ui#1458)", () => {
    // One child first.
    const first = toggle(src, set(), k("a"))
    expect(stateOf(src, first, k("src"))).toBe("mixed")
    // The parent, then one child off.
    const all = toggle(src, set(), k("src"))
    const one = toggle(src, all, k("b"))
    expect(sorted(one)).toEqual(["a"])
    expect(stateOf(src, one, k("src"))).toBe("mixed")
  })

  it("a branch toggle checks leaves only (react-spectrum#6589)", () => {
    const three = treeOf([{ id: "src", kids: [{ id: "a" }, { id: "b" }, { id: "c" }] }])
    expect(sorted(toggle(three, set(), k("src")))).toEqual(["a", "b", "c"])
    expect(sorted(toggle(three, set("a", "b", "c"), k("src")))).toEqual([])
  })

  it("a disabled leaf keeps its state; the branch ends mixed", () => {
    const t = treeOf([{ id: "src", kids: [{ id: "a" }, { id: "b" }, { id: "x", disabled: true }] }])
    const next = toggle(t, set(), k("src"))
    expect(sorted(next)).toEqual(["a", "b"])
    expect(stateOf(t, next, k("src"))).toBe("mixed")
    // Toggling again clears the enabled leaves (they were all checked).
    expect(sorted(toggle(t, next, k("src")))).toEqual([])
  })

  it("an unloaded branch counts as a leaf; its children arriving show checked", () => {
    const before = treeOf([{ id: "src", lazy: true }])
    const checked = toggle(before, set(), k("src"))
    expect(sorted(checked)).toEqual(["src"])
    const after = treeOf([{ id: "src", kids: [{ id: "a" }, { id: "b" }] }])
    expect(stateOf(after, checked, k("a"))).toBe("true")
    expect(stateOf(after, checked, k("src"))).toBe("true")
    // A later toggle normalises the branch key into its leaves.
    expect(sorted(normalise(after, checked))).toEqual(["a", "b"])
    expect(sorted(toggle(after, checked, k("a")))).toEqual(["b"])
  })

  it("propagation none: each key is independent", () => {
    expect(sorted(toggle(src, set(), k("src"), "none"))).toEqual(["src"])
    expect(stateOf(src, set("src"), k("a"), "none")).toBe("false")
  })
})
