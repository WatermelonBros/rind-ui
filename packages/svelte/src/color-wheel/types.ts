import type {
  AngleSliderEvent,
  AngleSliderReason,
  ChangeDetails,
  Color,
  ColorInput,
  ColorWheelMessages,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLInputAttributes, HTMLLabelAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "color-wheel": ColorWheelMessages
  }
}

/** What every part's snippets receive. */
export interface ColorWheelRenderState {
  readonly color: Color
  /** The hue in degrees, [0, 360). */
  readonly hue: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ColorWheelRenderState>]> | undefined
  readonly children?: Snippet<[ColorWheelRenderState]> | undefined
}

export type ColorWheelRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "defaultValue">> & {
  /** The colour; `bind:value` controls it. */
  value?: ColorInput | undefined
  /** Uncontrolled colour. Default `hsl(0 100% 50%)`. */
  readonly defaultValue?: ColorInput | undefined
  /** Every change of the hue, with the colour in `colorSpace`. */
  readonly onValueChange?:
    | ((value: Color, details: ChangeDetails<AngleSliderEvent>) => void)
    | undefined
  /** Once per interaction: a drag's release, a press, a key. */
  readonly onValueCommit?:
    | ((value: Color, details: { readonly reason: AngleSliderReason }) => void)
    | undefined
  /** The space the colour is emitted in. Default `hsl`. */
  readonly colorSpace?: "hsl" | "hsb" | undefined
  /** Degrees per step. Default 1. */
  readonly step?: number | undefined
  /** Shift+Arrow, PageUp and PageDown. Default 15. */
  readonly largeStep?: number | undefined
  /** No change; not submitted. */
  readonly disabled?: boolean | undefined
  /** Submitted and focusable; no change. */
  readonly readonly?: boolean | undefined
  /** Marks the input invalid. */
  readonly invalid?: boolean | undefined
  /** Submits the colour as hex. */
  readonly name?: string | undefined
  /** The form's id, when outside it. */
  readonly form?: string | undefined
  /** Default: the provider's locale (the value text). */
  readonly locale?: string | undefined
  /** Overrides the hue names and value text (also through the provider). */
  readonly messages?: MessageOverrides<ColorWheelMessages> | undefined
}

export type ColorWheelLabelProps = Part<HTMLLabelAttributes>
export type ColorWheelPartProps = Part<HTMLAttributes<HTMLDivElement>>
export type ColorWheelValueProps = Part<HTMLAttributes<HTMLSpanElement>>
export type ColorWheelInputProps = Omit<HTMLInputAttributes, "children">
