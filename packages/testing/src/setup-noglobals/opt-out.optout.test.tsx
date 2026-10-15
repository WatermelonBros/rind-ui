// Project "setup-optout": RIND_AUTO_CLEANUP = false (set by an earlier setup file) leaves
// cleanup to the consumer.
import { render } from "@testing-library/react"
import { expect, it } from "vitest"

it("first test renders", () => {
  render(<button type="button">A</button>)
})

it("the opt-out keeps the first tree (no cleanup ran)", () => {
  expect(document.querySelectorAll("button")).toHaveLength(1)
})
