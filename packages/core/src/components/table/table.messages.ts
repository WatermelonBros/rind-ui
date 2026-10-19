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
}

export const tableMessages: TableMessages = {
  sorted: (column, direction) => `Sorted by ${column}, ${direction}`,
  unsorted: () => "Sort cleared",
  sortState: (direction) => `sorted ${direction}`,
}
