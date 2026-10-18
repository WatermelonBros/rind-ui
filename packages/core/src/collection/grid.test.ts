// collection-grid in Node: child moves (no wrap past the last control) and the keys the grid
// handles when a control is the target. Key ownership needs a DOM: the Grid List DOM tests.
import { describe, expect, it } from "vitest"
import { childMove, gridHandlesOnControl } from "./grid"

describe("child moves", () => {
  it("row → first control → second; back to the row; no wrap at the end", () => {
    expect(childMove(0, 2, "next")).toBe(1)
    expect(childMove(1, 2, "next")).toBe(2)
    expect(childMove(2, 2, "next")).toBeNull()
    expect(childMove(2, 2, "previous")).toBe(1)
    expect(childMove(1, 2, "previous")).toBe(0)
    expect(childMove(0, 2, "previous")).toBeNull()
    expect(childMove(2, 2, "row")).toBe(0)
    expect(childMove(0, 2, "row")).toBeNull()
  })

  it("a row without controls has only position 0", () => {
    expect(childMove(0, 0, "next")).toBeNull()
  })
})

describe("keys on a control", () => {
  it("Up, Down and Escape always; Left and Right only in arrow mode", () => {
    for (const k of ["ArrowUp", "ArrowDown", "Escape"]) {
      expect(gridHandlesOnControl(k, "arrow")).toBe(true)
      expect(gridHandlesOnControl(k, "tab")).toBe(true)
    }
    expect(gridHandlesOnControl("ArrowRight", "arrow")).toBe(true)
    expect(gridHandlesOnControl("ArrowRight", "tab")).toBe(false)
    for (const k of ["Enter", " ", "Home", "End", "PageDown", "a"]) {
      expect(gridHandlesOnControl(k, "arrow")).toBe(false)
    }
  })
})
