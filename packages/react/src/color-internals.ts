// The Color Picker's parts are components of their own (the area, the channel slider, the
// fields, the swatch, the swatch group), bound to the picker by `ColorPicker`'s parts. They
// are not public API and the package does not export this module: the behaviour tests in
// @rind-ui/testing reach it through an alias (vitest.config.ts, testing's tsconfig `paths`).
export { ColorArea, type ColorAreaRootProps } from "./color-area/color-area"
export { ColorChannelField, ColorField, type ColorFieldRootProps } from "./color-field/color-field"
export { ColorSlider, type ColorSliderRootProps } from "./color-slider/color-slider"
export { ColorSwatch } from "./color-swatch/color-swatch"
export {
  ColorSwatchPicker,
  type ColorSwatchPickerRootProps,
} from "./color-swatch-picker/color-swatch-picker"
