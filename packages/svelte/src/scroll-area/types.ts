import type { ScrollAreaState as ScrollAreaActivity, ScrollAreaType } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface ScrollAreaState {
  readonly state: ScrollAreaActivity
}
/** What `bind:this` on the Root exposes. */
export interface ScrollAreaActions {
  /** Re-measures after a change the observers cannot see (a deep descendant resized). */
  measure(): void
}
type Part = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<ScrollAreaState>]> | undefined
  readonly children?: Snippet<[ScrollAreaState]> | undefined
}
export type ScrollAreaRootProps = Part & {
  /** Default `hover`. */
  readonly type?: ScrollAreaType | undefined
  /** Default 600 ms. */
  readonly hideDelay?: number | undefined
  /** Default `page`. */
  readonly trackPress?: "page" | "jump" | undefined
}
export type ScrollAreaPartProps = Part
export type ScrollAreaScrollbarProps = Part & {
  /** Default `vertical`. */
  readonly orientation?: "vertical" | "horizontal" | undefined
}
