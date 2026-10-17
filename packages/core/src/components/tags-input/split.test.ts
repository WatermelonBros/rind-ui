import { describe, expect, it } from "vitest"
import { defaultPasteDelimiters, hasDelimiter, joiner, splitDelimited } from "./split"

describe("splitDelimited", () => {
  it("default comma: complete segments and the rest", () => {
    expect(splitDelimited("a,b,c", ",")).toEqual({ complete: ["a", "b"], rest: "c" })
    expect(splitDelimited("rome,", ",")).toEqual({ complete: ["rome"], rest: "" })
    expect(splitDelimited("rome", ",")).toEqual({ complete: [], rest: "rome" })
  })

  it("literal strings: | + . are not regular expressions", () => {
    expect(splitDelimited("a|b|", "|")).toEqual({ complete: ["a", "b"], rest: "" })
    expect(splitDelimited("a+b", "+")).toEqual({ complete: ["a"], rest: "b" })
    expect(splitDelimited("a.b,c", ".")).toEqual({ complete: ["a"], rest: "b,c" })
  })

  it("RegExps and lists; the earliest match wins; zero-length matches are ignored", () => {
    expect(splitDelimited("a b,c", [/\s/, ","])).toEqual({ complete: ["a", "b"], rest: "c" })
    expect(splitDelimited("abc", /x*/g)).toEqual({ complete: [], rest: "abc" })
    // A global RegExp keeps no state between calls.
    const g = /,/g
    expect(splitDelimited("a,b", g)).toEqual(splitDelimited("a,b", g))
  })

  it("paste delimiters, detection and the joiner", () => {
    const p = defaultPasteDelimiters(",")
    expect(splitDelimited("jane@x.io, john@x.io\nalex@x.io", p).complete).toEqual([
      "jane@x.io",
      " john@x.io",
    ])
    expect(hasDelimiter("foo", p)).toBe(false)
    expect(hasDelimiter("a;b", p)).toBe(true)
    expect(joiner([/\s/, ","])).toBe(",")
  })
})
