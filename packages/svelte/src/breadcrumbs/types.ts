import type {
  BreadcrumbsCurrentValue,
  BreadcrumbsItemState,
  BreadcrumbsMessages,
  BreadcrumbsTrailItem,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLLiAttributes, HTMLOlAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { LinkProps } from "../link/types"

declare module "../provider" {
  interface RindMessageScopes {
    breadcrumbs: BreadcrumbsMessages
  }
}

export interface BreadcrumbsState {
  readonly collapsed: boolean
}
/** One collapsed item, for the ellipsis menu. */
export type BreadcrumbsCollapsedItem = Pick<
  BreadcrumbsTrailItem,
  "key" | "textValue" | "href" | "routerOptions" | "disabled"
>
export interface BreadcrumbsEllipsisState {
  readonly items: readonly BreadcrumbsCollapsedItem[]
  /** The trigger's accessible name: `messages.showCollapsed(count)`. */
  readonly label: string
  readonly count: number
}
type Part<A, S> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: Snippet<[S]> | undefined
}
export type BreadcrumbsRootProps = Part<HTMLAttributes<HTMLElement>, BreadcrumbsState> & {
  /** Collapse the middle items past this many. */
  readonly maxItems?: number | undefined
  /** Default 1. */
  readonly itemsBeforeCollapse?: number | undefined
  /** Default 1. */
  readonly itemsAfterCollapse?: number | undefined
  /** The current item's `aria-current`. Default `"page"`. */
  readonly currentValue?: BreadcrumbsCurrentValue | undefined
  /**
   * The trail as data: collapse is known while rendering (the server render collapses too).
   * Render one Item per entry, with the same `value`.
   */
  readonly items?: readonly BreadcrumbsTrailItem[] | undefined
  readonly messages?: MessageOverrides<BreadcrumbsMessages> | undefined
}
export type BreadcrumbsListProps = Part<HTMLOlAttributes, BreadcrumbsState>
export type BreadcrumbsItemProps = Part<Omit<HTMLLiAttributes, "value">, BreadcrumbsItemState> & {
  /** The Item's key: stable across renders, so the trail keeps its DOM nodes. */
  readonly value: string
  /** `true` makes it current; `false` on the last Item opts out of the default. */
  readonly current?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Its text in the ellipsis menu; default its Link's text. */
  readonly textValue?: string | undefined
}
/** Link's props; `current` and `disabled` come from the Item. */
export type BreadcrumbsLinkProps = Omit<LinkProps, "current" | "disabled">
export type BreadcrumbsSeparatorProps = Part<HTMLAttributes<HTMLSpanElement>, BreadcrumbsItemState>
export type BreadcrumbsEllipsisProps = Part<HTMLLiAttributes, BreadcrumbsEllipsisState>
