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
import type { ColorSliderMessages } from "@rind-ui/core/internal"
import type { SliderRootProps, SliderThumbProps } from "../slider/types"

declare module "../provider" {
  interface RindMessageScopes {
    "color-slider": ColorSliderMessages
  }
}

export type ColorSliderRootProps = Omit<
  SliderRootProps,
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "onValueCommit"
  | "min"
  | "max"
  | "step"
  | "largeStep"
  | "formatOptions"
  | "messages"
  | "minStepsBetweenThumbs"
  | "thumbCollision"
> & {
  /** The edited channel: red, green, blue, hue, saturation, lightness, brightness or alpha. */
  readonly channel: ColorChannel
  /** The colour; `bind:value` controls it. */
  value?: ColorInput | undefined
  /** Default `hsb(0, 100%, 100%)`. */
  readonly defaultValue?: ColorInput | undefined
  /** Each applied change, in the space of the colour you passed. */
  readonly onValueChange?: ((color: Color, details: ColorChangeDetails) => void) | undefined
  /** Once at the end of each interaction that changed the colour. */
  readonly onValueCommit?: ((color: Color, details: ColorCommitDetails) => void) | undefined
  /** The working space. Default: the colour's when it has the channel. */
  readonly colorSpace?: ColorSpace | undefined
  /** Replaces the colour name in the value text. */
  readonly colorName?: ColorNameProp | undefined
  /** Channel names, value text and colour words. */
  readonly messages?: MessageOverrides<ColorSliderMessages> | undefined
}

export type ColorSliderThumbProps = Omit<SliderThumbProps, "index">
