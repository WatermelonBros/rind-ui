import type {
  MessageOverrides,
  SortableMessages,
  SortableOrientation,
  SortableReorderDetails,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLLiAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    sortable: SortableMessages
  }
}

/** What every part's snippets receive. */
export interface SortableRenderState {
  readonly orientation: SortableOrientation
  /** The picked-up or dragged key, or null. */
  readonly active: string | null
  readonly dragging: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<SortableRenderState>]> | undefined
  readonly children?: Snippet<[SortableRenderState]> | undefined
}

export type SortableRootProps = Part<HTMLAttributes<HTMLUListElement>> & {
  /** The keys in their current order (controlled: reorder your data in `onReorder`). */
  readonly items: readonly string[]
  readonly onReorder?:
    | ((keys: readonly string[], details: SortableReorderDetails) => void)
    | undefined
  readonly orientation?: SortableOrientation | undefined
  /** Pointer drags start from the Handle (default), or anywhere on the item. */
  readonly handle?: boolean | undefined
  readonly messages?: MessageOverrides<SortableMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type SortableItemProps = Part<HTMLLiAttributes> & {
  /** The item's key (one of the Root's `items`). */
  readonly value: string
  /** The spoken label (default: the item's text). */
  readonly label?: string | undefined
  /** Cannot be moved; other items can pass it. */
  readonly disabled?: boolean | undefined
}
export type SortableHandleProps = Part<HTMLButtonAttributes>
export type SortableIndicatorProps = Part<HTMLLiAttributes>
export type SortableMoveButtonProps = Part<HTMLButtonAttributes> & {
  /** Which way it moves its item. */
  readonly direction: "up" | "down"
}
