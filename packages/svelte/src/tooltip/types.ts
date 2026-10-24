import type { PositioningProps, TooltipChangeDetails } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface TooltipOpenState {
  readonly open: boolean
}
export type TooltipTriggerState = TooltipOpenState
export type TooltipContentState = TooltipOpenState

/** What `bind:actions` exposes. */
export interface TooltipActions {
  open(): void
  close(): void
}

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

export interface TooltipRootProps {
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: TooltipChangeDetails) => void) | undefined
  /** Default 700 ms. */
  readonly openDelay?: number | undefined
  /** Default 300 ms. */
  readonly closeDelay?: number | undefined
  /** The delay group's warm window after this tooltip closes (default 300 ms; 0: none). */
  readonly skipDelay?: number | undefined
  /** Pressing the trigger closes it (default true). */
  readonly closeOnPress?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly positioning?: PositioningProps | undefined
  /** Base for the ids of the tooltip's parts. Default: generated. */
  readonly id?: string | undefined
  /** `description` (default): the text describes the trigger. `label`: it names it. */
  readonly type?: "description" | "label" | undefined
  /** `bind:actions`: open, close. */
  actions?: TooltipActions | undefined
  readonly children?: Snippet<[TooltipOpenState]> | undefined
}
export type TooltipTriggerProps = Part<HTMLButtonAttributes, TooltipTriggerState>
export type TooltipPositionerProps = Part<HTMLAttributes<HTMLDivElement>>
export type TooltipContentProps = Part<HTMLAttributes<HTMLDivElement>, TooltipContentState>
export type TooltipArrowProps = Part<HTMLAttributes<HTMLDivElement>>
