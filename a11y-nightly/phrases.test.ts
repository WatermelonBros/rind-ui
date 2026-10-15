import { expect, it } from "vitest"
import { missingPhrases } from "./phrases"

it("matches key phrases by containment, in order", () => {
  const spoken = ["Details, collapsed, button", "Details, expanded, button", "Body text"]
  expect(missingPhrases(spoken, ["details", "collapsed", "expanded", "Body text"])).toEqual([])
  expect(missingPhrases(spoken, ["Body text", "collapsed"])).toEqual(["collapsed"])
  expect(missingPhrases(spoken, ["1 of 6"])).toEqual(["1 of 6"])
})
