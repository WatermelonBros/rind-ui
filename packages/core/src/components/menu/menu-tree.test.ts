import { describe, expect, it, vi } from "vitest"
import { toKey as collectionKey } from "../../collection/key"
import { createMenuTree, type MenuLevelId, type MenuTreeLevel, menuLevelId } from "./menu-tree"

const level = (id: string, parent: string | null = null) => {
  const send = vi.fn()
  const trigger = vi.fn(() => null)
  const l: MenuTreeLevel = {
    id: menuLevelId(id),
    parent: parent === null ? null : menuLevelId(parent),
    trigger,
    send,
  }
  return { l, send, trigger }
}

const id = menuLevelId

describe("createMenuTree", () => {
  it("unregister removes the level and open-path entries where it is parent or child", () => {
    const tree = createMenuTree()
    const root = level("root")
    const a = level("a", "root")
    const b = level("b", "a")
    tree.register(root.l)
    const offA = tree.register(a.l)
    tree.register(b.l)
    tree.openChild(id("root"), id("a"))
    tree.openChild(id("a"), id("b"))
    expect(tree.openPath()).toEqual([id("a"), id("b")])
    offA()
    expect(tree.openPath()).toEqual([])
    // the level is gone: a sibling opening no longer reaches it
    tree.openChild(id("root"), id("a"))
    tree.openChild(id("root"), id("c"))
    expect(a.send).not.toHaveBeenCalled()
  })

  it("a stale unregister after re-register with the same id keeps the new level", () => {
    const tree = createMenuTree()
    const first = level("root")
    const second = level("root")
    const offFirst = tree.register(first.l)
    tree.register(second.l)
    offFirst()
    tree.closeTree("api")
    expect(second.send).toHaveBeenCalledWith({ type: "TREE.CLOSE", reason: "api" })
    expect(first.send).not.toHaveBeenCalled()
  })

  it("keeps one open child per parent and notifies only the previous sibling", () => {
    const tree = createMenuTree()
    const root = level("root")
    const a = level("a", "root")
    const b = level("b", "root")
    for (const x of [root, a, b]) tree.register(x.l)
    tree.openChild(id("root"), id("a"))
    expect(a.send).not.toHaveBeenCalled()
    tree.openChild(id("root"), id("a"))
    expect(a.send).not.toHaveBeenCalled()
    tree.openChild(id("root"), id("b"))
    expect(a.send).toHaveBeenCalledTimes(1)
    expect(a.send).toHaveBeenCalledWith({ type: "TREE.SIBLING_OPENED" })
    expect(b.send).not.toHaveBeenCalled()
    expect(root.send).not.toHaveBeenCalled()
    expect(tree.openPath()).toEqual([id("b")])
  })

  it("childClosed removes the child from the open path", () => {
    const tree = createMenuTree()
    tree.register(level("root").l)
    tree.openChild(id("root"), id("a"))
    tree.childClosed(id("a"))
    expect(tree.openPath()).toEqual([])
  })

  it("openPath lists open levels below the root, outermost first", () => {
    const tree = createMenuTree()
    tree.register(level("root").l)
    tree.openChild(id("root"), id("a"))
    tree.openChild(id("a"), id("b"))
    expect(tree.openPath()).toEqual([id("a"), id("b")])
  })

  it("closeTree sends TREE.CLOSE to the root only", () => {
    const tree = createMenuTree()
    const root = level("root")
    const a = level("a", "root")
    tree.register(root.l)
    tree.register(a.l)
    tree.closeTree("escape-key")
    expect(root.send).toHaveBeenCalledTimes(1)
    expect(root.send).toHaveBeenCalledWith({ type: "TREE.CLOSE", reason: "escape-key" })
    expect(a.send).not.toHaveBeenCalled()
  })

  it("rootTrigger returns the root level's trigger", () => {
    const tree = createMenuTree()
    expect(tree.rootTrigger()).toBeNull()
    const el = { tagName: "BUTTON" } as unknown as HTMLElement
    const root = level("root")
    root.trigger.mockReturnValue(el as never)
    tree.register(root.l)
    tree.register(level("a", "root").l)
    expect(tree.rootTrigger()).toBe(el)
  })

  it("a level registered after another submenu opened and closed can open (react-spectrum#9915)", () => {
    const tree = createMenuTree()
    tree.register(level("root").l)
    const a = level("a", "root")
    const offA = tree.register(a.l)
    tree.openChild(id("root"), id("a"))
    tree.childClosed(id("a"))
    offA()
    const b = level("b", "root")
    tree.register(b.l)
    tree.openChild(id("root"), id("b"))
    expect(tree.openPath()).toEqual([id("b")])
    expect(a.send).not.toHaveBeenCalled()
  })

  it("a sibling sweep leaves one open child and one SIBLING_OPENED per earlier sibling", () => {
    const tree = createMenuTree()
    tree.register(level("root").l)
    const ids: MenuLevelId[] = ["s1", "s2", "s3", "s4", "s5"].map(menuLevelId)
    const subs = ids.map((i) => level(i, "root"))
    for (const s of subs) tree.register(s.l)
    for (const i of ids) tree.openChild(id("root"), i)
    expect(tree.openPath()).toEqual([id("s5")])
    for (const s of subs.slice(0, 4)) {
      expect(s.send).toHaveBeenCalledTimes(1)
      expect(s.send).toHaveBeenCalledWith({ type: "TREE.SIBLING_OPENED" })
    }
    expect(subs[4]?.send).not.toHaveBeenCalled()
  })

  it("parent* delegate to the host", () => {
    const el = {} as HTMLElement
    const host = {
      elements: vi.fn(() => [el]),
      navigate: vi.fn(),
      press: vi.fn(),
    }
    const tree = createMenuTree({ parentKind: "menubar", host })
    const key = collectionKey("k")
    expect(tree.parentKind()).toBe("menubar")
    expect(tree.parentElements()).toEqual([el])
    tree.parentNavigate({ from: id("root"), direction: "expand" })
    expect(host.navigate).toHaveBeenCalledWith({ from: id("root"), direction: "expand" })
    tree.parentPress(key, "pointer")
    expect(host.press).toHaveBeenCalledWith(key, "pointer")
  })

  it("parent* default to null, [] and no-ops without a host", () => {
    const tree = createMenuTree()
    expect(tree.parentKind()).toBeNull()
    expect(tree.parentElements()).toEqual([])
    expect(() => tree.parentNavigate({ from: id("root"), direction: "collapse" })).not.toThrow()
    expect(() => tree.parentPress(collectionKey("k"), "keyboard")).not.toThrow()
  })
})
