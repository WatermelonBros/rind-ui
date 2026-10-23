import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface BadgeState {
  /** A `label` replaces what assistive technology hears. */
  readonly labelled: boolean
}

export type BadgeRootProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** The text assistive technology gets instead of the visible content ("99+"). */
  readonly label?: string | undefined
  readonly child?: Snippet<[ChildArgs<BadgeState>]> | undefined
  readonly children?: Snippet<[BadgeState]> | undefined
}
