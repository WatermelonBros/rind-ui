import type {
  AngleSliderEvent,
  AngleSliderMessages,
  AngleSliderReason,
  ChangeDetails,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLInputAttributes, HTMLLabelAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "angle-slider": AngleSliderMessages
  }
}

/** What every part's snippets receive. */
export interface AngleSliderRenderState {
  /** The angle in degrees, [0, 360). */
  readonly value: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<AngleSliderRenderState>]> | undefined
  readonly children?: Snippet<[AngleSliderRenderState]> | undefined
}

export type AngleSliderRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "defaultValue">> & {
  /** The angle in degrees, [0, 360); `bind:value` controls it. */
  value?: number | undefined
  /** Uncontrolled angle. Default 0. */
  readonly defaultValue?: number | undefined
  /** Every change. */
  readonly onValueChange?:
    | ((value: number, details: ChangeDetails<AngleSliderEvent>) => void)
    | undefined
  /** Once per interaction: a drag's release, a key, a native change. */
  readonly onValueCommit?:
    | ((value: number, details: { readonly reason: AngleSliderReason }) => void)
    | undefined
  /** Degrees per step; values snap to the nearest. Default 1. */
  readonly step?: number | undefined
  /** Shift+Arrow, PageUp and PageDown. Default 15. */
  readonly largeStep?: number | undefined
  /** A step past an end wraps around. Default true. */
  readonly wrap?: boolean | undefined
  /** No change; not submitted. */
  readonly disabled?: boolean | undefined
  /** Submitted and focusable; no change. */
  readonly readonly?: boolean | undefined
  /** Marks the input invalid. */
  readonly invalid?: boolean | undefined
  /** The form field's name. */
  readonly name?: string | undefined
  /** The form's id, when outside it. */
  readonly form?: string | undefined
  /** Default: the provider's locale (the formatted angle). */
  readonly locale?: string | undefined
  /** Overrides `valueText` (also through the provider). */
  readonly messages?: MessageOverrides<AngleSliderMessages> | undefined
}

export type AngleSliderLabelProps = Part<HTMLLabelAttributes>
export type AngleSliderPartProps = Part<HTMLAttributes<HTMLDivElement>>
export type AngleSliderValueProps = Part<HTMLAttributes<HTMLSpanElement>>
export type AngleSliderInputProps = Omit<HTMLInputAttributes, "children">
export type AngleSliderMarkerProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Where the tick sits, in degrees. */
  readonly value: number
}
