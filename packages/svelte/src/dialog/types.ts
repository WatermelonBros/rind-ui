import type {
  DialogChangeDetails,
  DialogCloseReason,
  DialogMessages,
  DismissEvent,
  FocusTarget,
  HeadingLevel,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    dialog: DialogMessages
  }
}

export interface DialogOpenState {
  readonly open: boolean
}
export type DialogTriggerState = DialogOpenState
export type DialogContentState = DialogOpenState

/** What `bind:actions` exposes. */
export interface DialogActions {
  open(): void
  close(): void
}

/** The content's role: a dialog, or a confirmation that interrupts. */
export type DialogRole = "dialog" | "alertdialog"

type Part<A, S = undefined> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

interface RootBase {
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: DialogChangeDetails) => void) | undefined
  /** Default true. */
  readonly closeOnEscape?: boolean | undefined
  /** `null`: the overlay's rule; `false`: focus does not move; a part name or a function. */
  readonly initialFocus?:
    | "content"
    | "title"
    | "cancel"
    | (() => FocusTarget)
    | null
    | false
    | undefined
  /** `null`: back to the opener; `false`: focus does not move. */
  readonly finalFocus?:
    | ((reason: DialogCloseReason | undefined) => FocusTarget)
    | null
    | false
    | undefined
  readonly onEscapeKeyDown?: ((event: DismissEvent) => void) | undefined
  readonly onInteractOutside?: ((event: DismissEvent) => void) | undefined
  /** The base of the generated part ids. Default: a generated id. */
  readonly id?: string | undefined
  /** Content, backdrop and positioner stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  readonly messages?: MessageOverrides<DialogMessages> | undefined
  /** `bind:actions`: open, close. */
  actions?: DialogActions | undefined
  readonly children?: Snippet<[DialogOpenState]> | undefined
}

/**
 * A dialog's Root props. With `role="alertdialog"` (a confirmation: always modal, never closed
 * by an outside press) `modal` and `closeOnInteractOutside` do not exist.
 */
export type DialogRootProps = RootBase &
  (
    | {
        /** `alertdialog`: a confirmation. Always modal, an outside press never closes it, focus starts on Cancel, a missing description warns. */
        readonly role: "alertdialog"
        readonly modal?: never
        readonly closeOnInteractOutside?: never
      }
    | {
        readonly role?: "dialog" | undefined
        /** Default true. */
        readonly modal?: boolean | undefined
        /** Default: `modal`. */
        readonly closeOnInteractOutside?: boolean | undefined
      }
  )

export type DialogTriggerProps = Part<HTMLButtonAttributes, DialogTriggerState>
export type DialogBackdropProps = Part<HTMLAttributes<HTMLDivElement>>
export type DialogPositionerProps = Part<HTMLAttributes<HTMLDivElement>>
export type DialogContentProps = Part<HTMLAttributes<HTMLDivElement>, DialogContentState>
export type DialogTitleProps = Part<HTMLAttributes<HTMLHeadingElement>> & {
  /** The heading level (default 2); headings in the content are one level below. */
  readonly level?: HeadingLevel | undefined
}
export type DialogDescriptionProps = Part<HTMLAttributes<HTMLParagraphElement>>
export type DialogButtonProps = Part<HTMLButtonAttributes>
