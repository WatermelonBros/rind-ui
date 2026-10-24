import type {
  Href,
  LinkCurrent,
  RouterOptions,
  ScrollToIndexDetails,
  TreeCollection,
  TreeViewActionDetails,
  TreeViewMessages,
  TreeViewMoveDetails,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

/** One node of a data-driven tree. */
export interface TreeViewItemData {
  readonly key: string
  readonly label: string
  /** Loaded children (empty or absent for a leaf or an unloaded branch). */
  readonly children?: readonly TreeViewItemData[]
  /** A branch even with no loaded children (lazy, or loaded and empty). */
  readonly isBranch?: boolean
  readonly disabled?: boolean
}
export interface TreeViewChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}
export interface TreeViewExpandedDetails {
  readonly reason: "key" | "press" | "api" | "siblings" | "all"
}
/** What a node's snippet receives (design §2). */
export interface TreeViewNodeState {
  readonly key: string
  /** The row's position in the visible list (what a virtualizer positions by). */
  readonly index: number
  /** The node's data (a `TreeViewItemData` with `items`). */
  readonly value: unknown
  readonly label: string
  /** 1 for roots. */
  readonly level: number
  readonly posInSet: number
  readonly setSize: number
  readonly isLast: boolean
  readonly parentKey: string | null
  readonly isBranch: boolean
  readonly expanded: boolean
  readonly selected: boolean
  readonly checked: "true" | "false" | "mixed" | undefined
  readonly loading: boolean
  readonly disabled: boolean
}
type Value = string | readonly string[] | null
export interface TreeViewRootProps {
  /** Base of the parts' generated ids (default: generated). */
  readonly id?: string | undefined
  /** The tree's parts (Label, Tree, Empty). */
  readonly children?: Snippet | undefined
  /** The tree's data; or `collection`, a tree collection you built. */
  readonly items?: readonly TreeViewItemData[] | undefined
  /** A tree collection you built, used instead of `items`. */
  readonly collection?: TreeCollection<unknown> | undefined
  /** `single` (default), `multiple` or `none`. */
  readonly selectionMode?: "single" | "multiple" | "none" | undefined
  readonly selectionBehavior?: "toggle" | "replace" | undefined
  /** Multiple mode: the last selected item cannot be deselected. */
  readonly disallowEmptySelection?: boolean | undefined
  /** The selection; `bind:value` controls it. */
  value?: Value | undefined
  readonly defaultValue?: Value | undefined
  readonly onValueChange?: ((value: Value, details: TreeViewChangeDetails) => void) | undefined
  /** The expanded keys; `bind:expandedValue` controls them. */
  expandedValue?: readonly string[] | undefined
  readonly defaultExpandedValue?: readonly string[] | undefined
  readonly onExpandedChange?:
    | ((keys: readonly string[], details: TreeViewExpandedDetails) => void)
    | undefined
  readonly checkable?: boolean | undefined
  /** The checked keys; `bind:checkedValue` controls them. */
  checkedValue?: readonly string[] | undefined
  readonly defaultCheckedValue?: readonly string[] | undefined
  readonly onCheckedChange?:
    | ((keys: readonly string[], details: TreeViewChangeDetails) => void)
    | undefined
  readonly checkPropagation?: "both" | "none" | undefined
  readonly expandOnClick?: boolean | undefined
  readonly onAction?: ((key: string, details: TreeViewActionDetails) => void) | undefined
  readonly onLoadChildren?:
    | ((key: string, options: { readonly signal: AbortSignal }) => Promise<unknown> | undefined)
    | undefined
  readonly disabled?: boolean | undefined
  /** Disabled items (and a disabled tree) stay focusable and reachable by arrows; nothing toggles. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Arrow moves wrap at both ends. Default: false. */
  readonly loop?: boolean | undefined
  /** Typeahead reset delay in ms. Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  /** Overrides for the loading announcements and the Empty and Loading default texts. */
  readonly messages?: Partial<TreeViewMessages> | undefined
  /** Rows are windowed by the consumer (`TreeView.Tree` `indexes`): keyboard moves call `scrollToIndex`. */
  readonly virtualized?: boolean | undefined
  /** Scrolls the highlighted row into view; `index` is its position in the visible list. */
  readonly scrollToIndex?: ((details: ScrollToIndexDetails) => void) | undefined
  /** Nodes can be moved (Alt+arrows, pointer drags): all, or those the predicate allows. */
  readonly movable?: boolean | ((key: string) => boolean) | undefined
  /** A node moved: apply it to `items` with `moveNode(items, key, details)`. */
  readonly onMove?: ((key: string, details: TreeViewMoveDetails) => void) | undefined
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type TreeViewPartProps = Part<HTMLAttributes<HTMLElement>>
export type TreeViewTreeProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  /** Called once per visible node with its state; renders its row (usually a `TreeView.Item`). */
  readonly children: Snippet<[TreeViewNodeState]>
  /** Under a loading branch (default: the Loading part with the loading text). */
  readonly loading?: Snippet<[TreeViewNodeState]> | undefined
  /**
   * Virtualized: the visible-list indexes to render (a virtualizer's window plus
   * `TreeView.useVisibleRows().persistedIndexes`). Default: every visible node.
   */
  readonly indexes?: readonly number[] | undefined
}
export type TreeViewItemProps = Part<HTMLAttributes<HTMLElement>> & {
  /** The node key. */
  readonly value: string
  /** Renders a native `<a role="treeitem">` (link navigation). */
  readonly href?: Href | undefined
  /** With `href`: passed to the anchor; not `_self` opens elsewhere. */
  readonly target?: string | undefined
  /** With `href`: passed to the anchor. */
  readonly rel?: string | undefined
  /** With `href`: sets `aria-current` and `data-current`; the link still navigates. */
  readonly current?: LinkCurrent | undefined
  /** With `href`: passed unchanged to the router's `navigate`. */
  readonly routerOptions?: RouterOptions | undefined
}
