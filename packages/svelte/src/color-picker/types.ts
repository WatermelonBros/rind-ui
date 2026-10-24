import type {
  Color,
  ColorChangeDetails,
  ColorChannel,
  ColorFormat,
  ColorInput,
  ColorNameProp,
  ColorPickerFormat,
  ColorPickerMessages,
  ColorPickerReason,
  MessageOverrides,
  PopoverProps,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type {
  HTMLAttributes,
  HTMLButtonAttributes,
  HTMLInputAttributes,
  HTMLLabelAttributes,
  HTMLSelectAttributes,
} from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    "color-picker": ColorPickerMessages
  }
}

export interface ColorPickerState {
  readonly color: Color
  readonly format: ColorPickerFormat
  readonly open: boolean
  readonly inline: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface ColorPickerChangeDetails extends ColorChangeDetails<ColorPickerReason> {
  /** The colour in the current format. */
  readonly valueAsString: string
  /** The channel an input or slider changed. */
  readonly channel?: string | undefined
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ColorPickerState>]> | undefined
  readonly children?: Snippet<[ColorPickerState]> | undefined
}

export type ColorPickerRootProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onchange" | "dir" | "color"
> & {
  readonly id?: string | undefined
  /** The picker parts. */
  readonly children?: Snippet<[ColorPickerState]> | undefined
  /** The colour; `bind:value` controls it. */
  value?: ColorInput | undefined
  /** Default `#000000`. */
  readonly defaultValue?: ColorInput | undefined
  readonly onValueChange?: ((color: Color, details: ColorPickerChangeDetails) => void) | undefined
  readonly onValueCommit?:
    | ((color: Color, details: { readonly reason: ColorPickerReason }) => void)
    | undefined
  /** The shown format; `bind:format` controls it. */
  format?: ColorPickerFormat | undefined
  readonly defaultFormat?: ColorPickerFormat | undefined
  readonly onFormatChange?: ((format: ColorPickerFormat) => void) | undefined
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: { readonly reason: string }) => void)
    | undefined
  /** The content in place: no Popover, no layer, no positioning, no listeners. */
  readonly inline?: boolean | undefined
  readonly closeOnSelect?: boolean | undefined
  readonly modal?: boolean | undefined
  /** The Popover's positioning: side, align, offsets, flip, shift, size, arrow and mode. */
  readonly positioning?: PopoverProps["positioning"] | undefined
  /** Where focus goes once the Popover is placed: a function, or the overlay's rule. */
  readonly initialFocus?: PopoverProps["initialFocus"] | undefined
  /** Elements whose presses and focus count as inside the Popover (a toast region). */
  readonly persistentElements?: PopoverProps["persistentElements"] | undefined
  readonly name?: string | undefined
  /** The id of the form the hidden input belongs to. */
  readonly form?: string | undefined
  /** The submitted text's format (default the canonical hex). */
  readonly formFormat?: ColorFormat | undefined
  readonly disabled?: boolean | undefined
  readonly readonly?: boolean | undefined
  /** Marks the picker required (Field state, `data-required` on the hidden input). */
  readonly required?: boolean | undefined
  /** Marks the picker invalid (`data-invalid`, the Field's error state). */
  readonly invalid?: boolean | undefined
  /** A fixed name or a function replacing the computed colour name. */
  readonly colorName?: ColorNameProp | undefined
  /** Formats the colour name and the numbers. Default: the provider's. */
  readonly locale?: string | undefined
  /** Reading direction; mirrors the area and sliders. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: MessageOverrides<ColorPickerMessages> | undefined
}

export type ColorPickerLabelProps = Part<HTMLLabelAttributes>
export type ColorPickerDivProps = Part<HTMLAttributes<HTMLDivElement>>
export type ColorPickerButtonProps = Part<HTMLButtonAttributes>
export type ColorPickerSpanProps = Part<HTMLAttributes<HTMLSpanElement>>
export type ColorPickerSelectProps = Omit<HTMLSelectAttributes, "children"> & {
  readonly child?: Snippet<[ChildArgs<ColorPickerState>]> | undefined
}
export type ColorPickerChannelInputProps = Omit<HTMLInputAttributes, "value" | "children"> & {
  /** A colour channel (a Color Channel Field), or `hex` / `css` (a Color Field). */
  readonly channel: ColorChannel | "hex" | "css"
  /** Accept and show 8-digit hex (default: when the colour has alpha below 1). */
  readonly alpha?: boolean | undefined
}
export type ColorPickerViewProps = ColorPickerDivProps & {
  /** The format this view is for: the children render only while it is the picker's. */
  readonly format: ColorPickerFormat
}
