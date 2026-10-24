import type {
  ChangeDetails,
  SliderCommitDetails,
  SliderEvent,
  SliderMessages,
  SliderOrientation,
  SliderReason,
  ThumbAlignment,
  ThumbCollision,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLLabelAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    slider: SliderMessages
  }
}

/** A single value, or one value per thumb. */
export type SliderValue = number | readonly number[]

export interface SliderChangeDetails {
  readonly reason: SliderReason
  /** The thumb whose value changed (the first, when several did). */
  readonly index: number
  readonly event: ChangeDetails<SliderEvent>["event"]
  /** Prevents the change (uncontrolled) or refuses it (controlled). */
  cancel(): void
}
export interface SliderState {
  readonly values: readonly number[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly orientation: SliderOrientation
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<SliderState>]> | undefined
  readonly children?: Snippet<[SliderState]> | undefined
}
export type SliderRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "dir">> & {
  /** A number, or one number per thumb; `bind:value` controls it. */
  value?: SliderValue | undefined
  /** Read at creation (default `min`); a later change only changes what a form reset restores. */
  readonly defaultValue?: SliderValue | undefined
  readonly onValueChange?: ((value: SliderValue, details: SliderChangeDetails) => void) | undefined
  /** Once at the end of each interaction that changed the value (release, key, adjustment). */
  readonly onValueCommit?: ((value: SliderValue, details: SliderCommitDetails) => void) | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly step?: number | undefined
  /** Shift + arrow and PageUp / PageDown (default one tenth of the range). */
  readonly largeStep?: number | undefined
  readonly minStepsBetweenThumbs?: number | undefined
  readonly thumbCollision?: ThumbCollision | undefined
  /** `contain` keeps thumbs inside the track; set `--rind-slider-thumb-size` to the thumb size. Default: `center`. */
  readonly thumbAlignment?: ThumbAlignment | undefined
  /** The axis. Default: `horizontal`. */
  readonly orientation?: SliderOrientation | undefined
  /** Ignores all input; thumbs leave the tab order. */
  readonly disabled?: boolean | undefined
  /** Keeps focus and value, ignores changes. */
  readonly readonly?: boolean | undefined
  /** `data-required` only: a range input always has a value. */
  readonly required?: boolean | undefined
  /** Sets `aria-invalid` and `data-invalid`. */
  readonly invalid?: boolean | undefined
  /** The submitted field name of every thumb. */
  readonly name?: string | undefined
  /** The id of the form the inputs belong to. */
  readonly form?: string | undefined
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  /** Locale for formatting. Default: the provider's. */
  readonly locale?: string | undefined
  /** Reading direction; mirrors a horizontal Slider. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: Partial<SliderMessages> | undefined
}
export type SliderPartProps = Part<HTMLAttributes<HTMLDivElement>>
export type SliderLabelProps = Part<HTMLLabelAttributes>
export type SliderThumbProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The thumb's value index (known on the server). */
  readonly index: number
  /** Disables this thumb only. */
  readonly disabled?: boolean | undefined
  /** Submitted under this name instead of the Root's. */
  readonly name?: string | undefined
}
export type SliderMarkerProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The value the tick marks. */
  readonly value: number
}
