import type {
  ChangeDetails,
  FocusTarget,
  HeadingLevel,
  MessageOverrides,
  PopoverCloseReason,
  PopoverDismissEvent,
  PopoverEvent,
  PopoverMessages,
  PositioningProps,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    popover: PopoverMessages
  }
}

export interface PopoverOpenState {
  readonly open: boolean
}
export type PopoverTriggerState = PopoverOpenState
export type PopoverContentState = PopoverOpenState

/** What `bind:this`'s `actions` (the Root's `actions` binding) exposes. */
export interface PopoverActions {
  open(): void
  close(): void
  /** Recomputes the position (a moved anchor the tracking cannot see). */
  reposition(): void
}

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

export interface PopoverRootProps {
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<PopoverEvent>) => void)
    | undefined
  /** Default false. */
  readonly modal?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Default true. */
  readonly closeOnEscape?: boolean | undefined
  /** Default true. */
  readonly closeOnInteractOutside?: boolean | undefined
  readonly onEscapeKeyDown?: ((event: PopoverDismissEvent) => void) | undefined
  readonly onInteractOutside?: ((event: PopoverDismissEvent) => void) | undefined
  /** Elements whose presses and focus count as inside (a toast). */
  readonly persistentElements?: (() => readonly Element[]) | undefined
  /** `false`: focus stays; `null` or a function returning null: the default rule. */
  readonly initialFocus?: (() => FocusTarget) | null | undefined
  /** `false`: focus does not move back; `null`: the trigger. */
  readonly finalFocus?:
    | ((reason: PopoverCloseReason | undefined) => FocusTarget)
    | null
    | false
    | undefined
  /** Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning). */
  readonly positioning?: PositioningProps | undefined
  /** Base for the ids of the popover's parts. Default: generated. */
  readonly id?: string | undefined
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  readonly messages?: MessageOverrides<PopoverMessages> | undefined
  /** `bind:actions`: open, close, reposition. */
  actions?: PopoverActions | undefined
  /** The parts' `data-scope`, for composites (Table's filters): internal. */
  readonly scope?: string | undefined
  readonly children?: Snippet<[PopoverOpenState]> | undefined
}
export type PopoverTriggerProps = Part<HTMLButtonAttributes, PopoverTriggerState>
export type PopoverAnchorProps = Part<HTMLAttributes<HTMLDivElement>>
export type PopoverIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>>
export type PopoverPositionerProps = Part<HTMLAttributes<HTMLDivElement>>
export type PopoverContentProps = Part<HTMLAttributes<HTMLDivElement>, PopoverContentState>
export type PopoverArrowProps = Part<HTMLAttributes<HTMLDivElement>>
export type PopoverTitleProps = Part<HTMLAttributes<HTMLHeadingElement>> & {
  /** The heading level (default 2); headings in the content are one level below. */
  readonly level?: HeadingLevel | undefined
}
export type PopoverDescriptionProps = Part<HTMLAttributes<HTMLParagraphElement>>
export type PopoverCloseTriggerProps = Part<HTMLButtonAttributes>
