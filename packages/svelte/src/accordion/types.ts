import type { AccordionEvent, ChangeDetails, ClosedContent, HeadingLevel } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { CollapsibleState } from "../collapsible/types"

export interface AccordionState {
  readonly value: readonly string[]
  readonly disabled: boolean
}
export type AccordionRootProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "dir"> & {
  /** The open items' values; `bind:value` controls it. */
  value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<AccordionEvent>) => void)
    | undefined
  /** Several items open at once. */
  readonly multiple?: boolean | undefined
  /** Single mode: the open item can be closed (default true). Ignored when `multiple`. */
  readonly collapsible?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Disabled triggers stay focusable (`aria-disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Arrow keys, Home and End move between triggers (off by default, as in APG 2026). */
  readonly keyboardNavigation?: boolean | undefined
  readonly orientation?: "vertical" | "horizontal" | undefined
  readonly dir?: "ltr" | "rtl" | undefined
  /** The headers' level; default: the surrounding `Heading.Level`'s, else 3. */
  readonly headingLevel?: HeadingLevel | undefined
  /** What closed content becomes; an item can override it. */
  readonly closedContent?: ClosedContent | undefined
  /** Overrides the region rule for open panels. */
  readonly contentRole?: "region" | "none" | undefined
  readonly child?: Snippet<[ChildArgs<AccordionState>]> | undefined
  readonly children?: Snippet<[AccordionState]> | undefined
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<CollapsibleState>]> | undefined
  readonly children?: Snippet<[CollapsibleState]> | undefined
}
export type AccordionItemProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** A non-empty string, unique within the accordion. */
  readonly value: string
  readonly disabled?: boolean | undefined
  readonly closedContent?: ClosedContent | undefined
}
export type AccordionHeaderProps = Part<HTMLAttributes<HTMLHeadingElement>>
