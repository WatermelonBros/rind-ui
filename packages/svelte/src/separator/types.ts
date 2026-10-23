import type { SeparatorOrientation } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface SeparatorState {
  readonly orientation: SeparatorOrientation
  readonly decorative: boolean
}

export type SeparatorRootProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Default: the container's, else `horizontal`. */
  readonly orientation?: SeparatorOrientation | undefined
  /** Purely visual: `role="none"`, removed from the accessibility tree. */
  readonly decorative?: boolean | undefined
  readonly child?: Snippet<[ChildArgs<SeparatorState>]> | undefined
  readonly children?: Snippet<[SeparatorState]> | undefined
}
