// Needs real layout: jsdom reports zero rects, which is exactly the null case.
import { afterEach, describe, expect, it } from "vitest"
import { toKey } from "../collection/key"
import { collectionLayout } from "./collection-layout"

const layout = collectionLayout({
  getRootNode: () => document,
  getById: (id) => document.getElementById(id),
  activeElement: () => document.activeElement,
})

function mount(listHeight: string, itemHeight: string, count = 40) {
  const list = document.createElement("div")
  list.id = "pl"
  list.style.cssText = `height:${listHeight};overflow-y:auto;margin:0`
  for (let i = 0; i < count; i++) {
    const item = document.createElement("div")
    item.dataset["key"] = `k${i}`
    item.style.cssText = `height:${itemHeight};margin:0`
    list.append(item)
  }
  document.body.style.margin = "0"
  document.body.append(list)
  return list
}

afterEach(() => {
  document.body.innerHTML = ""
  document.body.style.margin = ""
})

describe("collectionLayout.pageTarget", () => {
  it("returns the item one visible area further in a scrolling list", () => {
    mount("200px", "20px") // 10 items visible
    expect(layout.pageTarget("pl", toKey("k0"), "next")).toBe("k9")
    expect(layout.pageTarget("pl", toKey("k30"), "previous")).toBe("k21")
  })

  it("clamps at the ends", () => {
    mount("200px", "20px")
    expect(layout.pageTarget("pl", toKey("k35"), "next")).toBe("k39")
    expect(layout.pageTarget("pl", toKey("k3"), "previous")).toBe("k0")
  })

  it("is null in a zero-size list", () => {
    mount("0px", "0px")
    expect(layout.pageTarget("pl", toKey("k0"), "next")).toBeNull()
  })

  it("is null for an unknown list or key", () => {
    mount("200px", "20px")
    expect(layout.pageTarget("missing", toKey("k0"), "next")).toBeNull()
    expect(layout.pageTarget("pl", toKey("nope"), "next")).toBeNull()
  })
})
