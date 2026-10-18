// Visual adjacency of date segments in a real layout (Chromium): in rtl the next segment in
// reading direction is the one on the left; with a scope, segments of a second field count.
import { afterEach, describe, expect, it } from "vitest"
import { adjacentSegment, segmentAtPress } from "./segment-layout"

const field = (dir: "ltr" | "rtl", types: readonly string[]) => {
  const root = document.createElement("div")
  root.dir = dir
  root.style.display = "inline-flex"
  for (const t of types) {
    const input = document.createElement("input")
    input.size = 2
    input.setAttribute("data-scope", "date-field")
    input.setAttribute("data-part", "segment")
    input.setAttribute("data-editable", "")
    input.setAttribute("data-type", t)
    input.value = "1"
    root.append(input)
  }
  document.body.append(root)
  return root
}
const seg = (root: ParentNode, t: string) =>
  root.querySelector(`[data-type="${t}"]`) as HTMLInputElement

afterEach(() => {
  document.body.innerHTML = ""
})

describe("segment layout", () => {
  it("rtl: next is the segment visually to the left", () => {
    const root = field("rtl", ["day", "month", "year"])
    const day = seg(root, "day")
    const month = seg(root, "month")
    // In rtl the first DOM segment is rendered rightmost.
    expect(day.getBoundingClientRect().left).toBeGreaterThan(month.getBoundingClientRect().left)
    expect(adjacentSegment(day, "next", { root, dir: "rtl" })).toBe(month)
    expect(adjacentSegment(month, "previous", { root, dir: "rtl" })).toBe(day)
    expect(adjacentSegment(seg(root, "year"), "next", { root, dir: "rtl" })).toBeNull()
  })

  it("ltr: next is to the right; a scope reaches the second field", () => {
    const scope = document.createElement("div")
    scope.style.display = "flex"
    document.body.append(scope)
    const a = field("ltr", ["month", "day"])
    const b = field("ltr", ["month", "day"])
    scope.append(a, b)
    expect(adjacentSegment(seg(a, "month"), "next", { root: a, dir: "ltr" })).toBe(seg(a, "day"))
    expect(adjacentSegment(seg(a, "day"), "next", { root: a, dir: "ltr" })).toBeNull()
    expect(adjacentSegment(seg(a, "day"), "next", { root: a, scope, dir: "ltr" })).toBe(
      seg(b, "month"),
    )
  })

  it("a press after the last filled segment focuses it", () => {
    const root = field("ltr", ["month", "day", "year"])
    const box = root.getBoundingClientRect()
    expect(segmentAtPress(root, box.right + 1, "ltr")).toBe(seg(root, "year"))
    expect(segmentAtPress(root, box.left - 1, "ltr")).toBe(seg(root, "month"))
  })
})
