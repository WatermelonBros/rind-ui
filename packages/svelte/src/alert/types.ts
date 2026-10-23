import type {
  AlertAnnounce,
  AlertEvent,
  AlertMessages,
  ChangeDetails,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    alert: AlertMessages
  }
}

export interface AlertState {
  readonly open: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<AlertState>]> | undefined
  readonly children?: Snippet<[AlertState]> | undefined
}

export type AlertRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Default `"polite"`: `"assertive"` for errors and failures, `"off"` for static content. */
  readonly announce?: AlertAnnounce | undefined
  /** Announced instead of the Icon label, Title and Description joined. */
  readonly announcement?: string | undefined
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ChangeDetails<AlertEvent>) => void) | undefined
  /**
   * Where focus goes when the alert is dismissed with focus inside it. Default (or `null`):
   * the next tab stop after the alert, else the previous one. `false`: focus does not move.
   */
  readonly finalFocus?: (() => HTMLElement | null | false) | undefined
  readonly messages?: MessageOverrides<AlertMessages> | undefined
}
export type AlertIconProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** Names the icon (`role="img"`), so the severity is in the alert's text ("Error"). */
  readonly label?: string | undefined
}
export type AlertTitleProps = Part<HTMLAttributes<HTMLDivElement>>
export type AlertDescriptionProps = Part<HTMLAttributes<HTMLDivElement>>
export type AlertCloseTriggerProps = Part<HTMLButtonAttributes>
