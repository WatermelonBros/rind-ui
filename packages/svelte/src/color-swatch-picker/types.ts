import type {
  Color,
  ColorChangeDetails,
  ColorInput,
  ColorNameProp,
  MessageOverrides,
} from "@rind-ui/core"
import type { ColorSwatchPickerMessages } from "@rind-ui/core/internal"
import type { Snippet } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import type { RadioGroupRootProps } from "../radio-group/types"

export interface ColorSwatchPickerChangeDetails extends ColorChangeDetails {
  /** The checked item's key. */
  readonly value: string
  readonly index: number
}

export type ColorSwatchPickerRootProps = Omit<
  RadioGroupRootProps,
  "value" | "defaultValue" | "onValueChange"
> & {
  /** The colour; `bind:value` controls it; null: no swatch checked. */
  value?: ColorInput | null | undefined
  /** Default `null`: no swatch checked. */
  readonly defaultValue?: ColorInput | null | undefined
  /** A swatch was checked; `details.value` is its key, `details.index` its index. */
  readonly onValueChange?:
    | ((color: Color, details: ColorSwatchPickerChangeDetails) => void)
    | undefined
  /** Formats the swatches' colour names. Default: the provider's. */
  readonly locale?: string | undefined
  /** The group's label (`swatchPickerLabel`) and the colour words. */
  readonly messages?: MessageOverrides<ColorSwatchPickerMessages> | undefined
}

export type ColorSwatchPickerItemProps = Omit<
  HTMLButtonAttributes,
  "value" | "color" | "children"
> & {
  readonly children?: Snippet | undefined
  /** The swatch's colour: a colour, or a string `parseColor` reads. */
  readonly color: ColorInput
  /** The item's key (default the canonical `#RRGGBBAA`). */
  readonly value?: string | undefined
  /** Disables this swatch only. */
  readonly disabled?: boolean | undefined
  /** A fixed name or a function replacing the computed colour name (the swatch's accessible name). */
  readonly colorName?: ColorNameProp | undefined
}
