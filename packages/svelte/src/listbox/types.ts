import type {
  Collection,
  FocusStrategy,
  ListboxActionDetails,
  LoadingStatus,
  ScrollToIndexDetails,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

/** One item of a data-driven listbox. */
export interface ListboxItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}
export interface ListboxChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}
export interface ListboxRootProps {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id?: string | undefined
  readonly children?: Snippet | undefined
  /** `single` (default), `multiple` or `none` (actions only). */
  readonly selectionMode?: "single" | "multiple" | "none" | undefined
  /** `toggle` (default) or `replace` (a press selects only that item; actions are allowed). */
  readonly selectionBehavior?: "toggle" | "replace" | undefined
  /** The selection: a key or null (single), keys or "all" (multiple); `bind:value` controls it. */
  value?: string | readonly string[] | null | undefined
  readonly defaultValue?: string | readonly string[] | null | undefined
  readonly onValueChange?:
    | ((value: string | readonly string[] | null, details: ListboxChangeDetails) => void)
    | undefined
  /** No user action leaves the selection empty. */
  readonly disallowEmptySelection?: boolean | undefined
  readonly orientation?: "vertical" | "horizontal" | undefined
  readonly disabled?: boolean | undefined
  /** A disabled list keeps its Tab stop and disabled items stay reachable (not selectable). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** `all`: disabled items are skipped and not actionable; `selection`: reachable, only not selectable. */
  readonly disabledBehavior?: "all" | "selection" | undefined
  /** Arrow keys wrap from the last item to the first and back. Default: `false`. */
  readonly loop?: boolean | undefined
  /** How long typed characters build one typeahead search (ms). Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  /** Data items. Without them (and without `collection`), item parts register themselves. */
  readonly items?: readonly ListboxItemData[] | undefined
  /** A collection built by the consumer (virtualized lists). */
  readonly collection?: Collection<unknown> | undefined
  readonly loading?: LoadingStatus | undefined
  readonly onLoadMore?: (() => void) | undefined
  /** Items are not all rendered: the highlighted item is scrolled through `scrollToIndex`. */
  readonly virtualized?: boolean | undefined
  /** Scrolls the highlighted item into view on navigation, typeahead and open (replaces `scrollIntoView`). */
  readonly scrollToIndex?: ((details: ScrollToIndexDetails) => void) | undefined
  /** `roving`: DOM focus moves to the item; `active-descendant`: focus stays on the list. */
  readonly strategy?: FocusStrategy | undefined
  readonly onAction?: ((key: string, details: ListboxActionDetails) => void) | undefined
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type ListboxPartProps = Part<HTMLAttributes<HTMLElement>>
export type ListboxItemProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The item key. */
  readonly value: string
  /** Used by typeahead, filtering, announcements and form labels (default: the text content). */
  readonly textValue?: string | undefined
  /** Disables this option: it cannot be selected. */
  readonly disabled?: boolean | undefined
  /** Extra filter terms (synonyms); never typeahead, announcements or labels. */
  readonly keywords?: readonly string[] | undefined
}
export type ListboxItemIndicatorProps = ListboxPartProps & {
  /** Rendered while not selected too (hidden by CSS on `data-state`). */
  readonly keepMounted?: boolean | undefined
}
export type ListboxSectionProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The section's key and label; the label names it and is the default heading. */
  readonly section: { readonly key: string; readonly label: string }
  /** The section label part's content (default: the label text). */
  readonly label?: Snippet | undefined
}
export interface ListboxItemsProps {
  /** Each item's content from its label and key (default: an ItemText with the label). */
  readonly children?: Snippet<[{ label: string; key: string }]> | undefined
}
