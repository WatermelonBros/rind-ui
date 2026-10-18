import { afterEach, describe, expect, it, vi } from "vitest"
import { createItemRegistry, type RegisteredItem } from "./item-registry"

const tick = () => new Promise<void>((r) => queueMicrotask(r))

function setup() {
  const calls: (readonly RegisteredItem[])[] = []
  const registry = createItemRegistry((items) => calls.push(items))
  const el = (text = "", tag = "li") => {
    const e = document.createElement(tag)
    e.textContent = text
    document.body.append(e)
    return e
  }
  return { calls, registry, el }
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("createItemRegistry", () => {
  it("the first flush reports even with no items: an empty root is empty, not pending", () => {
    const { calls, registry } = setup()
    registry.flush()
    expect(calls).toEqual([[]])
    registry.flush()
    expect(calls).toHaveLength(1)
  })

  it("flushes once per batch: 1,000 registrations in one microtask call onChange once", async () => {
    const { calls, registry, el } = setup()
    for (let i = 0; i < 1000; i++) registry.register({ key: `k${i}`, element: el(`item ${i}`) })
    expect(calls).toHaveLength(0)
    await tick()
    await tick()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveLength(1000)
    expect(calls[0]?.[999]?.key).toBe("k999")
  })

  it("sorts into document order when registered out of order (item inserted before the others)", async () => {
    const { calls, registry, el } = setup()
    const a = el("a")
    const b = el("b")
    const c = el("c")
    registry.register({ key: "c", element: c })
    registry.register({ key: "a", element: a })
    registry.register({ key: "b", element: b })
    await tick()
    expect(calls[0]?.map((i) => i.key)).toEqual(["a", "b", "c"])
    // A later commit inserts an item before all the others.
    const z = document.createElement("li")
    z.textContent = "z"
    document.body.prepend(z)
    registry.register({ key: "z", element: z })
    await tick()
    expect(calls[1]?.map((i) => i.key)).toEqual(["z", "a", "b", "c"])
  })

  it("unregister removes the item in the next flush; a stale unregister is ignored", async () => {
    const { calls, registry, el } = setup()
    const a = el("a")
    const off = registry.register({ key: "a", element: a })
    registry.register({ key: "b", element: el("b") })
    await tick()
    off()
    await tick()
    expect(calls[1]?.map((i) => i.key)).toEqual(["b"])
    // Re-registering the same element replaces it; the old removal must not remove the new one.
    const offOld = registry.register({ key: "x", element: a })
    registry.register({ key: "y", element: a })
    await tick()
    offOld()
    await tick()
    expect(calls.at(-1)?.map((i) => i.key)).toContain("y")
  })

  it("text defaults to the trimmed textContent; an explicit textValue wins", async () => {
    const { calls, registry, el } = setup()
    registry.register({ key: "a", element: el("  Apple \n") })
    registry.register({ key: "b", textValue: "Bee", element: el("ignored") })
    await tick()
    expect(calls[0]?.map((i) => i.textValue)).toEqual(["Apple", "Bee"])
  })

  it("warns once in development for an item without text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { registry, el } = setup()
    registry.register({ key: "empty", element: el("") })
    await tick()
    registry.register({ key: "other", element: el("ok") })
    await tick()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('item "empty" has no text value')
  })

  it("does not warn when textValue is given", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { registry, el } = setup()
    registry.register({ key: "icon", textValue: "Settings", element: el("") })
    await tick()
    expect(warn).not.toHaveBeenCalled()
  })
})
