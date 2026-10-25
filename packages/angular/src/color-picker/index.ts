import { ColorAreaBackground, ColorAreaRoot, ColorAreaThumb } from "../color-area/color-area"
import { ColorPickerChannelNumberInput, ColorPickerColorInput } from "../color-field/color-field"
import {
  ColorSliderControl,
  ColorSliderDescription,
  ColorSliderLabel,
  ColorSliderRoot,
  ColorSliderThumb,
  ColorSliderTrack,
  ColorSliderValueText,
} from "../color-slider/color-slider"
import {
  ColorSwatchPickerIndicator,
  ColorSwatchPickerItem,
  ColorSwatchPickerRoot,
} from "../color-swatch-picker/color-swatch-picker"
import { FieldDescription, FieldErrorMessage } from "../field/field"
import { PopoverPortal, PopoverPositioner } from "../popover/popover"
import { SliderValueText } from "../slider/slider"
import {
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerEyeDropperTrigger,
  ColorPickerFormatSelect,
  ColorPickerFormatTrigger,
  ColorPickerHiddenInput,
  ColorPickerLabel,
  ColorPickerRoot,
  ColorPickerSwatch,
  ColorPickerTransparencyGrid,
  ColorPickerTrigger,
  ColorPickerValueSwatch,
  ColorPickerValueText,
  ColorPickerView,
} from "./color-picker"

export type { ColorAreaChangeEvent } from "../color-area/color-area"
export { ColorPickerChannelNumberInput, ColorPickerColorInput } from "../color-field/color-field"
export type { ColorSliderChangeEvent } from "../color-slider/color-slider"
export type { ColorSwatchPickerChangeDetails } from "../color-swatch-picker/color-swatch-picker"
export {
  type ColorPickerChangeDetails,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerEyeDropperTrigger,
  ColorPickerFormatSelect,
  ColorPickerFormatTrigger,
  ColorPickerHiddenInput,
  ColorPickerLabel,
  ColorPickerRoot,
  type ColorPickerState,
  ColorPickerSwatch,
  ColorPickerTransparencyGrid,
  ColorPickerTrigger,
  ColorPickerValueSwatch,
  ColorPickerValueText,
  ColorPickerView,
} from "./color-picker"
export {
  ColorAreaBackground as ColorPickerAreaBackground,
  ColorAreaRoot as ColorPickerArea,
  ColorAreaThumb as ColorPickerAreaThumb,
  ColorSliderLabel as ColorPickerChannelSliderLabel,
  ColorSliderRoot as ColorPickerChannelSlider,
  ColorSliderThumb as ColorPickerChannelSliderThumb,
  ColorSliderTrack as ColorPickerChannelSliderTrack,
  ColorSwatchPickerIndicator as ColorPickerSwatchIndicator,
  ColorSwatchPickerItem as ColorPickerSwatchTrigger,
  ColorSwatchPickerRoot as ColorPickerSwatchGroup,
}

/**
 * The Color Picker's parts, for a standalone component's `imports` (its Area, Channel Slider,
 * Channel Input and Swatch Group are the colour components bound to the picker; its Portal and
 * Positioner the Popover's; its Description and ErrorMessage the Field's).
 */
export const ColorPicker = [
  ColorPickerRoot,
  ColorPickerLabel,
  ColorPickerControl,
  ColorPickerTrigger,
  PopoverPortal,
  PopoverPositioner,
  ColorPickerContent,
  ColorAreaRoot,
  ColorAreaBackground,
  ColorAreaThumb,
  ColorSliderRoot,
  ColorSliderLabel,
  SliderValueText,
  ColorSliderValueText,
  ColorSliderControl,
  ColorSliderTrack,
  ColorSliderThumb,
  ColorSliderDescription,
  ColorPickerColorInput,
  ColorPickerChannelNumberInput,
  ColorPickerEyeDropperTrigger,
  ColorSwatchPickerRoot,
  ColorSwatchPickerItem,
  ColorSwatchPickerIndicator,
  ColorPickerSwatch,
  ColorPickerValueSwatch,
  ColorPickerFormatSelect,
  ColorPickerFormatTrigger,
  ColorPickerView,
  ColorPickerValueText,
  ColorPickerHiddenInput,
  ColorPickerTransparencyGrid,
  FieldDescription,
  FieldErrorMessage,
] as const
