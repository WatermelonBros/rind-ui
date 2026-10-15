import { describe, expect, it } from "vitest"
import { missingAriaLines } from "./aria-snapshot"

describe("partial ARIA snapshots", () => {
  const expected = '- button "Details" [expanded]\n- text: Body text\n'
  it("extra nodes in the actual tree do not fail", () => {
    expect(
      missingAriaLines(
        '- generic\n- button "Details" [expanded]\n- text: Body text\n- text: x',
        expected,
      ),
    ).toEqual([])
  })
  it("a missing state, name or order fails with the line", () => {
    expect(missingAriaLines('- button "Details"\n- text: Body text', expected)).toEqual([
      '- button "Details" [expanded]',
    ])
    expect(missingAriaLines('- text: Body text\n- button "Details" [expanded]', expected)).toEqual([
      "- text: Body text",
    ])
  })
})
