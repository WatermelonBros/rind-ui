// The Color Picker's parts are components of their own inside @rind-ui/react (the Area, the
// channel Slider, the Field, the Swatch, the Swatch group), bound to the picker by its parts.
// They are not public API: their behaviour tests render them directly through this module
// (React's workspace-only `color-internals` entry), test support only, never exported.
export {
  ColorArea,
  type ColorAreaRootProps,
  ColorChannelField,
  ColorField,
  type ColorFieldRootProps,
  ColorSlider,
  type ColorSliderRootProps,
  ColorSwatch,
  ColorSwatchPicker,
  type ColorSwatchPickerRootProps,
} from "@rind-ui/react/color-internals"
export { getColorArea } from "./color-area"
export { getColorChannelField, getColorField } from "./color-field"
export { getColorSlider } from "./color-slider"
export { getColorSwatch } from "./color-swatch"
export { getColorSwatchPicker } from "./color-swatch-picker"
