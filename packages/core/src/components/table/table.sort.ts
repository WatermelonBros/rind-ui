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
export interface SortItemsOptions {
  readonly locale?: string | undefined
  /** A comparator per column (ascending order); the default compares values naturally. */
  readonly compare?: Readonly<Record<string, (a: unknown, b: unknown) => number>> | undefined
  /** Where empty values go, in both directions. Default `last`. */
  readonly empty?: "last" | "first" | undefined
}

export function sortItems<T>(
  items: readonly T[],
  sort: SortDescriptor | null,
  getValue: (item: T, column: string) => unknown,
  options: SortItemsOptions = {},
): T[] {
  if (sort === null) return [...items]
  const collator = new Intl.Collator(options.locale, { numeric: true, sensitivity: "base" })
  const sign = sort.direction === "ascending" ? 1 : -1
  const own = options.compare?.[sort.column]
  const compare = own ?? ((a: unknown, b: unknown) => compareValues(a, b, collator))
  const emptyFirst = options.empty === "first" ? -1 : 1
  return items
    .map((item, index) => ({ item, index, value: getValue(item, sort.column) }))
    .sort((a, b) => {
      const ea = isEmpty(a.value)
      const eb = isEmpty(b.value)
      if (ea || eb) return ea && eb ? a.index - b.index : ea ? emptyFirst : -emptyFirst
      return sign * compare(a.value, b.value) || a.index - b.index
    })
    .map((e) => e.item)
}

const fold = (collator: Intl.Collator) => (a: string, b: string) => {
  // Containment with the collator's base sensitivity (case and accents ignored): slide a window.
  if (b === "") return true
  for (let i = 0; i + b.length <= a.length; i++) {
    if (collator.compare(a.slice(i, i + b.length), b) === 0) return true
  }
  return false
}

export interface FilterItemsOptions<T> {
  /** One predicate per column; a row passes every one. */
  readonly filters?: Readonly<Record<string, (value: unknown, item: T) => boolean>> | undefined
  /** Kept when a searched column's value contains it (case- and accent-insensitive). */
  readonly query?: string | undefined
  readonly getValue: (item: T, column: string) => unknown
  /** The columns the query searches. Default: the filters' columns. */
  readonly searchColumns?: readonly string[] | undefined
  readonly locale?: string | undefined
}

/** A new array of the rows that pass every column filter and, with a query, match it. */
export function filterItems<T>(items: readonly T[], options: FilterItemsOptions<T>): T[] {
  const filters = Object.entries(options.filters ?? {})
  const query = options.query?.trim() ?? ""
  const columns = options.searchColumns ?? filters.map(([c]) => c)
  const contains = fold(new Intl.Collator(options.locale, { sensitivity: "base", usage: "search" }))
  return items.filter((item) => {
    for (const [column, keep] of filters) {
      if (!keep(options.getValue(item, column), item)) return false
    }
    if (query === "") return true
    return columns.some((c) => {
      const v = options.getValue(item, c)
      return !isEmpty(v) && contains(String(v), query)
    })
  })
}

/** Each distinct value of `column` with its count, in first-seen order (filter options). */
export function facetValues<T>(
  items: readonly T[],
  column: string,
  getValue: (item: T, column: string) => unknown,
): { readonly value: unknown; readonly count: number }[] {
  const counts = new Map<unknown, number>()
  for (const item of items) {
    const v = getValue(item, column)
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts].map(([value, count]) => ({ value, count }))
}

export interface Page<T> {
  readonly items: T[]
  /** The page shown, clamped to `1..pageCount`. */
  readonly page: number
  readonly pageCount: number
  /** 1-based positions of the first and last row shown; 0 when there is none. */
  readonly from: number
  readonly to: number
  readonly total: number
}

/** The rows of `page` (1-based), the page clamped to the ones that exist. */
export function paginateItems<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize))
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / size))
  const p = Math.min(pageCount, Math.max(1, Math.floor(page)))
  const start = (p - 1) * size
  const shown = items.slice(start, start + size)
  return {
    items: shown,
    page: p,
    pageCount,
    from: shown.length ? start + 1 : 0,
    to: start + shown.length,
    total,
  }
}
