import { describe, expect, it } from "vitest"
import { toKey } from "./key"
import { type Collection, createListCollection } from "./list"
import {
  DEFAULT_PAGE_SIZE,
  type Move,
  type MoveOptions,
  move,
  navigableWhen,
  repair,
  treeMove,
} from "./navigation"
import { createTreeCollection } from "./tree"

interface Row {
  id: string
  disabled?: boolean
}

const list = (ids: string[], disabled: string[] = []): Collection<Row> =>
  createListCollection<Row>({
    items: ids.map((id) => ({ id, disabled: disabled.includes(id) })),
    getKey: (r) => r.id,
    getText: (r) => r.id,
    isDisabled: (r) => r.disabled === true,
  })

const nums = (n: number, disabled: number[] = []) =>
  list(
    Array.from({ length: n }, (_, i) => String(i + 1)),
    disabled.map(String),
  )

const nav = navigableWhen(false)
const opts = (over: Partial<MoveOptions> = {}): MoveOptions => ({
  loop: false,
  navigable: nav,
  ...over,
})
const go = (c: Collection<unknown>, from: string | null, m: Move, o: Partial<MoveOptions> = {}) =>
  move(c, from === null ? null : toKey(from), m, opts(o))

describe("move", () => {
  it("next, previous, first, last", () => {
    const c = list(["a", "b", "c"])
    expect(go(c, "a", "next")).toBe("b")
    expect(go(c, "c", "previous")).toBe("b")
    expect(go(c, "b", "first")).toBe("a")
    expect(go(c, "b", "last")).toBe("c")
    expect(go(c, null, "next")).toBe("a")
    expect(go(c, null, "previous")).toBe("c")
  })

  it("No loop: next on the last item stays", () => {
    const c = list(["a", "b", "c"])
    expect(go(c, "c", "next")).toBe("c")
    expect(go(c, "a", "previous")).toBe("a")
  })

  it("Loop wraps both ways", () => {
    const c = list(["a", "b", "c"])
    expect(go(c, "c", "next", { loop: true })).toBe("a")
    expect(go(c, "a", "previous", { loop: true })).toBe("c")
  })

  it("Page without layout: ten navigable items or the last", () => {
    const c = nums(30)
    expect(DEFAULT_PAGE_SIZE).toBe(10)
    expect(go(c, "1", "page-next")).toBe("11")
    expect(go(c, "25", "page-next")).toBe("30")
    expect(go(c, "30", "page-previous")).toBe("20")
    expect(go(c, "3", "page-previous")).toBe("1")
    expect(go(c, "1", "page-next", { pageSize: 3 })).toBe("4")
    // Disabled items do not count toward the ten.
    expect(go(nums(30, [2, 3]), "1", "page-next")).toBe("13")
    // Pages never loop.
    expect(go(c, "30", "page-next", { loop: true })).toBe("30")
  })

  it("page uses the measured target when given", () => {
    const c = nums(30)
    expect(go(c, "1", "page-next", { pageTarget: toKey("7") })).toBe("7")
    const d = nums(30, [7])
    expect(go(d, "1", "page-next", { pageTarget: toKey("7") })).toBe("8")
  })

  it("All disabled: moves return null and do not hang", () => {
    const c = nums(5, [1, 2, 3, 4, 5])
    for (const m of ["next", "previous", "first", "last", "page-next", "page-previous"] as const) {
      expect(go(c, null, m)).toBeNull()
      expect(go(c, null, m, { loop: true })).toBeNull()
    }
    expect(go(c, "2", "next", { loop: true })).toBe("2")
    expect(go(nums(0), null, "next", { loop: true })).toBeNull()
  })

  it("Run of disabled items", () => {
    const c = nums(8, [2, 3, 4, 5])
    expect(go(c, "1", "next")).toBe("6")
    expect(go(c, "6", "previous")).toBe("1")
  })

  it("focusableWhenDisabled keeps disabled items reachable", () => {
    const c = nums(4, [2])
    expect(go(c, "1", "next", { navigable: navigableWhen(true) })).toBe("2")
  })

  it("expand and collapse are no-ops for a list", () => {
    const c = list(["a", "b"])
    expect(go(c, "a", "expand")).toBe("a")
    expect(go(c, null, "collapse")).toBeNull()
  })
})

describe("repair", () => {
  const c = list(["a", "b", "c"])

  it("Insertion before highlight keeps the key", () => {
    const next = c.insert(0, { id: "z" })
    expect(repair(c, next, toKey("b"), nav)).toBe("b")
  })

  it("Delete the focused tag: the next one", () => {
    expect(repair(c, c.remove(toKey("b")), toKey("b"), nav)).toBe("c")
  })

  it("Delete the last tag: the previous one", () => {
    expect(repair(c, c.remove(toKey("c")), toKey("c"), nav)).toBe("b")
  })

  it("Delete next to disabled items: nearest navigable before, no hang", () => {
    const d = nums(5, [4, 5])
    const next = d.remove(toKey("3"))
    expect(repair(d, next, toKey("3"), nav)).toBe("2")
  })

  it("none when nothing is left, or the key is null or unknown to prev", () => {
    expect(repair(c, c.remove(toKey("a"), toKey("b"), toKey("c")), toKey("b"), nav)).toBeNull()
    expect(repair(c, c, null, nav)).toBeNull()
    expect(repair(null, c.remove(toKey("a")), toKey("a"), nav)).toBeNull()
  })

  it("a key that became non-navigable is repaired too", () => {
    const next = nums(3, [2])
    expect(repair(nums(3), next, toKey("2"), nav)).toBe("3")
  })
})

describe("treeMove", () => {
  interface N {
    id: string
    children?: N[]
  }
  const tree = createTreeCollection<N>({
    roots: [{ id: "src", children: [{ id: "a.ts" }, { id: "b.ts" }] }, { id: "README" }],
    getKey: (n) => n.id,
    getText: (n) => n.id,
    getChildren: (n) => n.children,
  })
  const exp = (...k: string[]) => new Set(k.map(toKey))

  it("Collapse moves to parent", () => {
    expect(treeMove(tree, exp("src"), toKey("a.ts"), "collapse", nav)).toEqual({
      highlight: "src",
    })
  })

  it("collapse on a root leaf stays", () => {
    expect(treeMove(tree, exp(), toKey("README"), "collapse", nav)).toEqual({
      highlight: "README",
    })
  })

  it("collapse an expanded branch collapses it", () => {
    expect(treeMove(tree, exp("src"), toKey("src"), "collapse", nav)).toEqual({
      highlight: "src",
      collapse: "src",
    })
  })

  it("collapse a collapsed branch with a parent moves to the parent only when nested", () => {
    expect(treeMove(tree, exp(), toKey("src"), "collapse", nav)).toEqual({ highlight: "src" })
  })

  it("Expand collapsed: expands", () => {
    expect(treeMove(tree, exp(), toKey("src"), "expand", nav)).toEqual({
      highlight: "src",
      expand: "src",
    })
  })

  it("Expand expanded: first child", () => {
    expect(treeMove(tree, exp("src"), toKey("src"), "expand", nav)).toEqual({
      highlight: "a.ts",
    })
  })

  it("expand a leaf stays; unknown or null from stays", () => {
    expect(treeMove(tree, exp(), toKey("README"), "expand", nav)).toEqual({ highlight: "README" })
    expect(treeMove(tree, exp(), null, "expand", nav)).toEqual({ highlight: null })
  })

  it("Ancestor collapses under the highlight: repair via nearestVisible", () => {
    const expanded = exp("src")
    const before = tree.visible(expanded)
    expect(before.has(toKey("a.ts"))).toBe(true)
    const collapsed = exp()
    expect(tree.visible(collapsed).has(toKey("a.ts"))).toBe(false)
    expect(tree.nearestVisible(toKey("a.ts"), collapsed)).toBe("src")
    // Full-collection presence + nearestVisible, as the spec orders it.
    expect(repair(before, tree.visible(collapsed), toKey("a.ts"), nav)).toBe("README")
  })
})
