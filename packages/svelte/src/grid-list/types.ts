import type {
  Collection,
  GridListActionDetails,
  GridListItemOptions,
  GridListLayout,
  GridListMessages,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLInputAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

/** One row of a data-driven list. */
export interface GridListItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  /** A link row: Enter and a press follow it. */
  readonly href?: string
}
export interface GridListChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}
export interface GridListRootProps {
  /** The base the parts' ids derive from. Default: generated. */
  readonly id?: string | undefined
  readonly children?: Snippet | undefined
  /** `none` (default), `single` or `multiple`. */
  readonly selectionMode?: "none" | "single" | "multiple" | undefined
  readonly selectionBehavior?: "toggle" | "replace" | undefined
  /** The selection; `bind:value` controls it. */
  value?: string | readonly string[] | null | undefined
  readonly defaultValue?: string | readonly string[] | null | undefined
  readonly onValueChange?:
    | ((value: string | readonly string[] | null, details: GridListChangeDetails) => void)
    | undefined
  /** No user action leaves the selection empty. */
  readonly disallowEmptySelection?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Disabled rows stay navigable, and a disabled list keeps its Tab stop. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** "selection": a disabled row is not selectable but still acts. Default: "all". */
  readonly disabledBehavior?: "all" | "selection" | undefined
  /** Arrow keys wrap around. Default false. */
  readonly loop?: boolean | undefined
  /** Milliseconds of idle time that end a typeahead search. Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  readonly disallowTypeAhead?: boolean | undefined
  readonly childNavigation?: "arrow" | "tab" | undefined
  readonly layout?: GridListLayout | undefined
  readonly items?: readonly GridListItemData[] | undefined
  /** A collection built by the consumer (wins over `items` and Item parts). */
  readonly collection?: Collection<unknown> | undefined
  readonly onAction?: ((key: string, details: GridListActionDetails) => void) | undefined
  /** Presses select on pointer up (for lists inside popups). Default false. */
  readonly selectOnPressUp?: boolean | undefined
  /** Focus the selected row (else the first) on mount. */
  readonly autoFocus?: boolean | undefined
  readonly onLoadMore?: (() => void) | undefined
  /** Selection announcements and the checkboxes' names. */
  readonly messages?: Partial<GridListMessages> | undefined
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type GridListPartProps = Part<HTMLAttributes<HTMLElement>>
export type GridListItemProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The row key. */
  readonly value: string
  /** The row's text for typeahead and announcements. Default: its ItemText's text. */
  readonly textValue?: string | undefined
  /** Disables this row: it cannot be selected and, unless `disabledBehavior` is `"selection"`, it does not act. */
  readonly disabled?: boolean | undefined
  /** A link row: Enter and a press follow it (role stays `row`). */
  readonly href?: string | undefined
  /** Marks the row current (`aria-current`, `data-current`). */
  readonly current?: GridListItemOptions["current"]
  /** This row's action (with the Root's `onAction`, both run). */
  readonly onAction?: ((details: GridListActionDetails) => void) | undefined
}
export type GridListItemCheckboxProps = Omit<HTMLInputAttributes, "children"> & {
  /** The select-all checkbox (outside the rows, multiple mode) instead of a row's. */
  readonly all?: boolean | undefined
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
}
export type GridListItemControlProps = Part<HTMLButtonAttributes>
export interface GridListItemsProps {
  /** A row's content from its text and key. Default: an ItemText with the text. */
  readonly children?: Snippet<[{ label: string; key: string }]> | undefined
}
