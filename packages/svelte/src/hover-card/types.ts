import type { HoverCardChangeDetails, PositioningProps } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAnchorAttributes, HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface HoverCardOpenState {
  readonly open: boolean
}
export type HoverCardTriggerState = HoverCardOpenState
export type HoverCardContentState = HoverCardOpenState

/** What `bind:actions` exposes. */
export interface HoverCardActions {
  open(): void
  close(): void
}

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

export interface HoverCardRootProps {
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: HoverCardChangeDetails) => void) | undefined
  /** Default 700 ms. */
  readonly openDelay?: number | undefined
  /** Default 300 ms. */
  readonly closeDelay?: number | undefined
  readonly disabled?: boolean | undefined
  readonly positioning?: PositioningProps | undefined
  /** Base for the ids of the hover card's parts. Default: generated. */
  readonly id?: string | undefined
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** `bind:actions`: open, close. */
  actions?: HoverCardActions | undefined
  readonly children?: Snippet<[HoverCardOpenState]> | undefined
}
export type HoverCardTriggerProps = Part<HTMLAnchorAttributes, HoverCardTriggerState>
export type HoverCardPositionerProps = Part<HTMLAttributes<HTMLDivElement>>
export type HoverCardContentProps = Part<HTMLAttributes<HTMLDivElement>, HoverCardContentState>
export type HoverCardArrowProps = Part<HTMLAttributes<HTMLDivElement>>
