// The visible range (design §2, spec "Visible Range"): a pure function with a constant
// number of entries, so controls do not shift as the page changes, and no ellipsis that
// stands for a single page (zag#2885, reka-ui#970). Checked by property in the test.

export type PaginationEntry =
  | { readonly type: "page"; readonly value: number; readonly key: `page-${number}` }
  | {
      readonly type: "ellipsis"
      readonly position: "start" | "end"
      readonly key: "ellipsis-start" | "ellipsis-end"
    }

export interface PaginationRangeInput {
  readonly page: number
  readonly totalPages: number
  /** Pages shown on each side of the current one. Default 1. */
  readonly siblingCount?: number | undefined
  /** Pages always shown at each end. Default 1. */
  readonly boundaryCount?: number | undefined
}

const pageEntry = (value: number): PaginationEntry => ({
  type: "page",
  value,
  key: `page-${value}`,
})
const ellipsis = (position: "start" | "end"): PaginationEntry => ({
  type: "ellipsis",
  position,
  key: position === "start" ? "ellipsis-start" : "ellipsis-end",
})
const span = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)

/** The entries to show, `min(totalPages, 2 × siblings + 2 × boundaries + 3)` of them. */
export function paginationRange(input: PaginationRangeInput): readonly PaginationEntry[] {
  const total = Math.max(1, Math.floor(input.totalPages))
  const s = Math.max(0, Math.floor(input.siblingCount ?? 1))
  const b = Math.max(0, Math.floor(input.boundaryCount ?? 1))
  const page = Math.min(Math.max(1, Math.floor(input.page)), total)
  if (total <= 2 * s + 2 * b + 3) return span(1, total).map(pageEntry)
  // The window of 2s + 1 pages around the current one, pushed off the ends so the slot count
  // stays constant; one slot on each side is an ellipsis or the single page it would hide.
  const start = Math.min(Math.max(page - s, b + 2), total - b - 2 * s - 1)
  const end = start + 2 * s
  return [
    ...span(1, b).map(pageEntry),
    start > b + 2 ? ellipsis("start") : pageEntry(b + 1),
    ...span(start, end).map(pageEntry),
    end < total - b - 1 ? ellipsis("end") : pageEntry(total - b),
    ...span(total - b + 1, total).map(pageEntry),
  ]
}
