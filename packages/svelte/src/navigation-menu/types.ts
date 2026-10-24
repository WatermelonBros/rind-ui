import type {
  MessageOverrides,
  NavigationMenuMessages,
  NavigationMenuProps,
  PositioningProps,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLLiAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { LinkProps } from "../link/types"

declare module "../provider" {
  interface RindMessageScopes {
    "navigation-menu": NavigationMenuMessages
  }
}

export interface NavigationMenuTriggerState {
  /** Its panel is open. */
  readonly open: boolean
}
export interface NavigationMenuContentState {
  /** The panel is open. */
  readonly open: boolean
}

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

/** A level's props: the root's and a Sub's. */
interface LevelProps {
  /** The open item's `value`; `bind:value` controls it; `null` when none is open. */
  value?: string | null | undefined
  /** The item open at first (uncontrolled). */
  readonly defaultValue?: string | null | undefined
  /** Called when the open item changes; `details.reason` says why. */
  readonly onValueChange?: NavigationMenuProps["onValueChange"] | undefined
  /** `horizontal` (default for the root) or `vertical` (default for a Sub). */
  readonly orientation?: "horizontal" | "vertical" | undefined
}

export type NavigationMenuRootProps = Part<HTMLAttributes<HTMLElement>> &
  LevelProps & {
    /** Open items when a mouse or pen rests on their trigger (default true). */
    readonly openOnHover?: boolean | undefined
    /** Disables every trigger. */
    readonly disabled?: boolean | undefined
    /** Hover time before an item opens, in ms (default 200). */
    readonly openDelay?: number | undefined
    /** Time before a hover-opened panel closes after the pointer left, in ms (default 300). */
    readonly closeDelay?: number | undefined
    /** After a close, hovering a trigger within this time opens it at once, in ms (default 300). */
    readonly skipDelay?: number | undefined
    /** A press this soon after a hover open keeps the panel open, in ms (default 500). */
    readonly patientClick?: number | undefined
    /**
     * Closed panels: `hidden` (default) keeps them in the document with `hidden`, so their
     * links are crawlable and found by find-in-page indexing; `unmount` removes them after their
     * exit animation.
     */
    readonly closedContent?: "hidden" | "unmount" | undefined
    /** The landmark's default name (`label`, "Main"). */
    readonly messages?: MessageOverrides<NavigationMenuMessages> | undefined
  }
export type NavigationMenuSubProps = Part<HTMLAttributes<HTMLDivElement>> & LevelProps
export type NavigationMenuListProps = Part<HTMLAttributes<HTMLUListElement>>
export type NavigationMenuItemProps = Part<HTMLLiAttributes> & {
  /** The item's key in the level's `value` (default: a generated, SSR-stable key). */
  readonly value?: string | undefined
}
export type NavigationMenuTriggerProps = Part<HTMLButtonAttributes, NavigationMenuTriggerState> & {
  /** Never opens by press, keyboard or hover. */
  readonly disabled?: boolean | undefined
}
export type NavigationMenuContentProps = Part<
  HTMLAttributes<HTMLDivElement>,
  NavigationMenuContentState
>
export type NavigationMenuLinkProps = LinkProps
export type NavigationMenuIndicatorProps = Part<HTMLLiAttributes>
export type NavigationMenuViewportProps = Part<HTMLAttributes<HTMLDivElement>>
export type NavigationMenuPositionerProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** What the panel is placed against: the open trigger (default) or the whole list. */
  readonly anchor?: "trigger" | "list" | undefined
  /** Side, alignment and offsets (default below, aligned to the start, 4 px away). */
  readonly positioning?: PositioningProps | undefined
}
