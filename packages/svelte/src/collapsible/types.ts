import type { ChangeDetails, ClosedContent, CollapsibleEvent } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface CollapsibleState {
  readonly open: boolean
  readonly disabled: boolean
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<CollapsibleState>]> | undefined
  readonly children?: Snippet<[CollapsibleState]> | undefined
}
export type CollapsibleRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<CollapsibleEvent>) => void)
    | undefined
  /** Ignores activation; the content stays as it is (a parent can still open or close it). */
  readonly disabled?: boolean | undefined
  readonly focusableWhenDisabled?: boolean | undefined
  /** What closed content becomes: findable by the browser's search (default), hidden, or removed. */
  readonly closedContent?: ClosedContent | undefined
}
export type CollapsibleTriggerProps = Part<HTMLButtonAttributes>
export type CollapsibleContentProps = Part<HTMLAttributes<HTMLDivElement>>
export type CollapsibleIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>>
