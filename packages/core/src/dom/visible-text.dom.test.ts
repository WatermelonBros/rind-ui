import { expect, it } from "vitest"
import { visibleText } from "./visible-text"

it("skips aria-hidden subtrees and collapses whitespace", () => {
  const el = document.createElement("button")
  el.innerHTML =
    ' Name <span aria-hidden="true">▲</span><b> first </b><i aria-hidden="true"><u>x</u></i>'
  expect(visibleText(el)).toBe("Name first")
})
