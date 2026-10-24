import type { ChangeDetails, RatingEvent, RatingMessages } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLLabelAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    rating: RatingMessages
  }
}

export interface RatingState {
  readonly value: number
  /** The hover preview, or null. */
  readonly preview: number | null
  readonly count: number
  readonly disabled: boolean
  readonly readOnly: boolean
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<RatingState>]> | undefined
  readonly children?: Snippet<[RatingState]> | undefined
}
export type RatingRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "dir">> & {
  /** 0 (no rating) to `count`, in steps of 1 (0.5 with `allowHalf`); `bind:value` controls it. */
  value?: number | undefined
  /** Read at creation (default 0, no rating); a later change only changes what a form reset restores. */
  readonly defaultValue?: number | undefined
  readonly onValueChange?:
    | ((value: number, details: ChangeDetails<RatingEvent>) => void)
    | undefined
  /** The number of stars. Default: 5. */
  readonly count?: number | undefined
  /** Half stars: the left half of a star (the right one in RTL) and the keys move by 0.5. */
  readonly allowHalf?: boolean | undefined
  /** Pressing the current value, or the keys below the first star, go back to 0 (no rating). */
  readonly allowClear?: boolean | undefined
  /** Ignores all input; the Rating leaves the tab order. */
  readonly disabled?: boolean | undefined
  /** Keeps focus and value, ignores changes. */
  readonly readonly?: boolean | undefined
  /** The form is invalid while there is no rating (the browser's own message). */
  readonly required?: boolean | undefined
  /** Sets `aria-invalid` and `data-invalid`. */
  readonly invalid?: boolean | undefined
  /** The submitted field name ("" while unrated). */
  readonly name?: string | undefined
  /** The id of the form the inputs belong to. */
  readonly form?: string | undefined
  /** Locale for the value text. Default: the provider's. */
  readonly locale?: string | undefined
  /** Reading direction; mirrors the stars and the arrow keys. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: Partial<RatingMessages> | undefined
}
export type RatingLabelProps = Part<HTMLLabelAttributes>
export type RatingControlProps = Part<HTMLAttributes<HTMLDivElement>>
export type RatingItemProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** The star's position, 1 to `count` (known on the server). */
  readonly index: number
}
