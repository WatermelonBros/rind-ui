import type {
  ChangeDetails,
  MessageOverrides,
  TableOfContentsChangeReason,
  TableOfContentsEvent,
  TableOfContentsItem,
  TableOfContentsMessages,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAnchorAttributes,
  HTMLAttributes,
  HTMLLiAttributes,
  HTMLOlAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "table-of-contents": TableOfContentsMessages
  }
}

/** What every part's snippets receive. */
export interface TableOfContentsRenderState {
  /** The current section's id ("" for none). */
  readonly value: string
}
/** What `onValueChange` receives. */
export interface TableOfContentsChangeDetails {
  readonly reason: TableOfContentsChangeReason
  readonly event: ChangeDetails<TableOfContentsEvent>["event"]
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<TableOfContentsRenderState>]> | undefined
  readonly children?: Snippet<[TableOfContentsRenderState]> | undefined
}
export type TableOfContentsRootProps = Part<HTMLAttributes<HTMLElement>> & {
  /** The sections, in document order (`collectHeadings(root)` reads them from headings). */
  readonly items: readonly TableOfContentsItem[]
  /** The current section id; `bind:value` controls it. */
  value?: string | undefined
  readonly defaultValue?: string | undefined
  /** `details.reason`: "scroll" (the reading position) or "navigate" (a followed link). */
  readonly onValueChange?:
    | ((value: string, details: TableOfContentsChangeDetails) => void)
    | undefined
  /** The scrolling container (default: the window). */
  readonly scrollRoot?: HTMLElement | null | undefined
  /** Pixels hidden at the top by a sticky header (default 0). */
  readonly offset?: number | undefined
  /** The reading line, as a fraction of the scroll root below the offset (default 1/3). */
  readonly ratio?: number | undefined
  readonly messages?: MessageOverrides<TableOfContentsMessages> | undefined
}
export type TableOfContentsTitleProps = Part<HTMLAttributes<HTMLHeadingElement>>
export type TableOfContentsListProps = Part<HTMLOlAttributes>
export type TableOfContentsItemProps = Part<HTMLLiAttributes> & {
  /** The section this item lists. */
  readonly item: TableOfContentsItem
}
export type TableOfContentsLinkProps = Part<HTMLAnchorAttributes>
export type TableOfContentsIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>>
