import type { HeadingLevel } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface HeadingState {
  readonly level: HeadingLevel
}

export type HeadingProps = Omit<HTMLAttributes<HTMLHeadingElement>, "children"> & {
  /** Overrides the level from the nesting. */
  readonly level?: HeadingLevel | undefined
  readonly child?: Snippet<[ChildArgs<HeadingState>]> | undefined
  readonly children?: Snippet<[HeadingState]> | undefined
}

export interface HeadingLevelProps {
  /** The level for the headings below; default: one more than the level around it. */
  readonly level?: HeadingLevel | undefined
  readonly children?: Snippet | undefined
}
