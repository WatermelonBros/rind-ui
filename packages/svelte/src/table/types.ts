import type {
  ChangeDetails,
  MessageOverrides,
  PinnedColumns,
  PopoverEvent,
  RowRange,
  SortDescriptor,
  SortDirection,
  TableEvent,
  TableFrameEvent,
  TableMessages,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLTableAttributes,
  HTMLTdAttributes,
  HTMLThAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"
import type { PopoverContentProps, PopoverPositionerProps } from "../popover/types"

declare module "../provider" {
  interface RindMessageScopes {
    table: TableMessages
  }
}

/** What every part's snippets receive. */
export interface TableRenderState {
  readonly sort: SortDescriptor | null
  readonly scrollStop: boolean
}

export interface TableFrameRenderState {
  readonly expanded: boolean
}

type Part<A, S = TableRenderState> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: Snippet<[S]> | undefined
}

export type TableRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Controlled sort (`bind:sort`); `null` is controlled and unsorted. The Table never reorders rows. */
  sort?: SortDescriptor | null | undefined
  readonly defaultSort?: SortDescriptor | null | undefined
  /** A press proposes the next sort; `details.event.column`, `details.cancel()`. */
  readonly onSortChange?:
    | ((sort: SortDescriptor | null, details: ChangeDetails<TableEvent>) => void)
    | undefined
  /** A press on the sorted column at the opposite of its first direction clears the sort. */
  readonly allowUnsorted?: boolean | undefined
  /** `data-sticky-first-column` on the Root (the theme pins the first cell of each row). */
  readonly stickyFirstColumn?: boolean | undefined
  /** Column ids pinned at the inline start and end (`bind:pinnedColumns`). */
  pinnedColumns?: PinnedColumns | undefined
  readonly defaultPinnedColumns?: PinnedColumns | undefined
  readonly onPinnedColumnsChange?:
    | ((pinned: PinnedColumns, details: ChangeDetails<TableEvent>) => void)
    | undefined
  /** Row ids whose details are open (`bind:expandedRows`). */
  expandedRows?: readonly string[] | undefined
  readonly defaultExpandedRows?: readonly string[] | undefined
  readonly onExpandedRowsChange?:
    | ((rows: readonly string[], details: ChangeDetails<TableEvent>) => void)
    | undefined
  /** Several rows open at once (default); `false`: opening one closes the others. */
  readonly multiple?: boolean | undefined
  /** The rows shown (after filters): announced when it changes. */
  readonly rowCount?: number | undefined
  /** With pagination: the rows shown of the total, announced instead of the count. */
  readonly rowRange?: RowRange | undefined
  readonly messages?: MessageOverrides<TableMessages> | undefined
  /** Default: the provider's locale (the announcement's language). */
  readonly locale?: string | undefined
}
export type TableTableProps = Part<HTMLTableAttributes> & {
  /** `aria-busy="true"` and `data-loading`. */
  readonly loading?: boolean | undefined
}
export type TableCaptionProps = Part<HTMLAttributes<HTMLTableCaptionElement>>
export type TableSectionProps = Part<HTMLAttributes<HTMLTableSectionElement>>
export type TableRowProps = Part<HTMLAttributes<HTMLTableRowElement>> & {
  /** The row id: needed to expand it (`expandedRows`, RowTrigger, RowDetails). */
  readonly id?: string | undefined
}
export type TableRowTriggerProps = Part<HTMLButtonAttributes>
export type TableRowDetailsProps = Part<HTMLAttributes<HTMLTableRowElement>> & {
  /** The id of the Row these details belong to (render it right after that Row). */
  readonly rowId: string
  /** The cell's span; default: the leaf columns counted after mount. */
  readonly colSpan?: number | undefined
  /** Props of the one cell spanning the row. */
  readonly cellProps?: HTMLTdAttributes | undefined
}
export type TableColumnHeaderProps = Part<HTMLThAttributes> & {
  /** Holds a SortTrigger; needs `id`. */
  readonly sortable?: boolean | undefined
  /** The column id: unique in the table, what `sort.column` and `pinnedColumns` hold. */
  readonly id?: string | undefined
  /** The direction of a first press on this column. Default `ascending`. */
  readonly firstDirection?: SortDirection | undefined
  readonly colSpan?: number | undefined
}
export type TableRowHeaderProps = Part<HTMLThAttributes> & {
  readonly rowSpan?: number | undefined
}
export type TableCellProps = Part<HTMLTdAttributes>
export type TableSortTriggerProps = Part<HTMLButtonAttributes>
export type TableSortIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** Rendered while sorted ascending (else `children`). */
  readonly ascending?: Snippet<[TableRenderState]> | undefined
  /** Rendered while sorted descending (else `children`). */
  readonly descending?: Snippet<[TableRenderState]> | undefined
  /** Rendered while not sorted (else `children`). */
  readonly none?: Snippet<[TableRenderState]> | undefined
}
export type TableFrameProps = Part<HTMLAttributes<HTMLDivElement>, TableFrameRenderState> & {
  /** Full page: the Frame covers the viewport as a modal dialog (`bind:expanded`). */
  expanded?: boolean | undefined
  readonly defaultExpanded?: boolean | undefined
  readonly onExpandedChange?:
    | ((expanded: boolean, details: ChangeDetails<TableFrameEvent>) => void)
    | undefined
  /** Overrides the strings ("Full page"); also through the provider. */
  readonly messages?: MessageOverrides<TableMessages> | undefined
}
export type TableFramePartProps = Part<HTMLAttributes<HTMLDivElement>, TableFrameRenderState>
export type TableExpandTriggerProps = Part<HTMLButtonAttributes, TableFrameRenderState> & {
  /** Rendered while full page (else `children`). */
  readonly expanded?: Snippet<[TableFrameRenderState]> | undefined
  /** Rendered while in place (else `children`). */
  readonly collapsed?: Snippet<[TableFrameRenderState]> | undefined
}
export interface TableFilterProps {
  /** The column is filtered: the trigger is marked and described "Filtered". */
  readonly active?: boolean | undefined
  /** Controlled open state of the filter popover (`bind:open`). */
  open?: boolean | undefined
  /** Uncontrolled initial open state. */
  readonly defaultOpen?: boolean | undefined
  /** The popover proposes opening or closing. */
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<PopoverEvent>) => void)
    | undefined
  /** The FilterTrigger and the FilterContent. */
  readonly children?: Snippet | undefined
}
export type TableFilterTriggerProps = Omit<HTMLButtonAttributes, "children"> & {
  readonly children?: Snippet | undefined
}
export type TableFilterContentProps = Omit<PopoverContentProps, "children"> & {
  /** Props of the Positioner around the content. */
  readonly positionerProps?: PopoverPositionerProps | undefined
  readonly children?: Snippet | undefined
}
export type TableFilterIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** Rendered while the column is filtered (else `children`). */
  readonly active?: Snippet<[TableRenderState]> | undefined
}
export type TableEmptyProps = Part<HTMLAttributes<HTMLTableRowElement>> & {
  /** The cell's span; default: the leaf columns counted after mount (one on the server). */
  readonly colSpan?: number | undefined
}
