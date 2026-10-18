import { describe, expect, expectTypeOf, it } from "vitest"
import {
  lineRuns,
  parseRanges,
  splitLines,
  type TrustedCodeHtml,
  trustedCodeHtml,
} from "./code-block.lines"
import { codeBlockMessages } from "./code-block.messages"

describe("splitLines", () => {
  it("keeps empty lines in place (rehype-pretty-code#157)", () => {
    expect(splitLines("a\n\nb")).toEqual(["a", "", "b"])
  })
  it("normalises CRLF and CR (rehype-pretty-code#180)", () => {
    expect(splitLines("a\r\nb\r\n")).toEqual(["a", "b"])
    expect(splitLines("a\rb")).toEqual(["a", "b"])
  })
  it("drops one trailing newline only", () => {
    expect(splitLines("a\n")).toEqual(["a"])
    expect(splitLines("a\n\n")).toEqual(["a", ""])
    expect(splitLines("")).toEqual([""])
  })
})

describe("parseRanges", () => {
  it("includes both ends (rehype-pretty-code#238)", () => {
    expect([...parseRanges([[2, 4]])]).toEqual([2, 3, 4])
  })
  it("mixes numbers and ranges; reversed ranges read low to high", () => {
    expect([...parseRanges([3, [7, 5]])].sort()).toEqual([3, 5, 6, 7])
    expect(parseRanges(undefined).size).toBe(0)
  })
  it("runs and the description", () => {
    const runs = lineRuns(parseRanges([3, [5, 7]]))
    expect(runs).toEqual([
      [3, 3],
      [5, 7],
    ])
    expect(codeBlockMessages.highlighted(runs)).toBe("Highlighted lines: 3, 5 to 7")
  })
})

describe("trustedCodeHtml", () => {
  it("splits a string per line, keeps a per-line array", () => {
    expect(trustedCodeHtml("<b>a</b>\r\nb\n").lines).toEqual(["<b>a</b>", "b"])
    expect(trustedCodeHtml(["x", "y"]).lines).toEqual(["x", "y"])
  })
  it("a tag spanning lines is closed and reopened per line", () => {
    expect(trustedCodeHtml('<span class="s">"a\nb"</span> c\n<br/>d').lines).toEqual([
      '<span class="s">"a</span>',
      '<span class="s">b"</span> c',
      "<br/>d",
    ])
  })
  it("a raw string is not TrustedCodeHtml", () => {
    expectTypeOf<string>().not.toMatchTypeOf<TrustedCodeHtml>()
    expectTypeOf(trustedCodeHtml("x")).toEqualTypeOf<TrustedCodeHtml>()
  })
})
