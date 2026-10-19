// Table's strings: every text that reaches assistive technology (spec "Sort Announcement",
// "TalkBack Sort State").

import type { SortDirection } from "./table.sort"

export interface TableMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** Announced when a press sorts the table. */
  readonly sorted: (column: string, direction: SortDirection) => string
  /** Announced when a press clears the sort (`allowUnsorted`). */
  readonly unsorted: (column: string) => string
  /** The sorted trigger's description where `aria-sort` is not read (TalkBack). */
  readonly sortState: (direction: SortDirection) => string
  /** A FilterTrigger's name: "Filter Name". */
  readonly filter: (column: string) => string
  /** An active FilterTrigger's description. */
  readonly filtered: string
  /** The ExpandTrigger's name when it has no text. */
  readonly expand: string
  /** A RowTrigger's name: "Show details Accordion". */
  readonly rowDetails: (row: string) => string
  /** Announced when `rowCount` changes. */
  readonly rowCount: (count: number) => string
  /** Announced when `rowRange` changes (pagination). */
  readonly rowRange: (from: number, to: number, total: number) => string
}

export const tableMessages: TableMessages = {
  sorted: (column, direction) => `Sorted by ${column}, ${direction}`,
  unsorted: () => "Sort cleared",
  sortState: (direction) => `sorted ${direction}`,
  filter: (column) => `Filter ${column}`,
  filtered: "Filtered",
  expand: "Full page",
  rowDetails: (row) => (row ? `Show details ${row}` : "Show details"),
  rowCount: (count) => (count === 1 ? "1 row" : `${count} rows`),
  rowRange: (from, to, total) => (total === 0 ? "No rows" : `Rows ${from} to ${to} of ${total}`),
}
