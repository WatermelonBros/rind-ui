// The Table's sort descriptor, its press cycle, and `sortItems` (design §4): the component
// never reorders rows; the consumer sorts with this helper or their own.

export type SortDirection = "ascending" | "descending"

/** The sorted column and its direction; `null` while unsorted. */
export interface SortDescriptor {
  readonly column: string
  readonly direction: SortDirection
}

const opposite = (d: SortDirection): SortDirection =>
  d === "ascending" ? "descending" : "ascending"

/**
 * The sort a press on `column` proposes: another column starts at its first direction; the
 * sorted column flips; with `allowUnsorted`, the sorted column at the opposite of its first
 * direction clears the sort.
 */
export function nextSort(
  current: SortDescriptor | null,
  column: string,
  firstDirection: SortDirection = "ascending",
  allowUnsorted = false,
): SortDescriptor | null {
  if (current?.column !== column) return { column, direction: firstDirection }
  if (allowUnsorted && current.direction === opposite(firstDirection)) return null
  return { column, direction: opposite(current.direction) }
}

/**
 * The sort as the machine holds it: controllable values are never null in the runtime, so
 * "unsorted" is `{ value: null }`. The React Root wraps and unwraps it.
 */
export interface TableSortValue {
  readonly value: SortDescriptor | null
}

export const sameSort = (a: SortDescriptor | null, b: SortDescriptor | null) =>
  a === b || (a !== null && b !== null && a.column === b.column && a.direction === b.direction)

/** Values placed last in both directions. */
const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v))

const kind = (v: unknown) => (v instanceof Date ? "date" : typeof v)

function compareValues(a: unknown, b: unknown, collator: Intl.Collator): number {
  const ka = kind(a)
  const kb = kind(b)
  // Mixed types: by type name, so the order is total.
  if (ka !== kb) return ka < kb ? -1 : 1
  if (ka === "string") return collator.compare(a as string, b as string)
  if (ka === "date") return (a as Date).getTime() - (b as Date).getTime()
  if (ka === "boolean") return Number(a) - Number(b)
  if (ka === "number" || ka === "bigint") {
    const x = a as number | bigint
    const y = b as number | bigint
    return x < y ? -1 : x > y ? 1 : 0
  }
  return collator.compare(String(a), String(b))
}

/**
 * A new array sorted by `sort` (the input is untouched), stable. Strings compare naturally
 * ("item 2" before "item 10", case-insensitive); numbers, bigints, dates and booleans by
 * value; `null`, `undefined`, `NaN` and `""` go last in both directions (TanStack/table#6086).
 */
export function sortItems<T>(
  items: readonly T[],
  sort: SortDescriptor | null,
  getValue: (item: T, column: string) => unknown,
  options: { readonly locale?: string | undefined } = {},
): T[] {
  if (sort === null) return [...items]
  const collator = new Intl.Collator(options.locale, { numeric: true, sensitivity: "base" })
  const sign = sort.direction === "ascending" ? 1 : -1
  return items
    .map((item, index) => ({ item, index, value: getValue(item, sort.column) }))
    .sort((a, b) => {
      const ea = isEmpty(a.value)
      const eb = isEmpty(b.value)
      if (ea || eb) return ea && eb ? a.index - b.index : ea ? 1 : -1
      return sign * compareValues(a.value, b.value, collator) || a.index - b.index
    })
    .map((e) => e.item)
}
