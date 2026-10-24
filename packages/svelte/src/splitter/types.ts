import type {
  ChangeDetails,
  SplitterCommitDetails,
  SplitterEvent,
  SplitterOrientation,
  SplitterPanel,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface SplitterState {
  readonly sizes: readonly number[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly orientation: SplitterOrientation
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<SplitterState>]> | undefined
  readonly children?: Snippet<[SplitterState]> | undefined
}
export type SplitterRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "dir">> & {
  /** One entry per panel: `min`, `max`, `collapsible`, `collapsedSize`. */
  readonly panels: readonly SplitterPanel[]
  /** Sizes in percent, one per panel, summing to 100; `bind:sizes` controls them. */
  sizes?: readonly number[] | undefined
  /** Uncontrolled initial sizes (default an equal split). */
  readonly defaultSizes?: readonly number[] | undefined
  /** Every change (each pointer move); not when the parent changes `sizes`. */
  readonly onSizesChange?:
    | ((sizes: readonly number[], details: ChangeDetails<SplitterEvent>) => void)
    | undefined
  /** Once at the end of each interaction that changed the sizes: the hook to save a layout. */
  readonly onSizesCommit?:
    | ((sizes: readonly number[], details: SplitterCommitDetails) => void)
    | undefined
  /** The panel axis. Default: `horizontal` (side by side). */
  readonly orientation?: SplitterOrientation | undefined
  /** Percent per arrow key. Default: 5. */
  readonly step?: number | undefined
  /** No handle moves or is focusable. */
  readonly disabled?: boolean | undefined
  /** Reading direction; mirrors a horizontal Splitter. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
}
export type SplitterPanelProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The panel's index in the Root's `panels` (known on the server). */
  readonly index: number
}
export type SplitterHandleProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The boundary after panel `index` (its primary panel). */
  readonly index: number
  /** Disables this handle only. */
  readonly disabled?: boolean | undefined
}
