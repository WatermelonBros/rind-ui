// Label root props need no DOM (openspec label "Native Association", "Ids").
import { describe, expect, it } from "vitest"
import { labelConnect, labelForwardsFocus } from "./label.connect"

const base = { instance: "i1", id: "i1", tag: "label", forwardsFocus: false } as const

describe("labelConnect", () => {
  it("carries scope attributes, id, and for", () => {
    const p = labelConnect({ ...base, htmlFor: "email" })
    expect(p).toMatchObject({
      "data-scope": "label",
      "data-part": "root",
      "data-instance": "i1",
      id: "i1",
      for: "email",
    })
  })

  it("never has a role or any aria attribute (radix#638)", () => {
    for (const tag of ["label", "span", "div"]) {
      for (const forwardsFocus of [true, false]) {
        const keys = Object.keys(labelConnect({ ...base, htmlFor: "x", tag, forwardsFocus }))
        expect(keys.filter((k) => k === "role" || k.startsWith("aria-"))).toEqual([])
      }
    }
  })

  it("drops for when focus is forwarded", () => {
    expect(labelConnect({ ...base, htmlFor: "x", forwardsFocus: true })["for"]).toBeUndefined()
  })

  it("drops for on a tag that is not a label", () => {
    expect(labelConnect({ ...base, htmlFor: "x", tag: "span" })["for"]).toBeUndefined()
  })

  it("has no for when none is given", () => {
    expect(labelConnect(base)["for"]).toBeUndefined()
  })
})

describe("labelForwardsFocus", () => {
  it.each([
    ["label", false, false],
    ["label", true, true],
    ["span", false, true],
    ["div", true, true],
  ] as const)("%s, non-labelable %s -> %s", (tag, nonLabelable, expected) => {
    expect(labelForwardsFocus(tag, nonLabelable)).toBe(expected)
  })
})
