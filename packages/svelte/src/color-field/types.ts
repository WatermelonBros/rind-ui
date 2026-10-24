import type {
  Color,
  ColorChangeDetails,
  ColorChannel,
  ColorInput,
  ColorSpace,
  FieldMessages,
  MessageOverrides,
} from "@rind-ui/core"
import type { ColorFieldFormat, ColorFieldMessages } from "@rind-ui/core/internal"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLInputAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { FieldOwnProps } from "../field/types"
import type { NumberInputRootProps } from "../number-input/types"

declare module "../provider" {
  interface RindMessageScopes {
    "color-field": ColorFieldMessages
  }
}

export interface ColorFieldState {
  readonly value: Color | null
  readonly text: string
  readonly dirty: boolean
  readonly invalid: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export type ColorFieldReason = "INPUT.COMMIT" | "RESET" | "ADOPT"

export type ColorFieldRootProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onchange" | "dir" | "color"
> &
  Omit<FieldOwnProps, "messages"> & {
    readonly id?: string | undefined
    /** The field's parts (Label, Input, Description, ErrorMessage). */
    readonly children?: Snippet | undefined
    /** The colour; `bind:value` controls it; null: no colour. */
    value?: ColorInput | null | undefined
    /** Default `null` (no colour). */
    readonly defaultValue?: ColorInput | null | undefined
    readonly onValueChange?:
      | ((
          color: Color | null,
          details: ColorChangeDetails<ColorFieldReason> & {
            readonly modality?: string | undefined
          },
        ) => void)
      | undefined
    /** Every accepted edit of the text (the value changes only at commit points). */
    readonly onInputValueChange?: ((text: string) => void) | undefined
    /** `hex` (default): hex digits with an optional `#`; `css`: any CSS colour. */
    readonly format?: ColorFieldFormat | undefined
    /** Accept and show 8-digit hex (default false: the alpha never changes). */
    readonly alpha?: boolean | undefined
    readonly colorSpace?: ColorSpace | undefined
    /** The id of the form the hidden input belongs to. */
    readonly form?: string | undefined
    /** Sets the direction when `dir` is not given. Default: the provider's. */
    readonly locale?: string | undefined
    /** Reading direction of the root. Default: the locale's, else the provider's. */
    readonly dir?: "ltr" | "rtl" | undefined
    readonly messages?: MessageOverrides<ColorFieldMessages> | undefined
    /** The Field's messages when the Root is the Field. */
    readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
  }

export type ColorFieldInputProps = Omit<HTMLInputAttributes, "value" | "children"> & {
  readonly child?: Snippet<[ChildArgs<ColorFieldState>]> | undefined
}

export type ColorChannelFieldRootProps = Omit<
  NumberInputRootProps,
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "onValueCommit"
  | "min"
  | "max"
  | "step"
  | "largeStep"
  | "formatOptions"
  | "commitBehavior"
> & {
  readonly channel: ColorChannel
  /** The colour; `bind:value` controls it. */
  value?: ColorInput | undefined
  /** Default `hsb(0, 100%, 100%)`. */
  readonly defaultValue?: ColorInput | undefined
  readonly onValueChange?: ((color: Color, details: ColorChangeDetails) => void) | undefined
  readonly onValueCommit?:
    | ((color: Color, details: { readonly reason: string }) => void)
    | undefined
  readonly colorSpace?: ColorSpace | undefined
}
