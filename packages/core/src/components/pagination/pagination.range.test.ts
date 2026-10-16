import { describe, expect, it } from "vitest"
import { type PaginationEntry, paginationRange } from "./pagination.range"

const show = (entries: readonly PaginationEntry[]) =>
  entries.map((e) => (e.type === "page" ? e.value : "…"))

/** Every invariant of spec "Visible Range"; returns the first one broken, or undefined. */
function broken(
  entries: readonly PaginationEntry[],
  page: number,
  total: number,
  s: number,
  b: number,
): string | undefined {
  const pages = entries.flatMap((e) => (e.type === "page" ? [e.value] : []))
  if (pages.some((p) => p < 1 || p > total)) return "page out of range"
  if (pages.some((p, i) => i > 0 && p <= (pages[i - 1] ?? 0))) return "not unique ascending"
  const must = [
    ...Array.from({ length: Math.min(b, total) }, (_, i) => i + 1),
    ...Array.from({ length: Math.min(b, total) }, (_, i) => total - i),
    page,
    ...Array.from({ length: s }, (_, i) => page - i - 1),
    ...Array.from({ length: s }, (_, i) => page + i + 1),
  ].filter((p) => p >= 1 && p <= total)
  if (must.some((p) => !pages.includes(p))) return "a required page is missing"
  // Walk the entries: each gap is exactly one ellipsis standing for two or more pages.
  let last = 0
  for (const [i, e] of entries.entries()) {
    if (e.type === "ellipsis") {
      const next = entries[i + 1]
      const to = next?.type === "page" ? next.value : total + 1
      if (to - last - 1 < 2) return "an ellipsis hides fewer than two pages"
      if (entries[i - 1]?.type === "ellipsis") return "two ellipses in a row"
      last = to - 1
    } else {
      if (e.value !== last + 1) return `gap before ${e.value} without an ellipsis`
      last = e.value
    }
  }
  if (last !== total) return "the end is not reached"
  if (entries.length !== Math.min(total, 2 * s + 2 * b + 3)) return "slot count is not constant"
  const keys = entries.map((e) => e.key)
  if (new Set(keys).size !== keys.length) return "duplicate keys"
  return undefined
}

describe("paginationRange", () => {
  it("no single hidden page (zag#2885, reka-ui#970)", () => {
    expect(show(paginationRange({ page: 1, totalPages: 5 }))).toEqual([1, 2, 3, 4, 5])
  })

  it("middle page", () => {
    expect(show(paginationRange({ page: 10, totalPages: 20 }))).toEqual([
      1,
      "…",
      9,
      10,
      11,
      "…",
      20,
    ])
  })

  it("constant slots near the ends (zag#1889, zag#2313)", () => {
    expect(show(paginationRange({ page: 1, totalPages: 20 }))).toEqual([1, 2, 3, 4, 5, "…", 20])
    expect(show(paginationRange({ page: 20, totalPages: 20 }))).toEqual([
      1,
      "…",
      16,
      17,
      18,
      19,
      20,
    ])
  })

  it("stable keys", () => {
    expect(paginationRange({ page: 10, totalPages: 20 }).map((e) => e.key)).toEqual([
      "page-1",
      "ellipsis-start",
      "page-9",
      "page-10",
      "page-11",
      "ellipsis-end",
      "page-20",
    ])
  })

  it("never page 0 (kobaltedev/kobalte#603, reka-ui#595): every invariant over the grid", () => {
    const failures: string[] = []
    for (let total = 1; total <= 60; total++)
      for (let page = 1; page <= total; page++)
        for (let s = 0; s <= 3; s++)
          for (let b = 0; b <= 2; b++) {
            const r = paginationRange({
              page,
              totalPages: total,
              siblingCount: s,
              boundaryCount: b,
            })
            const why = broken(r, page, total, s, b)
            if (why) failures.push(`total ${total} page ${page} s ${s} b ${b}: ${why} ${show(r)}`)
          }
    expect(failures.slice(0, 5)).toEqual([])
  })
})
