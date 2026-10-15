import { describe, expect, it } from "vitest"
import { encodeKey, itemId, partId } from "./ids"

describe("ids", () => {
  it("part and item ids", () => {
    expect(partId("dialog", "r1", "title")).toBe("dialog-r1-title")
    expect(itemId("listbox", "r1", "option", "apple")).toBe("listbox-r1-option-apple")
  })

  it("a key with a space has no whitespace in its id", () => {
    const id = itemId("listbox", "r1", "option", "New York")
    expect(id).not.toMatch(/\s/)
    expect(id).toBe("listbox-r1-option-New_20_York")
  })

  it("distinct keys never collide", () => {
    const keys = ["a b", "a-b", "a_b", "a_20_b", "a\tb", "é", "é", "", "_", "__"]
    const ids = keys.map((k) => encodeKey(k))
    expect(new Set(ids).size).toBe(keys.length)
  })

  it("is pure: the same string in Node and the browser", () => {
    // No locale, environment or global is read: the browser projects run ids.dom.test.ts.
    expect(itemId("s", ":r0:", "item", 42)).toBe("s-:r0:-item-42")
  })
})
