import type {
  Color,
  ColorChangeDetails,
  ColorChannel,
  ColorCommitDetails,
  ColorInput,
  ColorNameProp,
  ColorSpace,
  MessageOverrides,
} from "@rind-ui/core"
import type { ColorAreaMessages, ColorAreaReason } from "@rind-ui/core/internal"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "color-area": ColorAreaMessages
  }
}

export interface ColorAreaState {
  readonly color: Color
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ColorAreaState>]> | undefined
  readonly children?: Snippet<[ColorAreaState]> | undefined
}

export type ColorAreaRootProps = Part<
  Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onchange" | "dir" | "color">
> & {
  /** The colour; `bind:value` controls it. */
  value?: ColorInput | undefined
  /** Default `hsb(0, 0%, 100%)`; a later change only changes what a form reset restores. */
  readonly defaultValue?: ColorInput | undefined
  /** Each applied change, in the space of the colour you passed. */
  readonly onValueChange?:
    | ((color: Color, details: ColorChangeDetails<ColorAreaReason>) => void)
    | undefined
  /** Once at the end of each interaction that changed the colour. */
  readonly onValueCommit?:
    | ((color: Color, details: ColorCommitDetails<ColorAreaReason>) => void)
    | undefined
  /** The space of the axes (default: the first colour's space, else `hsb`). */
  readonly colorSpace?: ColorSpace | undefined
  /** The horizontal channel. Default: saturation (hsb, hsl), red (rgb). */
  readonly xChannel?: ColorChannel | undefined
  /** The vertical channel. Default: brightness (hsb), lightness (hsl), green (rgb). */
  readonly yChannel?: ColorChannel | undefined
  /** Submits the x channel under this name. */
  readonly xName?: string | undefined
  /** Submits the y channel under this name. */
  readonly yName?: string | undefined
  /** The id of the form the inputs belong to. */
  readonly form?: string | undefined
  /** Ignores presses and keys. */
  readonly disabled?: boolean | undefined
  /** Focusable, changes nothing. */
  readonly readOnly?: boolean | undefined
  /** Replaces the colour name in the value text. */
  readonly colorName?: ColorNameProp | undefined
  /** Formats the value text. Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Mirrors the x axis. Default: the provider's direction. */
  readonly dir?: "ltr" | "rtl" | undefined
  /** Names, role description, value text and colour words. */
  readonly messages?: MessageOverrides<ColorAreaMessages> | undefined
}

export type ColorAreaPartProps = Part<HTMLAttributes<HTMLDivElement>>
